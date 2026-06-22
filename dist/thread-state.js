import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
export function threadStatePath(slug, cwd = process.cwd()) {
    return join(cwd, ".vico", "threads", `${slug}.json`);
}
export async function loadThreadCursor(slug, cwd) {
    try {
        const raw = await readFile(threadStatePath(slug, cwd), "utf8");
        return JSON.parse(raw).cursor;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return undefined;
        throw error;
    }
}
export async function saveThreadCursor(slug, cursor, cwd) {
    const path = threadStatePath(slug, cwd);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ cursor }, null, 2), { mode: 0o600 });
    await chmod(path, 0o600);
}
//# sourceMappingURL=thread-state.js.map