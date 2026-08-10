# /context-restore

Restore working context saved earlier by /context-save.

## What to do

Invoke the **`context-restore`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Loads the most recent saved state (preferring the current branch, falling back across branches) so you can pick up where you left off — even across Conductor workspace handoffs. Use when asked to "resume", "restore context", "where was I", or "pick up where I left off". Pair with /context-save.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/context-restore/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
