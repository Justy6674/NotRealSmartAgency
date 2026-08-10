# /guard

Full safety mode: destructive command warnings + directory-scoped edits.

## What to do

Invoke the **`guard`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Combines /careful (warns before rm -rf, DROP TABLE, force-push, etc.) with /freeze (blocks edits outside a specified directory). Use for maximum safety when touching prod or debugging live systems. Use when asked to "guard mode", "full safety", "lock it down", or "maximum safety". # /guard — Full Safety Mode Activates both destructive command warnings and directory-scoped edit restrictions.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/guard/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
