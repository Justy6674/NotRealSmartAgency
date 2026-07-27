# Requirements: NotRealSmart Agency

**Defined:** 2026-07-28
**Core Value:** A non-technical business owner can run their own marketing agency by talking — the LLM absorbs the complexity, and nothing reaches the public without a human approving it.

## Scope Note

This is a brownfield project with substantial live production code. These requirements describe **what remains to deliver**, not the whole product. Capabilities already shipped and verified in `.planning/codebase/` are listed under *Validated* in `PROJECT.md` and are deliberately absent here.

Provenance is recorded per requirement:
- `PRD:<slug>` — traces to a requirement in `.planning/intel/requirements.md`
- `SPEC` — traces to a constraint in `.planning/intel/constraints.md`
- `ADR-*` — traces to a locked decision in `.planning/intel/decisions.md`
- `GAP` — a contradiction or unfinished commitment surfaced by ingest or the codebase map

## v1 Requirements

### Governance & Boundary (GOV)

- [ ] **GOV-01**: The three open decisions (DEC-01 Telegram channel state, DEC-02 Creative Studio room model, DEC-03 publishing transport) are each recorded as a dated ADR, and every contradicting source document is amended so no document states both positions. — `GAP` (`.planning/INGEST-CONFLICTS.md`, 3 warnings)
- [ ] **GOV-02**: Cross-project marketing work is possible only through an explicit, auditable link that records both projects, purpose, permitted marketing data classes and an expiry — and the link stops granting access once expired. — `SPEC` (project-boundary design; deferred `project_links` migration)
- [ ] **GOV-03**: Every memory item the Director retrieves is bound to a project and carries provenance, confidence and freshness; ambiguous legacy or generated-only memories are quarantined and never enter a prompt until reviewed. — `SPEC` (project learning taxonomy; deferred project-bound memory schema)
- [ ] **GOV-04**: A seeded synthetic sentinel proves isolation end to end — a fact stored for one project never appears in another project's prompt, output, tool result, MCP enumeration or channel reply, and patient/clinical/PII input is rejected before any job or memory is created. — `SPEC` (project-boundary acceptance evidence)
- [ ] **GOV-05**: A change that breaks tests, lint or the production build cannot reach production. — `SPEC` (publishing-hardening CI gate) + `GAP` (INTEGRATIONS.md: "No test gate is wired into the deploy")
- [ ] **GOV-06**: The Director reads from one memory store, not two — the legacy keyword memory path is retired and its useful content migrated into the scoped semantic store. — `ADR-CLAUDE-19`, `ADR-CLAUDE-20` + `GAP` (v1 `src/lib/ruflo/` and v2 `src/lib/memory/` both live)

### Creative Studio (STU)

*Blocked on DEC-02 — the room model determines routes, tabs and component ownership.*

- [ ] **STU-01**: Every Creative Studio entry point leads to a working workspace — no tab, card or route that does nothing — matching the decided room model. — `SPEC` (both Studio specs; "the Create tab currently shows 6 dead intent cards that don't work")
- [ ] **STU-02**: Selecting a content type changes the entire creation form to that type's fields — single post, carousel (2–10 slides), short video (9:16 + script), long video (16:9 + title/description/tags), story (9:16 + overlays), advertisement (creative + headline + body + CTA + audience notes). — `SPEC` (complete-architecture design principle 2)
- [ ] **STU-03**: A user can take a post from media to ready-to-schedule in one workspace covering all ten Creator sections — media slots, platform selector, content type, caption editor, hashtags, template, schedule, compliance check, live preview, sticky action bar. — `SPEC` (Post Creator ten-card spec), `ADR-CLAUDE-29`
- [ ] **STU-04**: Nothing leaves the Studio for a platform without a human approving it in Review — including drafts created by an external MCP client — and for a health brand the approve control stays disabled until the compliance check passes. — `SPEC` (design principles 4 and 8), `ADR-CLAUDE-18`
- [ ] **STU-05**: The platforms, formats, post signature, compliance flags and content pillars offered in the Creator are the ones configured for that brand, with incompatible platforms greyed out for the chosen content type. — `SPEC` (per-brand platform configuration)

### Publishing (PUB)

*Blocked on DEC-03 — the transport decision determines the dispatcher's target architecture.*

