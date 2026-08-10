# /document-generate

Generate missing documentation from scratch for a feature, module, or entire project.

## What to do

Invoke the **`document-generate`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Uses the Diataxis framework (tutorial / how-to / reference / explanation) to produce complete, structured documentation. Can be invoked standalone or called by /document-release when it finds coverage gaps. Use when asked to "write docs", "generate documentation", "document this feature", "create a tutorial", or "explain this module".

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/document-generate/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
