import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
const README_TEXT = "vico stores credentials here. Do not read or share these files.\n";
function authHome(env) {
    return env.VICO_HOME || join(homedir(), ".vico");
}
// Idempotent: writes the passive guard files alongside the global session.
// Async (fs/promises) to match credentials.ts/thread-state.ts style.
export async function ensureAuthHome(env = process.env) {
    const home = authHome(env);
    await mkdir(home, { recursive: true });
    await writeFile(join(home, ".gitignore"), "*\n");
    await writeFile(join(home, "README"), README_TEXT);
}
function git(args, cwd) {
    try {
        const out = execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString();
        return { ok: true, out };
    }
    catch {
        return { ok: false, out: "" };
    }
}
// 4-step guard (spec §1). Order is load-bearing: refuse a tracked file BEFORE
// writing anything; write .vico/.gitignore before the credential file; require an
// ENCLOSING ignore (the just-written .vico/.gitignore can't protect .vico/ at the
// parent level). Outside a git worktree, skip the enclosing check.
export function assertLocalAuthSafe(cwd = process.cwd()) {
    const inWorktree = git(["rev-parse", "--is-inside-work-tree"], cwd).out.trim() === "true";
    if (inWorktree) {
        // Step 1: refuse if the credential file is already tracked.
        if (git(["ls-files", "--error-unmatch", ".vico/credentials.json"], cwd).ok) {
            throw new Error("vico login --local: .vico/credentials.json is git-tracked. Untrack it before storing local credentials.");
        }
    }
    // Step 2: write .vico/.gitignore (*) before any credential bytes.
    const vicoDir = join(cwd, ".vico");
    mkdirSync(vicoDir, { recursive: true });
    writeFileSync(join(vicoDir, ".gitignore"), "*\n");
    if (inWorktree) {
        // Step 3: require .vico/ ignored by a rule OUTSIDE .vico/.gitignore.
        // git check-ignore -v always emits POSIX (forward-slash) source paths, even on
        // Windows — so match the literal, not a path.join() that uses the OS separator.
        const isIgnored = () => {
            const ci = git(["check-ignore", "-v", ".vico"], cwd);
            return ci.ok && ci.out.length > 0 && !ci.out.includes(".vico/.gitignore");
        };
        if (!isIgnored()) {
            // The user already authenticated; don't bounce them for a one-line gitignore
            // edit we can make ourselves. Append `.vico/` to the repo root .gitignore.
            const root = git(["rev-parse", "--show-toplevel"], cwd).out.trim();
            if (root) {
                const gi = join(root, ".gitignore");
                const prefix = existsSync(gi) && !readFileSync(gi, "utf8").endsWith("\n") ? "\n" : "";
                appendFileSync(gi, `${prefix}.vico/\n`);
            }
            if (!isIgnored()) {
                throw new Error("vico login --local: .vico/ is not ignored by this repo. Add `.vico/` to the repo's .gitignore, then retry.");
            }
        }
    }
}
//# sourceMappingURL=local-auth.js.map