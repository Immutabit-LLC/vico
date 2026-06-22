#!/usr/bin/env node
import { type AttachmentInput } from "./package.js";
import { type CollaborationClient } from "./service.js";
import { type WatchEvent } from "./watch.js";
interface ManifestFile {
    filename: string;
    purpose: string;
}
interface ManifestLike {
    files?: ManifestFile[];
    urls?: string[];
}
interface MessageWithPackages {
    author_id?: unknown;
    label?: unknown;
    body: unknown;
    created_at: unknown;
    packages?: {
        manifest?: ManifestLike;
    }[] | null;
}
export interface PublicMessage {
    author: string | null;
    created_at: string;
    label: string | null;
    body: string;
    files: ManifestFile[];
    urls: string[];
}
export declare function shapeThreads(rows: {
    slug: string;
    title: string;
}[]): {
    slug: string;
    title: string;
}[];
export declare function shapeCollaborators(rows: {
    email: string;
}[]): string[];
export declare function shapePackage(manifest: ManifestLike | undefined): {
    files: ManifestFile[];
    urls: string[];
};
export declare function shapeMessage(msg: MessageWithPackages, emailByUserId: Map<string, string>): PublicMessage;
export declare function toPublicWatchEvent(e: WatchEvent, emailByUserId: Map<string, string>): PublicMessage;
export declare const USAGE = "vico \u2014 CLI thread + package exchange between coding-agent sessions.\n\nUsage: vico <command> [options]\n\nSetup (once per machine)\n  login [--email EMAIL] [--local]    sign in via emailed code; --email/-e, --local stores creds in ./.vico (project-scoped)\n  whoami                            show the email of the active session and the credentials file in use\n  notify slack <connect|disconnect|status>\n                                    connect/disconnect Slack threaded notifications, or show status\n\nTHREAD is the short slug shown by new/threads. Member commands require --thread (or -t) (slug only; a UUID is rejected).\n\nRead\n  threads                           list threads you belong to (with their slug)\n  read --thread THREAD [--files DIR]\n                                    show messages + collaborators; --files downloads attachments\n  poll --thread THREAD [--since CURSOR] [--limit N]\n                                    print new messages since your last poll (cursor saved per-thread); --limit N takes a bounded window\n  watch --thread THREAD [--limit N] stream new messages until interrupted; --limit N first shows the newest N\n\nWrite\n  new \"<TITLE>\" [--body TEXT] [--label TEXT] [--url URL ...] [--attach purpose:/path ...] [--add EMAIL ...]\n                                    create a thread (prints JSON \u2014 capture .slug); one-shot: also add members and post a first message (with files)\n                                    so the added members get the Slack notification immediately\n  post \"<BODY>\" --thread THREAD [--label TEXT] [--url URL ...] [--attach purpose:/path ...]\n                                    post a message, optionally with links/files\n  add --thread THREAD --email EMAIL add an existing account to a thread (--thread/-t, --email/-e)\n\n  help, --help, -h                  show this message\n  version, --version, -v            print the vico version\n\nShort flags: -t --thread, -e --email, -l --label, -u --url, -a --attach, -b --body, -f --files, -y --yes\n\nMost output is JSON on stdout; prompts and progress go to stderr.";
type ParsedCommand = {
    command: "help";
} | {
    command: "version";
} | {
    command: "login";
    email?: string;
    local: boolean;
} | {
    command: "whoami";
} | {
    command: "threads";
} | {
    command: "new";
    title: string;
    body?: string;
    label?: string;
    urls: string[];
    attachments: AttachmentInput[];
    addEmails: string[];
    allowUnsafeAttach: boolean;
} | {
    command: "post";
    threadId: string;
    body: string;
    label?: string;
    urls: string[];
    attachments: AttachmentInput[];
    allowUnsafeAttach: boolean;
} | {
    command: "read";
    threadId: string;
    files?: string;
} | {
    command: "poll";
    threadId: string;
    since?: string;
    limit?: number;
} | {
    command: "watch";
    threadId: string;
    limit?: number;
} | {
    command: "invite";
    email: string;
    threadId?: string;
    resendEmail: boolean;
} | {
    command: "add";
    threadId: string;
    email: string;
} | {
    command: "notify";
    action: "connect" | "disconnect" | "status";
} | {
    command: "delete";
    threadId: string;
    yes: boolean;
};
export declare function parseCliArgs(argv: string[]): ParsedCommand;
export declare function runCli(argv: string[]): Promise<unknown>;
export interface NewOptions {
    title: string;
    body?: string;
    label?: string;
    urls: string[];
    attachments: AttachmentInput[];
    addEmails: string[];
    allowUnsafeAttach: boolean;
}
export declare function runNew(client: CollaborationClient, opts: NewOptions): Promise<unknown>;
export declare function runPoll(client: CollaborationClient, opts: {
    slug: string;
    threadId: string;
    since?: string;
    limit?: number;
}, emailByUserId: Map<string, string>, loadCursor?: (slug: string) => Promise<string | undefined>, saveCursor?: (slug: string, cursor: string) => Promise<void>): Promise<{
    messages: PublicMessage[];
    cursor: string | undefined;
}>;
export declare function makeWatchPoll(collab: CollaborationClient, threadId: string, startCursor?: string): () => Promise<WatchEvent[]>;
export declare function runWatch(parsed: {
    threadId: string;
    limit?: number;
}, write?: (line: string) => void, notify?: (l: string) => void): Promise<() => Promise<void>>;
export declare function resolveThread(client: CollaborationClient, slug: string): Promise<string>;
export {};
