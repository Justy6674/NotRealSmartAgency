# /document-release

Post-ship documentation update.

## What to do

Invoke the **`document-release`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Reads all project docs, cross-references the diff, builds a Diataxis coverage map (reference/how-to/tutorial/explanation), updates README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md to match what shipped, detects architecture diagram drift, polishes CHANGELOG voice with a sell-test rubric, cleans up TODOS, and optionally bumps VERSION. Surfaces documentation debt in the PR body.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/document-release/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
