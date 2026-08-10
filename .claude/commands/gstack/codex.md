# /codex

OpenAI Codex CLI wrapper — three modes.

## What to do

Invoke the **`codex`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Code review: independent diff review via codex review with pass/fail gate. Challenge: adversarial mode that tries to break your code. Consult: ask codex anything with session continuity for follow-ups. The "200 IQ autistic developer" second opinion. Use when asked to "codex review", "codex challenge", "ask codex", "second opinion", or "consult codex".

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/codex/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
