# /ios-fix

Autonomous iOS bug fixer.

## What to do

Invoke the **`ios-fix`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Takes a bug found by /ios-qa, reads the source, writes the fix, rebuilds, redeploys, and verifies the fix on the real device. Closes the loop: find bug → fix bug → confirm fix — zero human intervention. Captures the pre-bug state snapshot as a regression test fixture, so the bug can never recur silently.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/ios-fix/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
