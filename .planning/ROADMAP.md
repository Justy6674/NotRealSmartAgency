# Roadmap: NotRealSmart Agency

## Overview

NotRealSmart Agency is already live. What it is missing is not features — it is *settled ground*. Three foundational questions are unanswered (is Telegram on or off, is the Studio six rooms or four, is publishing direct-to-platform or through Mixpost), and until they are answered every downstream build risks being thrown away. So the journey starts by deciding those three things, finishing the project-boundary work that is half-shipped, and proving isolation with a real sentinel run — then putting a gate between a push and production so the proof stays true.

With the ground settled, the work moves outward along the content pipeline the product actually sells: a Creative Studio where an idea becomes approved content without a blank form; a publishing path that reliably gets approved content onto the owner's own accounts and says plainly what happened; a Telegram chief that answers with evidence instead of confidence. Only then does the agency start learning — comparing variants, shifting the mix toward what performs, warning the owner when engagement slips. The last phase closes the loop back to the start of a subscriber's life: paste a URL, get a brand kit, a showcase video and a demo, without filling in anything.

Phases 2, 3 and 4 are each blocked on a decision that Phase 1 delivers. That blocking is deliberate and visible — it is the honest shape of this project right now.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Settled Ground** - Resolve the three open decisions, finish project isolation, prove it, and gate the deploy
- [ ] **Phase 2: Creative Studio** - Idea to approved content in one workspace, with a form that changes per content type
- [ ] **Phase 3: Publishing** - Approved content reaches the owner's own accounts reliably, self-serve, in plain language
- [ ] **Phase 4: Telegram Marketing Chief** - Evidence-backed, project-scoped marketing work from a plain-language message
- [ ] **Phase 5: Learning Loop** - The agency measures what it published and tells the owner what to change
- [ ] **Phase 6: Brand Kit & Demo Assets** - A website URL alone produces a brand kit and shareable marketing assets

## Phase Details

### Phase 1: Settled Ground
**Goal**: The three unanswered architecture questions are answered on the record, project isolation is complete and provable, and nothing broken can reach production.
**Depends on**: Nothing (first phase)
**Requirements**: GOV-01, GOV-02, GOV-03, GOV-04, GOV-05, GOV-06
**Success Criteria** (what must be TRUE):
  1. Each of DEC-01, DEC-02 and DEC-03 has a dated ADR recording the chosen variant and the reason, and every source document that stated the losing position has been amended — no document asserts both positions any more.
  2. A synthetic sentinel stored against one project can be searched for exhaustively and never appears in another project's chat reply, saved output, tool result, MCP project enumeration or channel response; patient/clinical/PII input is refused before any job or memory row is created.
  3. Cross-project marketing facts are reachable only through an explicit link naming both projects, the permitted data classes and an expiry — and the same request fails once the link has expired.
  4. Every memory the Director uses carries a project, a provenance and a freshness date; legacy memories missing those are quarantined and demonstrably never reach a prompt, and the Director reads from one store rather than two.
  5. A push that fails tests, lint or the production build does not become the live deployment.
**Plans**: TBD

### Phase 2: Creative Studio
**Goal**: A non-technical owner can take a piece of content from raw media to approved-and-ready inside one workspace, never facing a blank generic form.
**Depends on**: Phase 1
**Blocked on**: DEC-02 (Creative Studio room model) — resolved by GOV-01 in Phase 1. Both variants are preserved in PROJECT.md; do not begin this phase until one is chosen and recorded, because the choice determines routes, `src/lib/room-config.ts` tabs and component ownership. The codebase currently contains routes matching both models.
**Requirements**: STU-01, STU-02, STU-03, STU-04, STU-05
**Success Criteria** (what must be TRUE):
  1. Every visible Studio entry point — tab, card, route — opens a workspace that does something; there are no dead cards left.
  2. Choosing a content type reshapes the whole form: a carousel offers numbered slides, a short video offers a 9:16 slot and a script, an advertisement offers a CTA and audience notes — not one generic form with fields hidden.
  3. A user can build a post end to end (media, platforms, caption, hashtags, schedule) and watch a per-platform preview update as they go, before anything is saved.
  4. Nothing reaches a platform without a human approving it in Review — including a draft created by an external AI client — and for a health brand the approve control stays disabled until the compliance check passes.
  5. The platforms, formats, signature and compliance rules the Creator offers are the ones configured for that specific brand, with platforms incompatible with the chosen content type visibly unavailable.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Publishing
**Goal**: Approved content reliably reaches the owner's own social accounts, connected by the owner without help, with success and failure explained in words a non-technical person can act on.
**Depends on**: Phase 1, Phase 2
**Blocked on**: DEC-03 (publishing transport) — resolved by GOV-01 in Phase 1. The contradiction is internal to the locked ADR, so the Rule Zero publishing clause in `CLAUDE.md` must be amended before this phase starts. Both a native per-platform publisher set and the Mixpost bridge already exist in the codebase; this phase makes one of them the answer.
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04
**Success Criteria** (what must be TRUE):
  1. A user connects a social account by picking their brand's platform and signing in — they never see a token, a redirect URI, the word "OAuth", or the name of any publishing infrastructure.
  2. An approved post reaches every selected platform under the decided transport, and the user can see, per platform, whether it landed.
  3. A publish that fails is retried automatically, and if it still fails the user is told what went wrong and what to do next in plain language.
  4. An external AI client cannot publish without going through the Director and the approval it enforces, and there is exactly one documented policy saying so — the locked ADR list and the Director-only allowlist agree.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Telegram Marketing Chief
