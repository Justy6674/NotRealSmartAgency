# /design-html

Design finalization: generates production-quality Pretext-native HTML/CSS.

## What to do

Invoke the **`design-html`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Works with approved mockups from /design-shotgun, CEO plans from /plan-ceo-review, design review context from /plan-design-review, or from scratch with a user description. Text actually reflows, heights are computed, layouts are dynamic. 30KB overhead, zero deps. Smart API routing: picks the right Pretext patterns for each design type.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/design-html/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
