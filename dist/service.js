import { randomUUID } from "node:crypto";
import { readFile as defaultReadFile } from "node:fs/promises";
import { isUuid } from "./uuid.js";
export const PACKAGE_BUCKET = "thread-packages";
export class CursorError extends Error {
    constructor(message) {
        super(`invalid cursor: ${message}`);
        this.name = "CursorError";
    }
}
export function encodeCursor(cursor) {
    return Buffer.from(`${cursor.created_at}|${cursor.id}`, "utf8").toString("base64url");
}
export function decodeCursor(token) {
    // Buffer.from(_, "base64url") silently drops invalid bytes rather than
    // throwing, so reject non-base64url input explicitly up front.
    if (!/^[A-Za-z0-9_-]+$/.test(token))
        throw new CursorError("not valid base64url");
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const sep = raw.indexOf("|");
    if (sep <= 0)
        throw new CursorError("missing delimiter");
    const created_at = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (Number.isNaN(Date.parse(created_at)))
        throw new CursorError("unparseable timestamp");
    if (!isUuid(id))
        throw new CursorError("id is not a uuid");
    return { created_at, id };
}
export async function createThread(client, title) {
    const id = randomUUID();
    await assertResult(client.from("threads").insert({ id, title }));
    // Separate read-back (NOT insert().select()): the add_thread_owner trigger has
    // now created the creator's membership row, so this SELECT passes RLS.
    const rows = await assertResult(client.from("threads").select("slug").eq("id", id));
    const slug = rows[0]?.slug;
    // Fail loudly rather than report success with an invariant-breaking empty slug.
    if (!slug)
        throw new Error(`created thread ${id} but could not read its slug`);
    return { id, title, slug };
}
export async function publishMessage(client, input) {
    const message = await insertOne(client, "messages", {
        thread_id: input.threadId,
        body: input.body,
        label: input.label
    });
    const packageUpload = input.packageUpload;
    const hasAttachments = !!packageUpload && (packageUpload.manifest.files.length > 0 || packageUpload.manifest.urls.length > 0);
    if (!packageUpload || !hasAttachments) {
        return message;
    }
    const packageRow = await insertOne(client, "packages", {
        thread_id: input.threadId,
        message_id: message.id,
        manifest: packageUpload.manifest
    });
    const readFile = input.readFile ?? defaultReadFile;
    const uploadedPaths = [];
    try {
        for (const [index, file] of packageUpload.manifest.files.entries()) {
            const source = packageUpload.sources[index];
            if (!source) {
                throw new Error(`missing source for package file ${file.filename}`);
            }
            const storagePath = `${input.threadId}/${packageRow.id}/${file.filename}`;
            const bytes = await readFile(source.path);
            await assertResult(client.storage.from(PACKAGE_BUCKET).upload(storagePath, bytes, {
                contentType: file.mimeType,
                upsert: false
            }));
            uploadedPaths.push(storagePath);
            await insertOne(client, "package_files", {
                package_id: packageRow.id,
                storage_path: storagePath,
                filename: file.filename,
                mime_type: file.mimeType,
                size_bytes: file.sizeBytes,
                sha256: file.sha256,
                purpose: file.purpose
            });
        }
    }
    catch (error) {
        if (uploadedPaths.length > 0) {
            try {
                await client.storage.from(PACKAGE_BUCKET).remove(uploadedPaths);
            }
            catch {
                // Swallow cleanup errors; surface the original failure below.
            }
        }
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`publish failed for package ${packageRow.id}: ${reason}`);
    }
    return { ...message, package: packageRow };
}
export async function listPackageFiles(client, threadId) {
    const result = await client
        .from("packages")
        .select("id, package_files(storage_path, filename)")
        .eq("thread_id", threadId);
    return assertResult(result);
}
const MESSAGE_SELECT = "*, packages(manifest)";
export async function pullThread(client, threadId) {
    const result = await client
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("thread_id", threadId);
    return assertResult(result);
}
export async function listMessagesSince(client, threadId, cursor, limit) {
    const since = cursor ? decodeCursor(cursor) : undefined; // throws CursorError before any query
    let query = client
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("thread_id", threadId);
    if (since) {
        query = query.or(`created_at.gt.${since.created_at},and(created_at.eq.${since.created_at},id.gt.${since.id})`);
    }
    // No cursor + limit: take the NEWEST N (descending), then reverse to ascending
    // for emission. With a cursor (or no limit) the order is ascending forward.
    const descWindow = limit !== undefined && !since;
    const asc = !descWindow;
    query = query.order("created_at", { ascending: asc }).order("id", { ascending: asc });
    if (limit !== undefined)
        query = query.limit(limit);
    let messages = await assertResult(query);
    if (descWindow)
        messages = [...messages].reverse();
    const last = messages.at(-1);
    return { messages, cursor: last ? encodeCursor({ created_at: last.created_at, id: last.id }) : cursor };
}
export async function listThreads(client) {
    const result = await client
        .from("threads")
        .select("slug,title")
        .eq("archived", "false");
    return assertResult(result);
}
// id-only lookup for owner/admin flows (service-role delete). Member-facing
// commands use findThread, which also accepts a slug.
export async function getThread(client, threadId) {
    const result = await client
        .from("threads")
        .select("id,title,slug")
        .eq("id", threadId);
    const rows = await assertResult(result);
    return rows[0] ?? null;
}
// Resolve a thread by a uuid OR a slug under threads RLS. Returns null for an
// unknown handle or one the caller cannot see (RLS hides non-member rows), so
// callers cannot use this as a thread-existence oracle.
export async function findThread(client, handle) {
    const column = isUuid(handle) ? "id" : "slug";
    const result = await client
        .from("threads")
        .select("id,title,slug")
        .eq(column, handle);
    const rows = await assertResult(result);
    return rows[0] ?? null;
}
export async function addMemberByEmail(client, threadId, email) {
    const { data, error } = await client.rpc("add_member_by_email", {
        target_thread_id: threadId,
        target_email: email
    });
    // PostgREST surfaces RPC errors as a plain object, not an Error; wrap it so the
    // CLI prints a clean message instead of "[object Object]".
    if (error)
        throw new Error(error.message);
    return { status: data };
}
export async function listCollaborators(client, threadId) {
    const { data, error } = await client.rpc("thread_collaborators", {
        target_thread_id: threadId
    });
    if (error)
        throw new Error(error.message);
    return data ?? [];
}
// Threaded Slack notifications connect via an OAuth "Add to Slack" app: the
// slack-connect Edge Function mints the authorize URL; slack-oauth stores the
// install. These wrappers are the CLI surface.
export async function slackConnectUrl(client) {
    const { data, error } = await client.functions.invoke("slack-connect", { body: {} });
    if (error)
        throw new Error(error.message);
    // Guard the shape so an empty/garbled function response fails with a clear
    // message instead of a downstream TypeError on `undefined`.
    if (!data || typeof data.url !== "string" || !data.url) {
        throw new Error("slack-connect returned no URL");
    }
    return data.url;
}
export async function slackStatus(client) {
    const { data, error } = await client.rpc("slack_install_status", {});
    if (error)
        throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? { connected: false, team_id: null, channel_id: null, updated_at: null };
}
export async function slackDisconnect(client) {
    const { error } = await client.rpc("slack_disconnect", {});
    if (error)
        throw new Error(error.message);
}
export async function deleteThreadRow(client, threadId) {
    const result = await client.from("threads").delete().eq("id", threadId);
    await assertResult(result);
}
async function insertOne(client, table, rows) {
    const result = await client
        .from(table)
        .insert(rows)
        .select("*")
        .single();
    return assertResult(result);
}
async function assertResult(resultPromise) {
    const { data, error } = await resultPromise;
    if (error) {
        throw error;
    }
    return data;
}
//# sourceMappingURL=service.js.map