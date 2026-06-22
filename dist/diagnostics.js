import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Read the shipped package version (dist/diagnostics.js -> ../package.json).
// Used by the diagnostics block and the `version` command.
export function vicoVersion() {
    try {
        const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
        return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "unknown";
    }
    catch {
        return "unknown";
    }
}
// A self-contained block a user can copy or screenshot when reporting a problem:
// the error plus enough environment to debug it without a back-and-forth.
export function formatDiagnostics(error, command) {
    const message = error instanceof Error ? error.message : String(error);
    return [
        `vico error: ${message}`,
        "",
        "--- diagnostics (copy or screenshot this for support) ---",
        `  vico      ${vicoVersion()}`,
        `  node      ${process.version}`,
        `  platform  ${process.platform} ${process.arch}`,
        `  command   vico ${command}`,
        `  error     ${message}`,
        "---------------------------------------------------------"
    ].join("\n");
}
//# sourceMappingURL=diagnostics.js.map