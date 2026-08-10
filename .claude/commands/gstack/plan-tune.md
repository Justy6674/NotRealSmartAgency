# /plan-tune

Self-tuning question sensitivity + developer psychographic for gstack (v1: observational).

## What to do

Invoke the **`plan-tune`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Review which AskUserQuestion prompts fire across gstack skills, set per-question preferences (never-ask / always-ask / ask-only-for-one-way), inspect the dual-track profile (what you declared vs what your behavior suggests), and enable/disable question tuning. Conversational interface — no CLI syntax required.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/plan-tune/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
