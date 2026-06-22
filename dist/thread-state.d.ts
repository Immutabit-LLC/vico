export declare function threadStatePath(slug: string, cwd?: string): string;
export declare function loadThreadCursor(slug: string, cwd?: string): Promise<string | undefined>;
export declare function saveThreadCursor(slug: string, cursor: string, cwd?: string): Promise<void>;