- [ ] **PUB-01**: An approved post publishes to every selected platform under the decided transport, and the user sees per-platform success or failure without any infrastructure name appearing on screen. — `DEC-03`, `ADR-CLAUDE-04`
- [ ] **PUB-02**: A user connects their own social account by choosing their brand's platform and signing in — self-serve, with no token, redirect URI or the word "OAuth" ever shown. — `ADR-CLAUDE-04`, `ADR-CLAUDE-05` + `GAP` (OAuth routes exist for five platforms; the self-serve surface is unproven)
- [ ] **PUB-03**: MCP publish exposure follows one reconciled, structurally enforced policy — the locked ADR exposure list and the Director-only hardening allowlist no longer disagree. — `GAP` (DEC-04: ADR-CLAUDE-07 vs publishing-hardening design), `ADR-CLAUDE-08`
- [ ] **PUB-04**: A failed publish retries automatically, and if it still fails the user is told in plain language what went wrong and what to do next. — `SPEC` (publisher retry queue), `ADR-CLAUDE-05`

### Telegram Marketing Chief (TEL)

*Blocked on DEC-01 — whether the Telegram channel is a disabled surface or the primary interface.*

- [ ] **TEL-01**: Justin runs a project's marketing from Telegram in plain language — no slash command is ever required — with exactly one active project per session, switchable only through an explicit picker. — `SPEC` (Telegram chief global constraints)
- [ ] **TEL-02**: Every Telegram request runs a defined work contract (`site_review`, `marketing_audit`, `launch_plan`, `campaign_pack`, `content_pack`, `competitor_research`, `status_update`) that produces structured output and exactly one next action, not an open-ended chat reply. — `SPEC` (work contract types)
- [ ] **TEL-03**: Every conclusion traces to a persisted evidence item with a source, timestamp and freshness drawn from bounded sources; missing evidence is stated as missing rather than invented. — `SPEC` (evidence pack contract)
- [ ] **TEL-04**: Replies are clean plain text in the fixed shape (What I found / What I recommend / Ready to use / Next action) with no Markdown scaffolding or generic filler, and every inline button is safe — none publishes or messages anyone. — `SPEC` (Telegram delivery format)
- [ ] **TEL-05**: Learning is typed as `founder_decision`, `brand_preference`, `verified_fact` or `measured_outcome`, scoped to one project, and source facts expire without overwriting founder decisions. — `SPEC` (project learning taxonomy)

### Optimisation & Intelligence (OPT)

- [ ] **OPT-01**: A user can publish two variants of a piece of content and see which performed better. — `PRD:REQ-ab-content-testing`
- [ ] **OPT-02**: The system shifts a brand's posting mix toward the formats, platforms and times that are actually performing, and can explain the shift. — `PRD:REQ-multi-armed-bandit-optimisation` (Multi-Armed Bandit / Thompson sampling / Bellman RL / Popper evidence validation, per the Madison framework)
- [ ] **OPT-03**: Before publishing, a user can ask "would my audience like this?" and get a reasoned answer grounded in that brand's audience. — `PRD:REQ-synthetic-persona-simulation`
- [ ] **OPT-04**: When engagement drops against a brand's own baseline, the owner is told proactively without having to go looking. — `PRD:REQ-auto-monitors`
- [ ] **OPT-05**: A new Google or social review produces a drafted reply that the owner approves before it is sent. — `PRD:REQ-reviews-ai`

### Brand Kit & Demo Assets (BKT)

- [ ] **BKT-01**: A user pastes their website URL and gets back a brand kit — colours, fonts, voice and tone, key messaging, logo — without filling in a form. — `PRD:REQ-website-to-brand-kit`
- [ ] **BKT-02**: A user can produce an animated showcase video of their own website and share it as a marketing asset. — `PRD:REQ-animated-website-showcase`
- [ ] **BKT-03**: Asking the Director for a demo of their product produces a click-through interactive demo with hotspot overlays. — `PRD:REQ-interactive-product-demo`
- [ ] **BKT-04**: A user can restyle a product photo into on-brand variants without leaving the Studio. — `PRD:REQ-image-remix`

## v2 Requirements

Acknowledged, deferred, not in this roadmap.

### Telegram

- **TEL-v2-01**: Migrate the Telegram durable agent brain to Eve, behind parity tests and a reversible cutover. The live bot is never rewritten in place. — `SPEC` (Telegram chief plan, Tasks 6–7)

### Knowledge

