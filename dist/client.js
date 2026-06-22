import { createClient } from "@supabase/supabase-js";
import { resolvePublicConfig } from "./config.js";
import { loadSession, saveSession, resolveCredentialsPath } from "./credentials.js";
export function createPublicClient(env = process.env) {
    const { url, anonKey } = resolvePublicConfig(env);
    return createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: true }
    });
}
// Load the stored session into a public client and persist any token rotation.
// Returns the concrete client so realtime callers can reach .realtime/.channel.
async function hydrateMemberClient(env) {
    const client = createPublicClient(env);
    const path = resolveCredentialsPath();
    const session = await loadSession(path);
    if (!session) {
        throw new Error("Not logged in. Run `login` first.");
    }
    client.auth.onAuthStateChange((event, current) => {
        if (event === "TOKEN_REFRESHED" && current) {
            void saveSession({ access_token: current.access_token, refresh_token: current.refresh_token }, path);
        }
    });
    const { error } = await client.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
    });
    if (error) {
        throw new Error(`Session expired or invalid. Run \`login\` again. (${error.message})`);
    }
    return client;
}
// Member commands: load the stored session, hydrate it, and persist any rotation.
// SupabaseClient structurally satisfies the narrow CollaborationClient interface.
export async function getMemberClient(env = process.env) {
    const client = await hydrateMemberClient(env);
    return client;
}
// Realtime-capable accessor: returns the concrete SupabaseClient so callers can
// reach .realtime/.channel directly.
export async function getMemberRealtimeClient(env = process.env) {
    return hydrateMemberClient(env);
}
//# sourceMappingURL=client.js.map