# /autoplan

Auto-review pipeline — reads the full CEO, design, eng, and DX review skills from disk and runs them sequentially with auto-decisions using 6 decision principles.

## What to do

Invoke the **`autoplan`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Surfaces taste decisions (close approaches, borderline scope, codex disagreements) at a final approval gate. One command, fully reviewed plan out. Use when asked to "auto review", "autoplan", "run all reviews", "review this plan automatically", or "make the decisions for me".

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/autoplan/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
