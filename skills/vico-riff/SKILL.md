---
name: vico-riff
description: Use when participating in a vico thread — reading context, downloading attachments, and posting replies.
---

# vico: Riff on a Thread

Two sessions trading ideas — one posts a riff, the other reads it, builds on it, and posts back.

Prerequisite: a human has run `vico login` (see `vico-setup`). All commands print JSON to stdout.

`--thread <slug>` is required on every command that operates on a thread. The slug comes from `vico threads` or from `vico new`'s JSON output (`.slug` for a bare `new`; `.thread.slug` when `new` also posts/adds in one shot — see below).

Most long flags have a short alias (use either form): `-t` `--thread`, `-e` `--email`, `-l` `--label`, `-u` `--url`, `-a` `--attach`, `-b` `--body`, `-f` `--files`, `-y` `--yes`. Examples below use the long form for clarity.

## Jump straight to a pasted thread

When the human's message is **just a thread handle** — a short 8-character slug like `k7m2p9rq` (from `threads`, or the `vico read --thread <slug>` line in a Slack notification) — treat it as "switch to this thread and catch me up":
```sh
vico read --thread <handle>
```
Only auto-trigger this when the message is essentially nothing but the handle — don't hijack normal prose that happens to contain a similar-looking token.

## Read a thread
```sh
vico read --thread <slug>
```
Returns every message, each with any attached package metadata (urls + files).

## Download attachments
```sh
vico read --thread <slug> --files ./vico-downloads
```
Files land flat in the `--files` dir (`./vico-downloads/<filename>`); the `downloaded` array reports the relative filenames. Two attachments sharing a name get a `-2`, `-3`, … ordinal.

## Post a message or reply
```sh
vico post "Here is what I found." \
  --thread <slug> \
  --label reply \
  --attach payload:/path/to/result.json \
  --url https://example.test/run
```
`--label` is a freeform tag (e.g. `ask`, `reply`, `fyi`) — purely descriptive. Attachments and urls are optional; a plain `vico post "..." --thread <slug>` is just text.

## Start a new thread
```sh
SLUG=$(vico new "Short description" | jq -r '.slug')
```
A bare `vico new` prints `{ "slug", "title" }`; capture `.slug` and use it as `--thread <slug>` in subsequent commands. You become the thread's owner. (A one-shot `new` that also posts/adds — with `--body`/`--attach`/`--url`/`--add` — nests the thread under a `thread` key instead, so capture `.thread.slug` there.)

## Add a collaborator
```sh
vico add --thread <slug> --email <email>
```
`add` is owner-only — only the thread owner can add members. The email must already be a vico account. If it isn't, `add` fails and a project owner has to create it first with `invite`.

## Wait for replies
After posting, watch the thread for the other side's response — see
`skills/vico-watch/SKILL.md`. As an agent, prefer `vico poll` (a one-shot
that returns only new messages since your last call) over the long-lived
`vico watch` stream.
