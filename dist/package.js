import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { sanitizeFilename } from "./filename.js";
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const DEFAULT_MIME_TYPES = new Map([
    [".txt", "text/plain"],
    [".md", "text/markdown"],
    [".json", "application/json"],
    [".csv", "text/csv"],
    [".log", "text/plain"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".webp", "image/webp"],
    [".js", "text/javascript"],
    [".jsx", "text/javascript"],
    [".ts", "text/typescript"],
    [".tsx", "text/typescript"],
    [".mjs", "text/javascript"],
    [".cjs", "text/javascript"],
    [".py", "text/x-python"],
    [".cs", "text/x-csharp"],
    [".sh", "text/x-shellscript"],
    [".sql", "application/sql"],
    [".yaml", "application/yaml"],
    [".yml", "application/yaml"],
    [".toml", "application/toml"],
    [".xml", "application/xml"],
    [".html", "text/html"],
    [".css", "text/css"]
]);
export async function buildPackageUpload(input, deps = {}) {
    const read = deps.readFile ?? readFile;
    const stat = deps.lstat ?? lstat;
    const files = [];
    const sources = [];
    const seenFilenames = new Set();
    for (const attachment of input.attachments ?? []) {
        const filename = sanitizeFilename(basename(attachment.path));
        if (seenFilenames.has(filename)) {
            throw new Error(`duplicate attachment filename: ${filename}`);
        }
        seenFilenames.add(filename);
        const metadata = await stat(attachment.path);
        if (metadata.isSymbolicLink()) {
            throw new Error(`attachment is a symlink: ${attachment.path}`);
        }
        if (!metadata.isFile()) {
            throw new Error(`attachment is not a regular file: ${attachment.path}`);
        }
        if (metadata.size > MAX_ATTACHMENT_BYTES) {
            throw new Error(`attachment exceeds maximum attachment size of ${MAX_ATTACHMENT_BYTES} bytes: ${filename}`);
        }
        const mimeType = detectMimeType(filename, input.allowUnsafeAttach ?? false);
        const bytes = await read(attachment.path);
        if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
            throw new Error(`attachment exceeds maximum attachment size of ${MAX_ATTACHMENT_BYTES} bytes: ${filename}`);
        }
        files.push({
            filename,
            purpose: attachment.purpose,
            mimeType,
            sizeBytes: bytes.byteLength,
            sha256: createHash("sha256").update(bytes).digest("hex")
        });
        sources.push({ path: attachment.path });
    }
    return {
        manifest: {
            urls: input.urls ?? [],
            files
        },
        sources
    };
}
function detectMimeType(filename, allowUnsafeAttach) {
    const extension = extname(filename).toLowerCase();
    const mimeType = DEFAULT_MIME_TYPES.get(extension);
    if (mimeType) {
        return mimeType;
    }
    if (allowUnsafeAttach) {
        return "application/octet-stream";
    }
    throw new Error(`unsupported attachment extension "${extension}" for ${filename}; pass --allow-unsafe-attach to send it anyway`);
}
//# sourceMappingURL=package.js.map