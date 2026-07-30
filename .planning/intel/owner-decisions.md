# Owner decisions

Recorded 2026-07-30 from Justin Black, owner. These settle contradictions the
ingested specs could not resolve on precedence, and they are binding on routing.

## D-A · Publishing sequencing — BRIDGE THEN DIRECT

**Decision:** Move Mixpost off the BinaryLane VPS to a different rented host and
keep it publishing. Build direct platform publishing behind it. Retire Mixpost
once direct is proven.

Resolves the conflict between `docs/specs/nrs-social-publishing-build-plan.md`
("Build our own. No middleware.") and
`.planning/OPTIONS-publishing-and-interface.md` §3 (bridge for 2–4 months).
Both agree on the destination; only sequencing was open.

**Binding constraints:**
- The VPS at 203.29.242.68 is out of use by owner instruction. Mixpost currently
  serves from it and must move, not stay.
- Hosting on the owner's Mac is excluded: Vercel's cron marks a post stuck ten
  minutes as `failed`, so a sleeping laptop marks real scheduled content failed
  rather than merely delaying it.
- Direct publishing must not be switched on until per-account project mapping is
  proven. `social_oauth_tokens` has zero rows; the path has never run.

## D-B · Studio navigation — LEFT SIDEBAR

**Decision:** Restructure to a left sidebar, per
`docs/specs/nrs-mixpost-visual-parity-inventory.md` priority 1.

Overrides `docs/specs/nrs-creative-studio-definitive-architecture.md`
("4 tabs, this is correct, don't change"). Equal precedence, both SPEC-class,
neither locked — the owner is the tie-break.

**Stated qualifier, verbatim:** *"I am using NRS as an expert via Hermes or
Claude — and I use Canva and Mixpost currently — so make it look nice sure with
option 3, however need this sorted."*

Read as: the sidebar is accepted, but appearance ranks **below** the functional
requirement below. Do not schedule a navigation restructure ahead of it.

## D-C · The functional requirement that outranks appearance

The owner's repeated, primary requirement across this session:

> "NRS must keep plugged-in AI clients (Claude Code, Hermes, Claude Desktop)
> brand-aware and structured — always suggest a plan, guide the AI, know my
> site, scan it, suggest optimisations, my social media, enablers, barriers,
> risks, gaps. And do fast things fast. It is more than a Director, it has sub
> agents as well."

> "I need an interface — that's what Mixpost or Canva is — so visually I always
> see what's needed, macro."

Two halves, and NRS currently does neither:
1. **Proactive** — nothing populates the 21 proforma sections per project,
   nothing dispatches the 13 department agents on a schedule, discovery has run
   once ever, and three proactive cron routes exist but are not scheduled.
2. **Visible** — there is no screen showing all eleven projects at once. Every
   surface is scoped to one selected project.

The owner is a clinical/product person, not a developer. He must never be asked
to read JSON, open developer tools, or run a CLI.

## D-D · Compliance blockers — FIXED BEFORE ROUTING

All three publishing blockers from `INGEST-CONFLICTS.md` were fixed and pushed
(`6b9dd64`) at the owner's instruction, rather than being carried as roadmap
phases. A single shared gate now covers the scheduled publisher and the direct
dispatcher, and the Meta sign-in files only Pages belonging to the connecting
project.

Do not re-plan these as work. Do carry forward the remaining Severity-1 items
from `.planning/codebase/CONCERNS.md` that were not addressed — notably
`blotato_publish`, `save_output` recording violations and saving anyway, and the
absence of any test on the compliance path beyond those added with the fix.
