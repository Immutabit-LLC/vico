import { PACKAGE_BUCKET, listPackageFiles } from "./service.js";
import { assertUuid } from "./uuid.js";
import { sanitizeFilename, safeJoin } from "./filename.js";
export async function downloadThread(client, threadId, outRoot, deps) {
    assertUuid(threadId);
    const packages = await listPackageFiles(client, threadId);
    const written = [];
    const failed = [];
    // Flat output: no UUID path segments. A basename can repeat across packages
    // (per-package upload validation only dedupes within one package), so on a
    // collision append -2, -3, … before the extension. Track the actual OUTPUT
    // names (not the originals) and probe until one is free, so a generated `-2`
    // can't itself overwrite a real attachment already named that.
    const usedNames = new Set();
    const uniqueName = (safeName) => {
        let candidate = safeName;
        for (let i = 2; usedNames.has(candidate); i++) {
            candidate = safeName.replace(/(\.[^.]*)?$/, `-${i}$&`);
        }
        usedNames.add(candidate);
        return candidate;
    };
    for (const pkg of packages) {
        for (const file of pkg.package_files ?? []) {
            try {
                const outName = uniqueName(sanitizeFilename(file.filename));
                const dest = safeJoin(outRoot, outName);
                const { data, error } = await client.storage.from(PACKAGE_BUCKET).download(file.storage_path);
                if (error || !data) {
                    failed.push({ storage_path: file.storage_path, reason: error?.message ?? "missing object" });
                    continue;
                }
                await deps.mkdir(outRoot);
                await deps.writeFile(dest, new Uint8Array(await data.arrayBuffer()));
                written.push(outName);
            }
            catch (e) {
                failed.push({ storage_path: file.storage_path, reason: e.message });
            }
        }
    }
    return { written, failed };
}
//# sourceMappingURL=download.js.map