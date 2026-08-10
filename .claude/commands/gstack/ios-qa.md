# /ios-qa

Live-device iOS QA for SwiftUI apps.

## What to do

Invoke the **`ios-qa`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Connects to a real iPhone via USB CoreDevice IPv6 tunnel, reads Swift source to understand every screen, then runs a vision-driven agent loop: screenshot → analyze → decide → act → verify → repeat. All interaction happens via HTTP to an embedded StateServer in the app under test.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/ios-qa/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
