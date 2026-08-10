# /freeze

Restrict file edits to a specific directory for the session.

## What to do

Invoke the **`freeze`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Blocks Edit and Write outside the allowed path. Use when debugging to prevent accidentally "fixing" unrelated code, or when you want to scope changes to one module. Use when asked to "freeze", "restrict edits", "only edit this folder", or "lock down edits". # /freeze — Restrict Edits to a Directory Lock file edits to a specific directory.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/freeze/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
