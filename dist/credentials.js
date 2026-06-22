import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
export function credentialsPath(env = process.env) {
    const home = env.VICO_HOME || join(homedir(), ".vico");
    return join(home, "credentials.json");
}
export function localCredentialsPath(cwd = process.cwd()) {
    return join(cwd, ".vico", "credentials.json");
}
// Local project credentials take precedence over the global session when present.
// This is the only way a credential file lives inside a repo (see local-auth.ts).
export function resolveCredentialsPath(cwd = process.cwd(), env = process.env) {
    const local = localCredentialsPath(cwd);
    return existsSync(local) ? local : credentialsPath(env);
}
export async function saveSession(session, path = credentialsPath()) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(session, null, 2), { mode: 0o600 });
    await chmod(path, 0o600);
}
// Decode a JWT's payload (middle segment) WITHOUT verifying the signature. We
// only read claims from our own locally-stored session for display (whoami);
// never trust this for an authorization decision — RLS is the boundary.
export function decodeJwtPayload(token) {
    const seg = token.split(".")[1];
    if (!seg)
        return null;
    try {
        return JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
    }
    catch {
        return null;
    }
}
export async function loadSession(path = credentialsPath()) {
    try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON.parse(raw);
        if (!parsed.access_token || !parsed.refresh_token) {
            return null;
        }
        return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}
//# sourceMappingURL=credentials.js.map