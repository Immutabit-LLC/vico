#!/usr/bin/env node
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { buildPackageUpload } from "./package.js";
import { createThread, findThread, getThread, listMessagesSince, listThreads, listPackageFiles, addMemberByEmail, listCollaborators, publishMessage, pullThread, slackConnectUrl, slackDisconnect, slackStatus } from "./service.js";
import { confirmOtp, requestOtp } from "./auth.js";
import { createPublicClient, getMemberClient, getMemberRealtimeClient } from "./client.js";
import { watchThread } from "./watch.js";
import { downloadThread } from "./download.js";
import { formatDiagnostics, vicoVersion } from "./diagnostics.js";
import { ensureAuthHome, assertLocalAuthSafe } from "./local-auth.js";
import { localCredentialsPath, resolveCredentialsPath, loadSession, decodeJwtPayload, saveSession } from "./credentials.js";
import { loadThreadCursor, saveThreadCursor } from "./thread-state.js";
import { promptLine } from "./prompt.js";
import { assertUuid, isUuid } from "./uuid.js";
export function shapeThreads(rows) {
    return rows.map((r) => ({ slug: r.slug, title: r.title }));
}
export function shapeCollaborators(rows) {
    return rows.map((r) => r.email);
}
export function shapePackage(manifest) {
    return {
        files: (manifest?.files ?? []).map((f) => ({ filename: f.filename, purpose: f.purpose })),
        urls: manifest?.urls ?? []
    };
}
export function shapeMessage(msg, emailByUserId) {
    const { files, urls } = shapePackage(msg.packages?.[0]?.manifest);
    const authorId = msg.author_id == null ? "" : String(msg.author_id);
    return {
        author: authorId ? emailByUserId.get(authorId) ?? null : null,
        created_at: String(msg.created_at),
        label: msg.label ?? null,
        body: String(msg.body),
        files,
        urls
    };
}
export function toPublicWatchEvent(e, emailByUserId) {
    return {
        author: e.author_id ? emailByUserId.get(e.author_id) ?? null : null,
        created_at: e.created_at,
        label: e.label ?? null,
        body: e.body,
        files: [],
        urls: []
    };
}
const PUBLIC_REPO_URL = "https://www.npmjs.com/package/@immutabit-llc/vico";
export const USAGE = `vico — CLI thread + package exchange between coding-agent sessions.

Usage: vico <command> [options]

Setup (once per machine)
  login [--email EMAIL] [--local]    sign in via emailed code; --email/-e, --local stores creds in ./.vico (project-scoped)
  whoami                            show the email of the active session and the credentials file in use
  notify slack <connect|disconnect|status>
                                    connect/disconnect Slack threaded notifications, or show status

THREAD is the short slug shown by new/threads. Member commands require --thread (or -t) (slug only; a UUID is rejected).

Read
  threads                           list threads you belong to (with their slug)
  read --thread THREAD [--files DIR]
                                    show messages + collaborators; --files downloads attachments
  poll --thread THREAD [--since CURSOR] [--limit N]
                                    print new messages since your last poll (cursor saved per-thread); --limit N takes a bounded window
  watch --thread THREAD [--limit N] stream new messages until interrupted; --limit N first shows the newest N

Write
  new "<TITLE>" [--body TEXT] [--label TEXT] [--url URL ...] [--attach purpose:/path ...] [--add EMAIL ...]
                                    create a thread (prints JSON — capture .slug); one-shot: also add members and post a first message (with files)
                                    so the added members get the Slack notification immediately
  post "<BODY>" --thread THREAD [--label TEXT] [--url URL ...] [--attach purpose:/path ...]
                                    post a message, optionally with links/files
  add --thread THREAD --email EMAIL add an existing account to a thread (--thread/-t, --email/-e)

  help, --help, -h                  show this message
  version, --version, -v            print the vico version

Short flags: -t --thread, -e --email, -l --label, -u --url, -a --attach, -b --body, -f --files, -y --yes

Most output is JSON on stdout; prompts and progress go to stderr.`;
export function parseCliArgs(argv) {
    const [command, ...rest] = argv;
    if (command === undefined || command === "help" || command === "--help" || command === "-h") {
        return { command: "help" };
    }
    if (command === "version" || command === "--version" || command === "-v") {
        return { command: "version" };
    }
    if (command === "login") {
        const parsed = parseArgs({ args: rest, options: { email: { type: "string", short: "e" }, local: { type: "boolean" } } });
        return { command, email: parsed.values.email, local: parsed.values.local ?? false };
    }
    if (command === "whoami" || command === "threads") {
        return { command };
    }
    if (command === "new") {
        const parsed = parseArgs({
            args: rest,
            allowPositionals: true,
            options: {
                body: { type: "string", short: "b" },
                label: { type: "string", short: "l" },
                url: { type: "string", multiple: true, short: "u" },
                attach: { type: "string", multiple: true, short: "a" },
                add: { type: "string", multiple: true },
                "allow-unsafe-attach": { type: "boolean" }
            }
        });
        const urls = parsed.values.url ?? [];
        const attachments = (parsed.values.attach ?? []).map(parseAttachment);
        // A message is posted iff there's content for it; --label only decorates a
        // message, so it's meaningless without one.
        const willPost = parsed.values.body !== undefined || urls.length > 0 || attachments.length > 0;
        if (parsed.values.label !== undefined && !willPost) {
            throw new Error("--label requires a message: add --body, --url, or --attach");
        }
        return {
            command,
            title: requireString(parsed.positionals[0], "new requires a title: vico new \"<title>\""),
            body: parsed.values.body,
            label: parsed.values.label,
            urls,
            attachments,
            addEmails: parsed.values.add ?? [],
            allowUnsafeAttach: parsed.values["allow-unsafe-attach"] ?? false
        };
    }
    if (command === "post") {
        const parsed = parseArgs({
            args: rest,
            allowPositionals: true,
            options: {
                thread: { type: "string", short: "t" },
                label: { type: "string", short: "l" },
                url: { type: "string", multiple: true, short: "u" },
                attach: { type: "string", multiple: true, short: "a" },
                "allow-unsafe-attach": { type: "boolean" }
            }
        });
        return {
            command,
            body: requireString(parsed.positionals[0], "post requires a body: vico post \"<text>\""),
            label: parsed.values.label,
            threadId: requireString(parsed.values.thread, "post: --thread is required"),
            urls: parsed.values.url ?? [],
            attachments: (parsed.values.attach ?? []).map(parseAttachment),
            allowUnsafeAttach: parsed.values["allow-unsafe-attach"] ?? false
        };
    }
    if (command === "read") {
        const parsed = parseArgs({ args: rest, options: { thread: { type: "string", short: "t" }, files: { type: "string", short: "f" } } });
        return { command, threadId: requireString(parsed.values.thread, "read: --thread is required"), files: parsed.values.files };
    }
    if (command === "invite") {
        const parsed = parseArgs({ args: rest, options: { email: { type: "string", short: "e" }, thread: { type: "string", short: "t" }, "resend-email": { type: "boolean" } } });
        return { command, email: requireString(parsed.values.email, "--email is required"), threadId: parsed.values.thread, resendEmail: parsed.values["resend-email"] ?? false };
    }
    if (command === "add") {
        const parsed = parseArgs({ args: rest, options: { thread: { type: "string", short: "t" }, email: { type: "string", short: "e" } } });
        return {
            command,
            threadId: requireString(parsed.values.thread, "--thread is required"),
            email: requireString(parsed.values.email, "--email is required")
        };
    }
    if (command === "delete") {
        const parsed = parseArgs({ args: rest, options: { thread: { type: "string", short: "t" }, yes: { type: "boolean", short: "y" } } });
        return {
            command,
            threadId: requireString(parsed.values.thread, "--thread is required"),
            yes: parsed.values.yes ?? false
        };
    }
    if (command === "notify") {
        const parsed = parseArgs({ args: rest, allowPositionals: true, options: {} });
        if (parsed.positionals[0] !== "slack") {
            throw new Error("usage: vico notify slack <connect|disconnect|status>");
        }
        const action = parsed.positionals[1];
        if (action !== "connect" && action !== "disconnect" && action !== "status") {
            throw new Error("usage: vico notify slack <connect|disconnect|status>");
        }
        return { command, action };
    }
    if (command === "poll") {
        let rawPollValues;
        try {
            const parsed = parseArgs({ args: rest, options: {
                    thread: { type: "string", short: "t" }, since: { type: "string" }, limit: { type: "string" }
                } });
            rawPollValues = parsed.values;
        }
        catch (err) {
            // node:util parseArgs throws "ambiguous" when --limit is followed by a
            // negative number (e.g. --limit -1); normalise to our validation message.
            if (err instanceof Error && err.message.includes("'--limit'")) {
                throw new Error("--limit must be a positive integer");
            }
            throw err;
        }
        return {
            command,
            threadId: requireString(rawPollValues.thread, "poll: --thread is required"),
            since: rawPollValues.since,
            limit: parseLimit(rawPollValues.limit)
        };
    }
    if (command === "watch") {
        let rawWatchValues;
        try {
            const parsed = parseArgs({ args: rest, options: { thread: { type: "string", short: "t" }, limit: { type: "string" } } });
            rawWatchValues = parsed.values;
        }
        catch (err) {
            if (err instanceof Error && err.message.includes("'--limit'")) {
                throw new Error("--limit must be a positive integer");
            }
            throw err;
        }
        return { command, threadId: requireString(rawWatchValues.thread, "watch: --thread is required"), limit: parseLimit(rawWatchValues.limit) };
    }
    throw new Error(`Unknown command: ${command}. Run \`vico help\` to see available commands.`);
}
export async function runCli(argv) {
    const parsed = parseCliArgs(argv);
    if (parsed.command === "help") {
        return USAGE;
    }
    if (parsed.command === "version") {
        return `vico ${vicoVersion()}`;
    }
    if (parsed.command === "login") {
        let email = parsed.email ?? process.env.VICO_EMAIL;
        if (!email) {
            email = (await promptLine("Email: ")) || undefined;
        }
        if (!email) {
            throw new Error("An email is required to log in");
        }
        const auth = createPublicClient().auth;
        await requestOtp(auth, email);
        process.stderr.write(`A login code was sent to ${email}.\n`);
        // Code-first copy: the 0.4 email template no longer sends a magic link.
        // auth.ts/parseLoginInput still accepts a pasted link as a silent fallback.
        const input = await promptLine("Enter the 6-digit code from your email: ");
        if (parsed.local) {
            assertLocalAuthSafe();
            const path = localCredentialsPath();
            return confirmOtp(auth, email, input, (s) => saveSession(s, path));
        }
        await ensureAuthHome();
        return confirmOtp(auth, email, input);
    }
    if (parsed.command === "invite") {
        const { createAdminClient, invite, resendSender } = await import("./admin.js");
        const admin = createAdminClient();
        return invite({ admin: admin.auth.admin, data: admin, repoUrl: PUBLIC_REPO_URL, sendEmail: resendSender(process.env) }, { email: parsed.email, threadId: parsed.threadId, resendEmail: parsed.resendEmail });
    }
    if (parsed.command === "delete") {
        assertUuid(parsed.threadId);
        const { createAdminClient, deleteThread } = await import("./admin.js");
        const admin = createAdminClient();
        if (!parsed.yes) {
            // Service role bypasses RLS, so a null thread means it genuinely does not exist.
            const thread = await getThread(admin, parsed.threadId);
            if (!thread)
                throw new Error(`thread not found: ${parsed.threadId}`);
            const packages = await listPackageFiles(admin, parsed.threadId);
            const fileCount = packages.reduce((n, p) => n + (p.package_files ?? []).length, 0);
            throw new Error(`refusing to delete thread ${parsed.threadId} ("${thread.title}") with ${fileCount} file(s). ` +
                `Re-run with --yes to permanently delete.`);
        }
        const result = await deleteThread({ data: admin }, { threadId: parsed.threadId });
        if (result.status === "storage_failed") {
            throw new Error(`delete aborted: storage removal failed for ${result.failedFiles.length} file(s); ` +
                `thread NOT deleted (safe to retry): ` +
                result.failedFiles.map((f) => `${f.path} (${f.reason})`).join(", "));
        }
        return result;
    }
    if (parsed.command === "whoami") {
        // Local-only: decode the stored session's JWT (no network). Reports the email
        // baked into the token and which credentials file is active.
        const path = resolveCredentialsPath();
        const session = await loadSession(path);
        if (!session) {
            throw new Error(`not logged in: no credentials at ${path}. Run \`vico login\`.`);
        }
        const claims = decodeJwtPayload(session.access_token);
        const email = typeof claims?.email === "string" ? claims.email : undefined;
        return { email, credentials: path };
    }
    // Member commands below require a stored session.
    const client = await getMemberClient();
    if (parsed.command === "threads") {
        return shapeThreads(await listThreads(client));
    }
    if (parsed.command === "add") {
        const threadId = await resolveThread(client, parsed.threadId);
        const { status } = await addMemberByEmail(client, threadId, parsed.email);
        return { status, email: parsed.email };
    }
    if (parsed.command === "notify") {
        if (parsed.action === "connect") {
            const url = await slackConnectUrl(client);
            openBrowser(url); // best-effort; non-fatal
            return { connect_url: url };
        }
        if (parsed.action === "disconnect") {
            await slackDisconnect(client);
            return { ok: true, slack: "disconnected" };
        }
        return slackStatus(client);
    }
    if (parsed.command === "new") {
        return runNew(client, parsed);
    }
    if (parsed.command === "post") {
        const threadId = await resolveThread(client, parsed.threadId);
        const hasAttachments = parsed.urls.length > 0 || parsed.attachments.length > 0;
        const packageUpload = hasAttachments
            ? await buildPackageUpload({
                urls: parsed.urls,
                attachments: parsed.attachments,
                allowUnsafeAttach: parsed.allowUnsafeAttach
            })
            : undefined;
        await publishMessage(client, { threadId, body: parsed.body, label: parsed.label, packageUpload });
        return { ok: true };
    }
    if (parsed.command === "read") {
        const threadId = await resolveThread(client, parsed.threadId);
        const rawMessages = await pullThread(client, threadId);
        const rows = await listCollaborators(client, threadId);
        const emailByUserId = new Map(rows.map((c) => [c.user_id, c.email]));
        const collaborators = shapeCollaborators(rows);
        const messages = rawMessages.map((m) => shapeMessage(m, emailByUserId));
        if (!parsed.files)
            return { collaborators, messages };
        const result = await downloadThread(client, threadId, parsed.files, {
            writeFile: async (p, b) => { await writeFile(p, b); },
            mkdir: async (d) => { await mkdir(d, { recursive: true }); }
        });
        if (result.failed.length > 0) {
            throw new Error(`download incomplete: ${result.failed.map((f) => `${f.storage_path} (${f.reason})`).join(", ")}`);
        }
        return { collaborators, messages, downloaded: result.written };
    }
    if (parsed.command === "poll") {
        const threadId = await resolveThread(client, parsed.threadId);
        const rows = await listCollaborators(client, threadId);
        const emailByUserId = new Map(rows.map((c) => [c.user_id, c.email]));
        return runPoll(client, { slug: parsed.threadId, threadId, since: parsed.since, limit: parsed.limit }, emailByUserId);
    }
    if (parsed.command === "watch") {
        throw new Error("watch streams output; invoke it as the CLI entrypoint, not via runCli");
    }
    throw new Error(`unhandled command: ${parsed.command}`);
}
export async function runNew(client, opts) {
    const willPost = opts.body !== undefined || opts.urls.length > 0 || opts.attachments.length > 0;
    const hasAttachments = opts.urls.length > 0 || opts.attachments.length > 0;
    // Read + validate the package from local files FIRST, before any thread/member
    // writes. A bad path or unsafe extension is the most likely failure and is
    // purely local, so failing here leaves zero residue (no orphan thread/members).
    const packageUpload = willPost && hasAttachments
        ? await buildPackageUpload({ urls: opts.urls, attachments: opts.attachments, allowUnsafeAttach: opts.allowUnsafeAttach })
        : undefined;
    const thread = await createThread(client, opts.title);
    const added = [];
    const failed_adds = [];
    for (const email of opts.addEmails) {
        try {
            const { status } = await addMemberByEmail(client, thread.id, email);
            if (status === "no_such_user") {
                failed_adds.push({ email, error: "no account — owner must invite first" });
            }
            else {
                added.push(email); // "added" or "already_member"
            }
        }
        catch (error) {
            failed_adds.push({ email, error: error instanceof Error ? error.message : String(error) });
        }
    }
    let message = null;
    if (willPost) {
        message = await publishMessage(client, { threadId: thread.id, body: opts.body ?? "", label: opts.label, packageUpload });
    }
    const publicThread = { slug: thread.slug, title: thread.title };
    if (opts.addEmails.length === 0 && !willPost)
        return publicThread;
    return { thread: publicThread, added, failed_adds, message: message !== null ? { ok: true } : null };
}
export async function runPoll(client, opts, emailByUserId, loadCursor = loadThreadCursor, saveCursor = saveThreadCursor) {
    const explicit = opts.since !== undefined;
    const since = explicit ? opts.since : await loadCursor(opts.slug);
    const out = await listMessagesSince(client, opts.threadId, since, opts.limit);
    // Persist only in stored-cursor mode and only when something was emitted, so a
    // limited/empty poll never advances past unseen messages or clobbers state.
    if (!explicit && out.messages.length > 0 && out.cursor) {
        await saveCursor(opts.slug, out.cursor);
    }
    return {
        messages: out.messages.map((m) => shapeMessage(m, emailByUserId)),
        cursor: out.cursor
    };
}
// Fallback poller for watch. Starts from `startCursor` (a baseline captured at
// command start) so it emits every message since the watch began — including any
// that arrive while Realtime is still trying to subscribe — without replaying the
// thread's prior history.
export function makeWatchPoll(collab, threadId, startCursor) {
    let cursor = startCursor;
    return async () => {
        const out = await listMessagesSince(collab, threadId, cursor);
        cursor = out.cursor;
        return out.messages.map((m) => ({
            id: m.id, thread_id: m.thread_id, author_id: String(m.author_id ?? ""),
            label: m.label ?? null, body: m.body, created_at: m.created_at
        }));
    };
}
export async function runWatch(parsed, write = (l) => process.stdout.write(l), notify = (l) => process.stderr.write(l)) {
    const client = await getMemberRealtimeClient();
    const collab = client;
    const threadId = await resolveThread(collab, parsed.threadId);
    const token = (await client.auth.getSession()).data.session?.access_token;
    const collabRows = await listCollaborators(collab, threadId);
    const emailByUserId = new Map(collabRows.map((c) => [c.user_id, c.email]));
    // With --limit N, show the newest N existing messages oldest->newest and baseline
    // the stream at the newest emitted row. Without --limit, baseline at current
    // latest and emit no history (unchanged behavior).
    const seed = await listMessagesSince(collab, threadId, undefined, parsed.limit);
    if (parsed.limit !== undefined) {
        for (const m of seed.messages) {
            const e = {
                id: String(m.id), thread_id: String(m.thread_id),
                author_id: String(m.author_id ?? ""),
                label: m.label ?? null,
                body: m.body, created_at: m.created_at
            };
            write(`${JSON.stringify(toPublicWatchEvent(e, emailByUserId))}\n`);
        }
    }
    return watchThread(client.realtime, threadId, (e) => write(`${JSON.stringify(toPublicWatchEvent(e, emailByUserId))}\n`), {
        token,
        onDegrade: () => notify("vico watch: realtime unavailable, falling back to polling\n"),
        pollFallback: makeWatchPoll(collab, threadId, seed.cursor)
    });
}
// Member commands take a slug only. A required, explicit --thread removes the
// global-thread footgun; a UUID is rejected to keep the public surface slug-only.
export async function resolveThread(client, slug) {
    if (!slug)
        throw new Error("--thread is required");
    if (isUuid(slug)) {
        throw new Error("--thread takes a thread slug (shown by `vico new`/`vico threads`), not a UUID");
    }
    const thread = await findThread(client, slug);
    if (!thread)
        throw new Error("Thread not found or you are not a member");
    return thread.id;
}
function parseAttachment(value) {
    const separatorIndex = value.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
        throw new Error("--attach must use purpose:/path/to/file");
    }
    return {
        purpose: value.slice(0, separatorIndex),
        path: value.slice(separatorIndex + 1)
    };
}
// Best-effort browser open for `notify slack connect`; never throws (the URL is
// already returned as JSON on stdout, so a headless failure is harmless).
function openBrowser(url) {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    try {
        spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => { }).unref();
    }
    catch {
        // ignore -- opening the browser is a convenience, not a requirement
    }
}
function requireString(value, message) {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(message);
    }
    return value;
}
function parseLimit(raw) {
    if (raw === undefined)
        return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
        throw new Error("--limit must be a positive integer");
    }
    return n;
}
function isMainModule() {
    const entry = process.argv[1];
    if (!entry)
        return false;
    try {
        return import.meta.url === pathToFileURL(realpathSync(entry)).href;
    }
    catch {
        return false;
    }
}
if (isMainModule()) {
    const argv = process.argv.slice(2);
    if (argv[0] === "watch") {
        Promise.resolve()
            .then(() => runWatch(parseCliArgs(argv)))
            .then((stop) => {
            process.on("SIGINT", () => { void stop().then(() => process.exit(0)); });
        })
            .catch((error) => {
            process.stderr.write(`${formatDiagnostics(error, argv.join(" "))}\n`);
            process.exitCode = 1;
        });
    }
    else {
        runCli(argv)
            .then((result) => {
            // help returns raw text; data commands return JSON.
            process.stdout.write(typeof result === "string" ? `${result}\n` : `${JSON.stringify(result, null, 2)}\n`);
        })
            .catch((error) => {
            process.stderr.write(`${formatDiagnostics(error, argv.join(" "))}\n`);
            process.exitCode = 1;
        });
    }
}
//# sourceMappingURL=cli.js.map