export declare const MAX_ATTACHMENT_BYTES: number;
export type AttachmentPurpose = "payload" | "screenshot" | "error" | "spec" | "plan" | "log" | "other" | string;
export interface AttachmentInput {
    path: string;
    purpose: AttachmentPurpose;
}
export interface PackageFileManifest {
    filename: string;
    purpose: AttachmentPurpose;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
}
export interface PackageManifest {
    urls: string[];
    files: PackageFileManifest[];
}
export interface BuildPackageUploadInput {
    urls?: string[];
    attachments?: AttachmentInput[];
    allowUnsafeAttach?: boolean;
}
export interface PackageUploadSource {
    path: string;
}
export interface PackageUpload {
    manifest: PackageManifest;
    sources: PackageUploadSource[];
}
interface AttachmentStat {
    isSymbolicLink(): boolean;
    isFile(): boolean;
    size: number;
}
interface BuildPackageUploadDeps {
    lstat?: (path: string) => Promise<AttachmentStat>;
    readFile?: (path: string) => Promise<Uint8Array>;
}
export declare function buildPackageUpload(input: BuildPackageUploadInput, deps?: BuildPackageUploadDeps): Promise<PackageUpload>;
export {};
