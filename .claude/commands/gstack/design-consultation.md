# /design-consultation

Design consultation: understands your product, researches the landscape, proposes a complete design system (aesthetic, typography, color, layout, spacing, motion), and generates font+color preview...

## What to do

Invoke the **`design-consultation`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Creates DESIGN.md as your project's design source of truth. For existing sites, use /plan-design-review to infer the system instead. Use when asked to "design system", "brand guidelines", or "create DESIGN.md". Proactively suggest when starting a new project's UI with no existing design system or DESIGN.md.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/design-consultation/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
