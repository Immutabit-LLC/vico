import { type CollaborationClient } from "./service.js";
export interface DownloadDeps {
    writeFile: (path: string, bytes: Uint8Array) => Promise<void>;
    mkdir: (dir: string) => Promise<void>;
}
export interface DownloadResult {
    written: string[];
    failed: {
        storage_path: string;
        reason: string;
    }[];
}
export declare function downloadThread(client: CollaborationClient, threadId: string, outRoot: string, deps: DownloadDeps): Promise<DownloadResult>;
