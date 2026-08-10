# /ios-clean

Remove the DebugBridge SPM package and all #if DEBUG wiring from an iOS app.

## What to do

Invoke the **`ios-clean`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

## When this applies

Cleans up StateServer, DebugOverlay, accessor codegen output, and app-side hooks installed by /ios-qa. This is a convenience wrapper — the structural Release-build guard (Package.swift conditional + CI swift build -c release check) is the safety-critical path. Use when asked to "clean the iOS debug bridge", "remove DebugBridge", or "strip the gstack iOS instrumentation".

---
Wrapper only. The skill itself lives at `~/.claude/skills/gstack/ios-clean/SKILL.md`
and is the single source of truth — this file is regenerated, never hand-edited.
