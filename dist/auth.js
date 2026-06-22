import { saveSession as defaultSave } from "./credentials.js";
// Supabase's email can deliver either a 6-digit code ({{ .Token }}) or a magic
// link ({{ .ConfirmationURL }} / token hash) depending on the project's email
// template. Accept both so login works regardless of how the email is configured.
export function parseLoginInput(raw) {
    const input = raw.trim();
    if (/^\d{6}$/.test(input)) {
        return { kind: "code", token: input };
    }
    return { kind: "link", tokenHash: extractTokenHash(input) };
}
// A magic-link value may be the full verify URL (…/verify?token=<hash>&type=…,
// or token_hash=<hash>) or just the bare hash.
function extractTokenHash(input) {
    const match = input.match(/[?&](?:token_hash|token)=([^&\s]+)/);
    return match ? decodeURIComponent(match[1]) : input;
}
// Step 1 of login: ask Supabase to email a one-time code/link. shouldCreateUser:false
// (nested under options, per supabase-js) keeps signup closed/invite-only.
export async function requestOtp(client, email) {
    const { error } = await client.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) {
        throw new Error(error.message);
    }
}
// Step 2 of login: exchange the pasted code OR magic-link for a session and persist it.
export async function confirmOtp(client, email, raw, save = defaultSave) {
    const parsed = parseLoginInput(raw);
    const { data, error } = parsed.kind === "code"
        ? await client.verifyOtp({ email, token: parsed.token, type: "email" })
        : await client.verifyOtp({ token_hash: parsed.tokenHash, type: "magiclink" });
    if (error) {
        throw new Error(error.message);
    }
    if (!data.session) {
        throw new Error("Verification returned no session");
    }
    await save({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
    });
    return { email };
}
//# sourceMappingURL=auth.js.map