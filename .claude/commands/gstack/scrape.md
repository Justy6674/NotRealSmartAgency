# /scrape

Pull data from a web page.

## What to do

Invoke the **`scrape`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

First call on a new intent prototypes the flow via $B primitives and returns JSON. Subsequent calls on a matching intent route to a codified browser-skill and return in ~200ms. Read-only — for mutating flows (form fills, clicks, submissions), use /automate. Use when asked to "scrape", "get data from", "pull", "extract from", or "what's on" a page.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/scrape/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
