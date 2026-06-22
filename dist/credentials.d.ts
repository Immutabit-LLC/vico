export interface StoredSession {
    access_token: string;
    refresh_token: string;
}
export declare function credentialsPath(env?: NodeJS.ProcessEnv): string;
export declare function localCredentialsPath(cwd?: string): string;
export declare function resolveCredentialsPath(cwd?: string, env?: NodeJS.ProcessEnv): string;
export declare function saveSession(session: StoredSession, path?: string): Promise<void>;
export declare function decodeJwtPayload(token: string): Record<string, unknown> | null;
export declare function loadSession(path?: string): Promise<StoredSession | null>;
