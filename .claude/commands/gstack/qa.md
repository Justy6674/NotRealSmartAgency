# /qa

Systematically QA test a web application and fix bugs found.

## What to do

Invoke the **`qa`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Runs QA testing, then iteratively fixes bugs in source code, committing each fix atomically and re-verifying. Use when asked to "qa", "QA", "test this site", "find bugs", "test and fix", or "fix what's broken". Proactively suggest when the user says a feature is ready for testing or asks "does this work?". Three tiers: Quick (critical/high only), Standard (+ medium), Exhaustive (+ cosmetic).

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/qa/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