- **KNW-v2-01**: Self-updating agent knowledge — a daily research cron that keeps agents current with AI and marketing trends. — `ADR-CLAUDE-20`. *Deferred because a `/api/cron/daily-intel` route already runs daily at 20:00; the remaining work is a quality question, not a build, and needs its own discovery.*

### Connectors

- **CON-v2-01**: Extend the project marketing-intelligence connector contract (`get_marketing_snapshot`, `get_funnel_summary`, `list_approved_marketing_assets`, `get_verified_product_facts`, `list_optimisation_opportunities`) beyond the Scent Sell proof connector to the remaining projects. — `SPEC` (marketing-intelligence connector contract)

## Out of Scope

| Feature | Reason |
|---------|--------|
| CRM segmentation | Recorded as an explicit non-requirement — "different product" (`PRD:REQ-competitive-scope-exclusions`) |
| Customer lifetime value prediction | Same — explicit Klaviyo K:AI feature NRS does not need |
| SMS marketing | Same — explicit Klaviyo K:AI feature NRS does not need |
| Rewriting the landing page / WaterRippleHero | Locked off by ADR-CLAUDE-24 |
| Three.js for any new feature | Locked off by ADR-CLAUDE-24 — CSS/SVG/Canvas 2D only |
| A second marketing orchestrator (Hyper MCP or equivalent) | The NRS Director is the single orchestrator for web, MCP and Telegram (`docs/marketing-skills-adaptation.md`) |
| A second media-processing path | `runMediaProcessingPipeline` is the only permitted `media_items` writer (ADR-CLAUDE-15) |
| Direct provider SDK calls in the agent path | Bypasses the AI Gateway and loses fallbacks, cost accounting and health-brand zero-data-retention (ADR-CLAUDE-21) |
| Route groups under `src/app/` | Flat routes only (ADR-CLAUDE-23) |
| Reselling Arcade Software or Propels for interactive demos | Arcade is "too expensive for NRS to resell"; Propels is "not mature enough for production" — build our own (ADR-CLAUDE-02, `PRD:REQ-interactive-product-demo`) |
| The 62 GitBook help-centre pages | Excluded from ingest as customer documentation, not planning intel; re-ingest explicitly if needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GOV-01 | Phase 1 | Pending |
| GOV-02 | Phase 1 | Pending |
| GOV-03 | Phase 1 | Pending |
| GOV-04 | Phase 1 | Pending |
| GOV-05 | Phase 1 | Pending |
| GOV-06 | Phase 1 | Pending |
| STU-01 | Phase 2 | Blocked (DEC-02) |
| STU-02 | Phase 2 | Blocked (DEC-02) |
| STU-03 | Phase 2 | Blocked (DEC-02) |
| STU-04 | Phase 2 | Blocked (DEC-02) |
| STU-05 | Phase 2 | Blocked (DEC-02) |
| PUB-01 | Phase 3 | Blocked (DEC-03) |
| PUB-02 | Phase 3 | Blocked (DEC-03) |
| PUB-03 | Phase 3 | Blocked (DEC-03) |
| PUB-04 | Phase 3 | Blocked (DEC-03) |
| TEL-01 | Phase 4 | Blocked (DEC-01) |
| TEL-02 | Phase 4 | Blocked (DEC-01) |
| TEL-03 | Phase 4 | Blocked (DEC-01) |
| TEL-04 | Phase 4 | Blocked (DEC-01) |
| TEL-05 | Phase 4 | Blocked (DEC-01) |
| OPT-01 | Phase 5 | Pending |
| OPT-02 | Phase 5 | Pending |
| OPT-03 | Phase 5 | Pending |
| OPT-04 | Phase 5 | Pending |
| OPT-05 | Phase 5 | Pending |
| BKT-01 | Phase 6 | Pending |
| BKT-02 | Phase 6 | Pending |
| BKT-03 | Phase 6 | Pending |
| BKT-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓
- Duplicated across phases: 0 ✓

**PRD coverage:** all 10 extracted PRD requirements are accounted for — 9 map to v1 requirements (OPT-01…05, BKT-01…04) and `REQ-competitive-scope-exclusions` is recorded under Out of Scope, which is what the source declares it to be.

**Blocked coverage:** 14 of 29 v1 requirements (Phases 2, 3 and 4) are blocked on an open decision resolved by GOV-01 in Phase 1. This is expected, not a gap — see `PROJECT.md` open decisions.

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-07-28 after unattended `gsd-ingest-docs` → roadmap run*
