export interface WatchEvent {
    id: string;
    thread_id: string;
    author_id: string;
    label: string | null;
    body: string;
    created_at: string;
}
export interface RealtimeChannelLike {
    on(type: "postgres_changes", filter: {
        event: "INSERT";
        schema: string;
        table: string;
        filter: string;
    }, callback: (payload: {
        new: Record<string, unknown>;
    }) => void): RealtimeChannelLike;
    subscribe(callback?: (status: string, err?: Error) => void): RealtimeChannelLike;
    unsubscribe(): Promise<unknown>;
}
export interface RealtimeClientLike {
    setAuth(token?: string): Promise<void> | void;
    channel(name: string): RealtimeChannelLike;
}
export interface WatchOptions {
    token?: string;
    pollIntervalMs?: number;
    subscribeTimeoutMs?: number;
    pollFallback: () => Promise<WatchEvent[]>;
    onDegrade?: () => void;
}
export declare function watchThread(rt: RealtimeClientLike, threadId: string, onEvent: (e: WatchEvent) => void, opts: WatchOptions): Promise<() => Promise<void>>;
