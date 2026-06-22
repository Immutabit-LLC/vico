import { type StoredSession } from "./credentials.js";
export interface OtpAuthClient {
    signInWithOtp(creds: {
        email: string;
        options: {
            shouldCreateUser: boolean;
        };
    }): Promise<{
        data: unknown;
        error: {
            message: string;
        } | null;
    }>;
    verifyOtp(params: {
        email: string;
        token: string;
        type: "email";
    } | {
        token_hash: string;
        type: "magiclink";
    }): Promise<{
        data: {
            session: {
                access_token: string;
                refresh_token: string;
            } | null;
        };
        error: {
            message: string;
        } | null;
    }>;
}
export type LoginInput = {
    kind: "code";
    token: string;
} | {
    kind: "link";
    tokenHash: string;
};
export declare function parseLoginInput(raw: string): LoginInput;
export declare function requestOtp(client: OtpAuthClient, email: string): Promise<void>;
export declare function confirmOtp(client: OtpAuthClient, email: string, raw: string, save?: (session: StoredSession) => Promise<void>): Promise<{
    email: string;
}>;
