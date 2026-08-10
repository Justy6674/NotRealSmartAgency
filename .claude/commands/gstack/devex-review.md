# /devex-review

Live developer experience audit.

## What to do

Invoke the **`devex-review`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Uses the browse tool to actually TEST the developer experience: navigates docs, tries the getting started flow, times TTHW, screenshots error messages, evaluates CLI help text. Produces a DX scorecard with evidence. Compares against /plan-devex-review scores if they exist (the boomerang: plan said 3 minutes, reality says 8).

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/devex-review/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
