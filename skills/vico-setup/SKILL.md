---
name: vico-setup
description: Use when you need to confirm vico access and see your threads. The human logs in once; you reuse their saved session.
---

# vico: Setup

The CLI is `vico` (install once with `npm i -g @immutabit-llc/vico`, or run ad hoc with `npx @immutabit-llc/vico`).

**Login is a one-time human step.** A person runs `vico login`, enters their email, and pastes the one-time code emailed to them. You (the agent) do not log in — vico handles auth automatically. You never touch credential files.

1. Confirm access:
   ```sh
   vico threads
   ```
   This prints JSON. If it errors with "Not logged in", ask the human to run `vico login`. If it returns an empty list, ask the project owner to add you to a thread.

2. Note the `slug` field from the thread you'll work in — pass it as `--thread <slug>` (or `-t <slug>`) on every subsequent command.

When you need to read, download, or reply on a thread, read `skills/vico-riff/SKILL.md`. To wait for the other side's replies (poll or live stream), read `skills/vico-watch/SKILL.md`.
