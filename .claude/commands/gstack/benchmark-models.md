# /benchmark-models

Cross-model benchmark for gstack skills.

## What to do

Invoke the **`benchmark-models`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Runs the same prompt through Claude, GPT (via Codex CLI), and Gemini side-by-side — compares latency, tokens, cost, and optionally quality via LLM judge. Answers "which model is actually best for this skill?" with data instead of vibes. Separate from /benchmark, which measures web page performance.

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/benchmark-models/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
