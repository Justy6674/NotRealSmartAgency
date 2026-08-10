# /careful

Safety guardrails for destructive commands.

## What to do

Invoke the **`careful`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Warns before rm -rf, DROP TABLE, force-push, git reset --hard, kubectl delete, and similar destructive operations. User can override each warning. Use when touching prod, debugging live systems, or working in a shared environment. Use when asked to "be careful", "safety mode", "prod mode", or "careful mode". # /careful — Destructive Command Guardrails Safety mode is now **active**.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/careful/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
