// src/config.ts
import { BAKED_CONFIG } from "./baked-config.js";
export function resolvePublicConfig(env, baked = BAKED_CONFIG) {
    const url = env.SUPABASE_URL || baked.url;
    const anonKey = env.SUPABASE_ANON_KEY || baked.anonKey;
    if (!url) {
        throw new Error("SUPABASE_URL is required (set it in the environment or via the release build)");
    }
    if (!anonKey) {
        throw new Error("SUPABASE_ANON_KEY is required (set it in the environment or via the release build)");
    }
    return { url, anonKey };
}
//# sourceMappingURL=config.js.map