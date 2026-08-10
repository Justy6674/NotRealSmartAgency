# /pair-agent

Pair a remote AI agent with your browser.

## What to do

Invoke the **`pair-agent`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

One command generates a setup key and prints instructions the other agent can follow to connect. Works with OpenClaw, Hermes, Codex, Cursor, or any agent that can make HTTP requests. The remote agent gets its own tab with scoped access (read+write by default, admin on request).

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/pair-agent/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
