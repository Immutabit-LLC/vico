import { type SupabaseClient } from "@supabase/supabase-js";
import type { CollaborationClient } from "./service.js";
export declare function createPublicClient(env?: NodeJS.ProcessEnv): SupabaseClient;
export declare function getMemberClient(env?: NodeJS.ProcessEnv): Promise<CollaborationClient>;
export declare function getMemberRealtimeClient(env?: NodeJS.ProcessEnv): Promise<SupabaseClient>;
