import type { Readable, Writable } from "node:stream";
export declare function promptLine(question: string, input?: Readable, output?: Writable): Promise<string>;
