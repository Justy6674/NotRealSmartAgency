# Synthesis

Entry point for downstream consumers. Produced 2026-07-30 from `.planning/intel/classifications/` (11 documents) reconciled against verified code reality, `.planning/codebase/`, and `.planning/OPTIONS-publishing-and-interface.md`.

## Document counts by type

- SPEC — 8
- DOC — 3
- ADR — 0
- PRD — 0
- UNKNOWN — 0

All 11 classified `confidence: high`, all with `manifest_override: true`, none `locked`, none carrying a `precedence` override. Default precedence (ADR > SPEC > PRD > DOC) applied throughout; with no ADRs or PRDs present it never had to arbitrate between tiers.

## Decisions

14 recorded in `decisions.md`. **Locked: 0.** There are no ADRs in the ingest set, so every entry is `status: proposed` — decision statements embedded inside SPECs, plus two entries (D-07, D-12) that record code reality superseding a stale SPEC mechanism. Nothing in this corpus carries ADR authority, and the roadmapper should treat no decision as immovable.

Two decisions directly contradict each other and were both preserved rather than merged: D-04 (keep four Studio tabs, do not change) and D-05 (restructure to a Mixpost-style left sidebar as parity priority 1).

## Requirements

**0 REQ- entries.** No PRD-class sources exist in the ingest set, so nothing was extracted and nothing was invented. `requirements.md` records the gap and points at the three places requirement-shaped intent actually lives: the owner's stated purpose (relayed via the ingest brief), `.planning/codebase/CONCERNS.md`, and the Macro Board specification in `.planning/OPTIONS-publishing-and-interface.md`. Requirements need to be written, not extracted.

## Constraints

20 recorded in `constraints.md`, by type:

- schema — 4 (C-01, C-14, C-16, C-17)
- api-contract — 5 (C-02, C-04, C-09, C-10, C-12)
- protocol — 3 (C-05, C-08, C-15)
- nfr — 8 (C-03, C-06, C-07, C-11, C-13, C-18, C-19, C-20)

Two carry standing warnings: C-13 (compliance mandatory for regulated brands) is violated in three of the code paths that can reach a live account, and C-10 supersedes the MCP mechanism the SPEC describes.

## Context topics

10 recorded in `context.md`: the owner's stated purpose; current state against that purpose; the absence of any macro view; direct publishing built-but-never-run and its four defects; the compliance gate's true current state; three Mixpost operational runbooks; Studio build state as the specs left it; repository and supply-chain risk; and what is actually solid.

## Conflicts

- **3 blockers** — all AHPRA/TGA publishing exposure: cross-brand account resolution in the direct path, no compliance check in the direct path, no compliance check in the scheduled cron publisher. The third is live today on the path carrying all real traffic.
- **8 warnings** — competing Studio navigation decisions; two mutual cross-reference cycles; a mandatory referenced document missing from the ingest; no PRD sources; the publishing-route sequencing decision still open with the owner; three unverified external platform assumptions; four unverified-live video pipeline items; and Studio snapshots that disagree with each other and were never re-verified.
- **9 auto-resolved** — recorded for transparency, mostly spec-vs-reality where reality won.

Detail, with sources on every claim: `/Users/jb-downscale/NotRealSmartAgency/.planning/INGEST-CONFLICTS.md`

## Routing note

The blockers gate **routing**, not this synthesis. No roadmap, PROJECT.md or REQUIREMENTS.md should be written on the assumption that compliance is handled on the publishing paths. The intel was written because the ingest brief explicitly requested it.

Two further things the roadmapper needs before it can produce a plan the owner can act on:

1. **Requirements do not exist yet.** They must be authored from the owner's stated purpose and the Macro Board specification. Do not synthesise them from SPEC build steps.
2. **The publishing-route sequencing decision is unresolved** (WARNING 5). It determines the shape of the first two months and is the owner's call.

## Per-type intel files

- `/Users/jb-downscale/NotRealSmartAgency/.planning/intel/decisions.md`
- `/Users/jb-downscale/NotRealSmartAgency/.planning/intel/requirements.md`
- `/Users/jb-downscale/NotRealSmartAgency/.planning/intel/constraints.md`
- `/Users/jb-downscale/NotRealSmartAgency/.planning/intel/context.md`
