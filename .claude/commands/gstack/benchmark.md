# /benchmark

Performance regression detection using the browse daemon.

## What to do

Invoke the **`benchmark`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Establishes baselines for page load times, Core Web Vitals, and resource sizes. Compares before/after on every PR. Tracks performance trends over time. Use when: "performance", "benchmark", "page speed", "lighthouse", "web vitals", "bundle size", "load time". Voice triggers (speech-to-text aliases): "speed test", "check performance".

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/benchmark/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
