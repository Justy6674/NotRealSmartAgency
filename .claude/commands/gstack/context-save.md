# /context-save

Save working context.

## What to do

Invoke the **`context-save`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Captures git state, decisions made, and remaining work so any future session can pick up without losing a beat. Use when asked to "save progress", "save state", "context save", or "save my work". Pair with /context-restore to resume later. Formerly /checkpoint — renamed because Claude Code treats /checkpoint as a native rewind alias in current environments, which was shadowing this skill.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/context-save/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
