function toEvent(r) {
    return {
        id: String(r.id),
        thread_id: String(r.thread_id),
        author_id: String(r.author_id),
        label: r.label ?? null,
        body: String(r.body),
        created_at: String(r.created_at)
    };
}
export async function watchThread(rt, threadId, onEvent, opts) {
    await rt.setAuth(opts.token);
    let timer;
    let polling = false;
    // Public channel: postgres_changes still honors the `messages` table RLS
    // (is_thread_member) for row delivery, given setAuth() above provides the user
    // JWT. A private channel would additionally require a realtime.messages
    // authorization policy we do not define, so its join would be rejected.
    // Once degraded, polling is the single source of truth: ignore any late
    // Realtime delivery (e.g. the channel reaching SUBSCRIBED after the subscribe
    // timeout already started polling) so the two sources can't both emit.
    const channel = rt
        .channel(`thread:${threadId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, (payload) => { if (!polling)
        onEvent(toEvent(payload.new)); });
    const startPolling = () => {
        if (polling)
            return; // idempotent: a late error status must not start a 2nd interval
        polling = true;
        opts.onDegrade?.();
        const seen = new Set();
        timer = setInterval(() => {
            // Swallow transient poll failures so the fallback loop survives a flaky
            // backend; awaiting here without a catch would leak an unhandled rejection.
            void opts
                .pollFallback()
                .then((events) => {
                for (const e of events) {
                    if (!seen.has(e.id)) {
                        seen.add(e.id);
                        onEvent(e);
                    }
                }
            })
                .catch(() => { });
        }, opts.pollIntervalMs ?? 5000);
    };
    // Resolve on SUBSCRIBED, on an error status, OR on timeout if no status callback
    // ever fires — otherwise watchThread could hang forever with no fallback.
    await new Promise((resolve) => {
        const timeout = setTimeout(() => { startPolling(); resolve(); }, opts.subscribeTimeoutMs ?? 5000);
        channel.subscribe((status, err) => {
            if (status === "SUBSCRIBED") {
                clearTimeout(timeout);
                resolve();
                return;
            }
            if (err || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                clearTimeout(timeout);
                startPolling();
                resolve();
            }
        });
    });
    return async () => {
        if (timer)
            clearInterval(timer);
        await channel.unsubscribe();
    };
}
//# sourceMappingURL=watch.js.map