# Synthesis Summary

Generated 2026-07-28. Mode: `new`. Precedence: `ADR > SPEC > PRD > DOC` with per-doc manifest overrides (lower integer = higher authority).

This is the single entry point for `gsd-roadmapper`. Read this file first, then the per-type intel files, then the conflicts report.

---

## Doc counts by type

- ADR — 2 (`CLAUDE.md` precedence 0 locked; `AGENTS.md` precedence 1 proposed)
- SPEC — 12 (5 design specs at precedence 10; 7 implementation plans at precedence 20)
- PRD — 2 (both precedence 30)
- DOC — 3 (all precedence 40)
- **Total consumed: 19 of 19 classifications. Zero UNKNOWN. Zero low-confidence.**

62 further candidate docs (`docs/gitbook-export/**`) were excluded by the manifest before classification.

## Decisions

- Extracted: 40 decision entries → `.planning/intel/decisions.md`
- **Locked: 33** — all from `CLAUDE.md` (ADR-CLAUDE-01 … ADR-CLAUDE-33)
- Proposed: 7 — from `AGENTS.md` (ADR-AGENTS-01 … ADR-AGENTS-07), the Cowork-imported brand, compliance and approval rules that are unique to that file
- Only one locked source exists, so no LOCKED-vs-LOCKED contradiction was possible

Locked-decision source path: `CLAUDE.md`

Highest-leverage locked decisions for roadmapping: Rule Zero (ADR-CLAUDE-01), build-our-own-tech (02), the non-technical-user First Principle (05), one-screen/Director-only (06), the MCP allowlist (07), streamText-not-ToolLoopAgent (10), the single media pipeline (15), and the mandatory Superpowers workflow (30).

## Requirements

- Extracted: 10 → `.planning/intel/requirements.md`
- IDs: `REQ-ab-content-testing`, `REQ-auto-monitors`, `REQ-reviews-ai`, `REQ-multi-armed-bandit-optimisation`, `REQ-synthetic-persona-simulation`, `REQ-image-remix`, `REQ-competitive-scope-exclusions`, `REQ-website-to-brand-kit`, `REQ-animated-website-showcase`, `REQ-interactive-product-demo`
- **Every requirement has `acceptance` marked absent.** Both PRDs are research artefacts — the competitive analysis lists gaps without criteria, and the interactive-demo research self-declares "Status: Research Phase". No acceptance criteria were inferred. No competing acceptance variants exist between the two PRDs; their scopes do not overlap.

## Constraints

- Extracted: 33 → `.planning/intel/constraints.md`
- By type: `protocol` 14, `api-contract` 13, `schema` 4, `nfr` 4

Clusters: the 2026-04-08 master architecture (approval-mandatory pipeline, four rooms, per-content-type forms, per-brand platform config, the learning loop); the 2026-07-24 project-boundary work (`ExecutionScope`, marketing-data boundary gate, connector data classes, deferred migration set, acceptance evidence); the 2026-07-24 publishing hardening (MCP direct-tool allowlist, fail-closed Mixpost signature verification, CI gates); the 2026-07-25 Telegram chief (evidence pack, work contracts, learning taxonomy, delivery format); and the 2026-04-05 Creative Studio rooms plus the 2026-04-08 Post Creator ten-card spec.

## Context topics

- Extracted: 13 topics → `.planning/intel/context.md`
- Sources: `README.md` (7 topics), `docs/ARCHITECTURE.md` (4), `docs/marketing-skills-adaptation.md` (2)
- All three are precedence 40 and several statements are already outranked — see the conflicts report.

## Conflicts

- **0 blockers**
- **3 competing variants (WARNINGS)** — user resolution required before routing:
  1. Telegram channel state — two precedence-20 SPECs contradict (disabled and fail-closed versus built on a live webhook); equal precedence, so no rule resolves it
  2. Creative Studio room model — two precedence-10 design specs contradict (6 sibling creation rooms versus the Create → Review → Schedule → Media pipeline)
  3. Publishing transport — Rule Zero's "direct platform APIs, no middleware dependencies" contradicts the Mixpost bridge, both inside the same locked ADR
- **10 auto-resolved (INFO)** — including one that deserves roadmapper attention: the locked ADR's MCP exposure list (which exposes `publish_to_social` and `manage_posts`) outranks the 2026-07-24 hardening spec that makes them Director-only. Precedence was applied as written, but the hardening plan's tasks are marked complete in the source, so the ADR text appears stale. Both positions are preserved verbatim.

Full detail: `.planning/INGEST-CONFLICTS.md`

## Cross-reference integrity

Cycle detection ran over the `cross_refs` graph. Two doc-to-doc edges exist (`CLAUDE.md` → `2026-04-08-post-creator-redesign.md`, `AGENTS.md` → same). All other refs point at source files, migrations or paths outside the ingest set. Maximum traversal depth 2 against a cap of 50. **No cycles.** All 19 docs were safe to synthesize.

## Per-type intel files

- `.planning/intel/decisions.md` — 40 entries (33 locked)
- `.planning/intel/requirements.md` — 10 entries (all acceptance absent)
- `.planning/intel/constraints.md` — 33 entries
- `.planning/intel/context.md` — 13 topics
- `.planning/INGEST-CONFLICTS.md` — 0 blockers / 3 warnings / 10 info
- `.planning/intel/classifications/` — 19 per-doc classification JSON files

## Status

**AWAITING USER** — 3 competing variants need resolution before routing. No blockers; the safety gate did not fire, so all intel files were written.
