import type { PackageUpload } from "./package.js";
export declare const PACKAGE_BUCKET = "thread-packages";
export interface MessageCursor {
    created_at: string;
    id: string;
}
export declare class CursorError extends Error {
    constructor(message: string);
}
export declare function encodeCursor(cursor: MessageCursor): string;
export declare function decodeCursor(token: string): MessageCursor;
type QueryResult<T> = {
    data: T;
    error: Error | null;
};
type MaybePromise<T> = T | PromiseLike<T>;
interface InsertBuilder<T> {
    select(columns?: string): {
        single(): QueryResult<T>;
    };
}
interface QueryBuilder<T> extends PromiseLike<QueryResult<T[]>> {
    eq(column: string, value: string): QueryBuilder<T>;
    or(filter: string): QueryBuilder<T>;
    order(column: string, options: {
        ascending: boolean;
    }): QueryBuilder<T>;
    limit(count: number): QueryBuilder<T>;
}
interface DeleteBuilder<T> {
    eq(column: string, value: string): MaybePromise<QueryResult<T[] | null>>;
}
interface TableClient<T> {
    insert(rows: unknown): InsertBuilder<T>;
    select(columns?: string): QueryBuilder<T>;
    delete(): DeleteBuilder<T>;
}
interface DownloadBody {
    arrayBuffer(): Promise<ArrayBuffer>;
}
interface StorageBucket {
    upload(path: string, body: Uint8Array, options: {
        contentType?: string;
        upsert?: boolean;
    }): MaybePromise<QueryResult<{
        path: string;
    }>>;
    download(path: string): MaybePromise<QueryResult<DownloadBody | null>>;
    remove(paths: string[]): MaybePromise<QueryResult<{
        name: string;
    }[] | null>>;
}
export interface CollaborationClient {
    from<T = Record<string, unknown>>(table: string): TableClient<T>;
    rpc<T = unknown>(fn: string, args: Record<string, unknown>): MaybePromise<QueryResult<T>>;
    functions: {
        invoke<T = unknown>(name: string, opts?: {
            body?: unknown;
        }): MaybePromise<{
            data: T;
            error: {
                message: string;
            } | null;
        }>;
    };
    storage: {
        from(bucket: string): StorageBucket;
    };
}
export interface PublishMessageInput {
    threadId: string;
    body: string;
    label?: string;
    packageUpload?: PackageUpload;
    readFile?: (path: string) => Promise<Uint8Array>;
}
export declare function createThread(client: CollaborationClient, title: string): Promise<{
    id: string;
    title: string;
    slug: string;
}>;
export declare function publishMessage(client: CollaborationClient, input: PublishMessageInput): Promise<Record<string, unknown>>;
export interface PackageFileRow {
    storage_path: string;
    filename: string;
}
export interface PackageWithFiles {
    id: string;
    package_files: PackageFileRow[];
}
export declare function listPackageFiles(client: CollaborationClient, threadId: string): Promise<PackageWithFiles[]>;
export interface MessageRow {
    id: string;
    thread_id: string;
    author_id?: string;
    label?: string | null;
    body: string;
    created_at: string;
    [key: string]: unknown;
}
export declare function pullThread(client: CollaborationClient, threadId: string): Promise<unknown[]>;
export declare function listMessagesSince(client: CollaborationClient, threadId: string, cursor?: string, limit?: number): Promise<{
    messages: MessageRow[];
    cursor: string | undefined;
}>;
export declare function listThreads(client: CollaborationClient): Promise<unknown[]>;
export declare function getThread(client: CollaborationClient, threadId: string): Promise<{
    id: string;
    title: string;
    slug?: string;
} | null>;
export declare function findThread(client: CollaborationClient, handle: string): Promise<{
    id: string;
    title: string;
    slug: string;
} | null>;
export type AddMemberStatus = "added" | "already_member" | "no_such_user";
export declare function addMemberByEmail(client: CollaborationClient, threadId: string, email: string): Promise<{
    status: AddMemberStatus;
}>;
export interface Collaborator {
    user_id: string;
    email: string;
    role: string;
}
export declare function listCollaborators(client: CollaborationClient, threadId: string): Promise<Collaborator[]>;
export interface SlackStatus {
    connected: boolean;
    team_id: string | null;
    channel_id: string | null;
    updated_at: string | null;
}
export declare function slackConnectUrl(client: CollaborationClient): Promise<string>;
export declare function slackStatus(client: CollaborationClient): Promise<SlackStatus>;
export declare function slackDisconnect(client: CollaborationClient): Promise<void>;
export declare function deleteThreadRow(client: CollaborationClient, threadId: string): Promise<void>;
export {};
