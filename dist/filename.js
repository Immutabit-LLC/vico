import { basename, resolve, sep } from "node:path";
export function sanitizeFilename(name) {
    // eslint-disable-next-line no-control-regex
    const hasControl = /[\x00-\x1f\x7f]/.test(name);
    if (name.length === 0 ||
        name === "." ||
        name === ".." ||
        name.includes("/") ||
        name.includes("\\") ||
        name.startsWith("/") ||
        hasControl ||
        basename(name) !== name) {
        throw new Error(`unsafe filename: ${JSON.stringify(name)}`);
    }
    return name;
}
export function safeJoin(outRoot, ...segments) {
    const root = resolve(outRoot);
    const full = resolve(root, ...segments);
    if (full !== root && !full.startsWith(root + sep)) {
        throw new Error(`path escapes output directory: ${full}`);
    }
    return full;
}
//# sourceMappingURL=filename.js.map