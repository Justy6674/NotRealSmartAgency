# /diagram

Turn an English description (or mermaid source) into a diagram triplet: the source, an editable .excalidraw file you can open

## What to do

Invoke the **`diagram`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

on excalidraw.com, and rendered SVG + PNG (clean mermaid style; the .excalidraw carries the hand-drawn aesthetic). Fully offline. Use when asked to "make a diagram", "draw the architecture", "create a flowchart", "diagram this", or "visualize this flow".

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/diagram/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
