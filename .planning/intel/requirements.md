# Requirements

## Status: no PRD-class sources in this ingest

All 11 classified documents are typed `SPEC` (8) or `DOC` (3). **Zero PRDs.** Under the extraction contract, requirements are derived from PRDs only, so no `REQ-` entries are emitted here. Nothing has been invented to fill this file.

This is a real gap, not a formatting artefact: the ingest set describes *how things are built* and *how the infrastructure is configured*, but contains no document stating *what the product must do for its user* in requirement form. The roadmapper should treat the absence as a finding.

---

## Where requirement-shaped intent actually lives

Three sources carry requirement-like intent. None is a PRD, so each is recorded as an unratified input rather than a requirement. All three are captured in full in `context.md`.

**1. The owner's stated purpose** — relayed via the ingest brief, not a document in the set:

> "NRS must keep plugged-in AI clients brand-aware and structured — always suggest a plan, guide the AI, know my site, scan it, suggest optimisations, my social media, enablers, barriers, risks, gaps."

> "I need an interface — that's what Mixpost or Canva is — so visually I always see what's needed, macro."

- source: ingest brief from team-lead, relaying the owner (2026-07-30)
- status: stated intent, not a ratified requirement

**2. `.planning/codebase/CONCERNS.md`** — a ranked risk register measured explicitly against that stated purpose, ending in an eight-item suggested order of work. Authoritative on current state per the ingest brief.

- source: /Users/jb-downscale/NotRealSmartAgency/.planning/codebase/CONCERNS.md
- status: assessment and remediation ordering, not a requirements document
- note: two of its Severity-1 findings (1.1, 1.2) were verified stale this session — see INGEST-CONFLICTS.md → INFO.

**3. `.planning/OPTIONS-publishing-and-interface.md`** — a decision-support analysis containing a fully specified screen (the Macro Board: attention rail, project grid, colour semantics, exclusions) and a ten-step ordered plan.

- source: /Users/jb-downscale/NotRealSmartAgency/.planning/OPTIONS-publishing-and-interface.md
- status: options analysis awaiting an owner decision; the Macro Board design is specified but not chosen
- note: the Macro Board is the closest thing in the entire corpus to a written answer to the owner's "I need an interface" requirement.

---

## Recommendation to the roadmapper

Requirements need to be written, not extracted. The raw material is the owner's stated purpose plus the Macro Board specification in the OPTIONS document; the constraints that bound them are in `constraints.md`; the risks that must be respected are in `context.md`. Do not back-fill requirements from SPEC implementation detail — the SPECs describe a system that has partly drifted from the code, and treating build steps as requirements would lock in that drift.