**Goal**: A plain-language message from the phone returns a complete, evidence-backed piece of marketing work for exactly one project.
**Depends on**: Phase 1
**Blocked on**: DEC-01 (Telegram channel state) — resolved by GOV-01 in Phase 1. Two equal-precedence specs disagree on whether the webhook is fail-closed or the secure edge to build on. If the decision keeps Telegram disabled, this phase stays gated behind the Phase 1 acceptance suite plus BotFather token rotation. If it re-enables Telegram, the foundation plan's Telegram constraint must be marked superseded first.
**Requirements**: TEL-01, TEL-02, TEL-03, TEL-04, TEL-05
**Success Criteria** (what must be TRUE):
  1. A plain-language message returns a finished piece of work — a slash command is never required, and asking for one is never the answer.
  2. Every reply names the active project, and changing project requires an explicit pick; wording alone never widens what the session can see.
  3. Every claim in a reply traces back to a stored evidence item with a source and a timestamp, and where evidence is missing the reply says it is missing instead of inventing positioning, analytics, testimonials or compliance status.
  4. Replies arrive as clean plain text in the fixed shape, with no Markdown scaffolding or generic filler, and every button offered is safe — none publishes or messages anyone.
  5. A correction given once is remembered as a founder decision for that project alone, and stale source facts expire without overwriting it.
**Plans**: TBD

### Phase 5: Learning Loop
**Goal**: The agency measures what it published, changes what it recommends because of it, and warns the owner before they notice a problem themselves.
**Depends on**: Phase 3
**Requirements**: OPT-01, OPT-02, OPT-03, OPT-04, OPT-05
**Success Criteria** (what must be TRUE):
  1. A user can publish two variants of a piece of content and see, side by side, which one performed better.
  2. Over time the recommended posting mix for a brand shifts toward the formats, platforms and times that are actually performing, and the Director can explain in plain language why it shifted.
  3. Before publishing, a user can ask "would my audience like this?" and get a reasoned answer grounded in that brand's own audience rather than a generic opinion.
  4. When engagement drops against a brand's own baseline, the owner is told without having to go looking for it.
  5. A new Google or social review produces a drafted reply that waits for the owner's approval before it is sent.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Brand Kit & Demo Assets
**Goal**: A new subscriber gets a usable brand kit and shareable marketing assets from nothing but their website URL.
**Depends on**: Phase 2
**Requirements**: BKT-01, BKT-02, BKT-03, BKT-04
**Success Criteria** (what must be TRUE):
  1. A user pastes their website URL and receives a brand kit — colours, fonts, voice and tone, key messaging, logo — without filling in a form.
  2. The user can produce an animated showcase video of their own website and share it as a marketing asset.
  3. Asking the Director for a demo of their product produces a click-through demo with hotspot overlays, orchestrated end to end rather than handed back as instructions.
  4. A user can restyle a product photo into on-brand variants without leaving the Studio.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Settled Ground | 0/TBD | Not started | - |
| 2. Creative Studio | 0/TBD | Blocked (DEC-02) | - |
| 3. Publishing | 0/TBD | Blocked (DEC-03) | - |
| 4. Telegram Marketing Chief | 0/TBD | Blocked (DEC-01) | - |
| 5. Learning Loop | 0/TBD | Not started | - |
| 6. Brand Kit & Demo Assets | 0/TBD | Not started | - |

## Coverage

- v1 requirements: 29
- Mapped to a phase: 29 ✓
- Orphaned: 0 ✓
- Requirements appearing in more than one phase: 0 ✓

Full mapping and provenance: `.planning/REQUIREMENTS.md`.

## Open Decisions Gating This Roadmap

| ID | Question | Gates | Status |
|----|----------|-------|--------|
| DEC-01 | Is the Telegram channel a disabled surface or the primary marketing interface? | Phase 4 | Open — both variants preserved |
| DEC-02 | Is the Creative Studio six creation rooms or a four-room Create → Review → Schedule → Media pipeline? | Phase 2, Studio surfaces in Phase 6 | Open — both variants preserved |
| DEC-03 | Is publishing direct platform APIs or the Mixpost bridge? | Phase 3, data source for Phase 5 | Open — both variants preserved |
| DEC-04 | Are `publish_to_social` and `manage_posts` exposed on MCP or Director-only? | Phase 3 (PUB-03) | Auto-resolved by precedence, but the winning text is stale — reconcile, do not assume |

Full statements of every variant, with sources: `PROJECT.md` → Key Decisions → open, and `.planning/INGEST-CONFLICTS.md`.

---
*Roadmap created: 2026-07-28*
