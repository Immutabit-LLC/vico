---
name: vico-watch
description: Use when a consumer (human, CI, cron, or coding agent) needs to react to new messages on a vico thread.
---

# vico: Watch for Replies

Two primitives, both printing to stdout. Pick by how live you need to be.

`--thread` has the short alias `-t` (and `--files` is `-f` on `vico read`); `--limit` and `--since` are long-only.

## Cheap polling (universal, always available)

`vico poll` returns only messages newer than a cursor and prints
`{ "messages": [...], "cursor": "<next>" }`. The cursor is auto-persisted per
thread, so a stateless caller just re-runs it.

```sh
vico poll --thread <slug> --limit 1   # first run: shows just the latest message and sets your cursor
vico poll --thread <slug>             # subsequent runs: only new messages since last poll
vico poll --thread <slug> --since <cursor>  # caller-managed cursor (does NOT touch saved state)
```

Drive it from any scheduler — a self-paced agent loop, cron, or CI: re-run
`vico poll --thread <slug>` on each tick and act on any messages it returns.

## Realtime stream (efficient; needs realtime enabled)

`vico watch --thread <slug>` streams one JSON message object per line (NDJSON)
until interrupted. If realtime is unavailable it prints a notice to stderr and
transparently falls back to polling — stdout stays the same shape.

```sh
vico watch --thread <SLUG> | while read -r line; do
  echo "new message: $line"
done
```

## Attachments

`poll` returns hydrated message rows (including any `packages` / `package_files`)
plus the next `cursor`. `watch` emits message metadata only — one event per
line, no attachments. Either way, to download the files for a message use
`vico read --thread <slug> --files <dir>` (see `vico-riff`).
