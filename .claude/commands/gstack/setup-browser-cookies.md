# /setup-browser-cookies

Import cookies from your real Chromium browser into the headless browse session.

## What to do

Invoke the **`setup-browser-cookies`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Opens an interactive picker UI where you select which cookie domains to import. Use before QA testing authenticated pages. Use when asked to "import cookies", "login to the site", or "authenticate the browser".

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/setup-browser-cookies/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
