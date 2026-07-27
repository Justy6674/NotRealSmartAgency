# NotRealSmart Agency

## What This Is

NotRealSmart Agency is a self-owned agentic AI marketing agency platform: one Director agent plus thirteen invisible department agents run marketing across a portfolio of brands, entirely through conversation. It is live in production at `notrealsmart.com.au`, owned and operated by Black Health Intelligence Pty Ltd, and it markets the owner's own eight brands (several of which are AHPRA/TGA regulated) as well as being sold as a product.

This is a **brownfield** project. Substantial production code already exists — ~120 API routes, 266 components, 42 Supabase migrations, a live MCP server, a self-hosted publisher and a Telegram surface. This roadmap covers the work that remains, not a rebuild.

## Core Value

A non-technical business owner can run their own marketing agency by talking — the LLM absorbs the complexity, and nothing reaches the public without a human approving it.

## Business Context

- **Customer**: A non-technical business owner acting as their own marketing agency (locked First Principle, ADR-CLAUDE-05). First customer is the owner's own eight-brand portfolio.
- **Revenue model**: Stripe subscription tiers (`STRIPE_STARTER_PRICE_ID`, `STRIPE_PRACTICE_PRICE_ID`, `STRIPE_PROFESSIONAL_PRICE_ID`).
- **Success metric** *(assumption — see Assumptions)*: `npm run build` and `npm run lint` pass clean, `npm test` is green, and each shipped surface is verified live in the browser against its spec. No test runner is wired into the deploy today; verification is manual.
- **Strategy notes**: `.planning/intel/SYNTHESIS.md` is the entry point to the ingested decision/requirement/constraint corpus.

## Assumptions

These were supplied as defaults for an unattended planning run. Correct them and re-run `/gsd-progress` if any are wrong.

| Field | Value used | Corroboration |
|-------|-----------|---------------|
| Project name | NotRealSmart Agency | Confirmed by `CLAUDE.md` and `README.md` |
| Owner | Black Health Intelligence Pty Ltd (ABN 23 693 026 112) | Confirmed by `CLAUDE.md` |
| Project type | Brownfield — live production code | Confirmed by `.planning/codebase/*` |
| Target runtime | Next.js 15.3 App Router on Vercel (Fluid Compute, Node), Supabase Postgres + Storage, Vercel AI SDK v6 via AI Gateway | Confirmed by ADR-CLAUDE-21; note the installed `next` is 15.5.21, so "15.3, NOT 16" is a major-version constraint rather than an exact pin |
| Developer-facing success metric | build + lint clean, each surface verified live in the browser | **Assumed.** ADR-CLAUDE-27 mandates build + lint; `npm test` (47 files, Node test runner) also exists but is not named in the locked rule |
| Primary user | Non-technical business owner | **Not an assumption** — locked in ADR-CLAUDE-05 |

## Requirements

Full checkable list with IDs: `.planning/REQUIREMENTS.md`. Summary of active scope:

### Validated

Shipped and running in production (evidenced by `.planning/codebase/`):

- ✓ Director chat via `streamText` + AI Gateway, with per-department AgentWorkers, intent routing, budgets and audit
- ✓ MCP server with Bearer + OAuth 2.0 PKCE auth and a structural `HIDDEN_FROM_MCP` allowlist
- ✓ Single-owner media processing pipeline (thumbnail → transcription → AI tagging)
- ✓ Mixpost self-hosted publishing with draft sync, tag sync and HMAC-verified webhooks
- ✓ Project-scope foundation: `ExecutionScope`, marketing-data boundary gate, project-scoped Director prompts
- ✓ 21-section brand proforma engine, team members + RLS helper functions, Stripe billing

### Active

- [ ] **GOV** — Close the three open decisions, finish project-boundary hardening, prove isolation, gate the deploy
- [ ] **STU** — Creative Studio delivers a complete idea → approved-content flow with per-content-type forms
- [ ] **PUB** — Approved content reaches platform accounts reliably, self-serve, in plain language
- [ ] **TEL** — Telegram is an evidence-backed, project-scoped marketing chief (gated on the Telegram decision)
- [ ] **OPT** — The agency learns from published performance and tells the owner what to change
- [ ] **BKT** — A website URL alone produces a brand kit and shareable marketing assets

### Out of Scope

- **CRM segmentation, customer lifetime value prediction, SMS** — recorded as explicit non-requirements in the Klaviyo/Madison competitive analysis: "different product" (`REQ-competitive-scope-exclusions`).
- **Rebuilding the landing page or About hero** — locked off (ADR-CLAUDE-24). `src/app/page.tsx` / WaterRippleHero must not be touched.
- **Three.js for any new feature** — locked off (ADR-CLAUDE-24). CSS/SVG/Canvas 2D only.
- **A second marketing orchestrator (Hyper MCP or equivalent)** — the NRS Director stays the single orchestrator for web, MCP and Telegram (`docs/marketing-skills-adaptation.md`).
- **A second media-processing path** — `runMediaProcessingPipeline` is the only permitted writer to `media_items` (ADR-CLAUDE-15).
- **Paid third-party AI APIs as a default, and direct provider SDK calls in the agent path** — every model call goes through the AI Gateway (ADR-CLAUDE-21, ADR-CLAUDE-28).
- **Route groups** — flat routes only (ADR-CLAUDE-23).
- **Migrating the Telegram durable brain to Eve inside this milestone** — deferred to v2, and only behind parity tests and a reversible cutover (Telegram chief plan, Tasks 6–7).
- **The 62 GitBook help-centre pages** — excluded from the ingest as customer documentation, not planning intel. Re-ingest explicitly if needed.

## Context

**Where the truth lives.** `CLAUDE.md` is the locked ADR (precedence 0). `AGENTS.md` is a Codex-facing mirror produced by a global "Claude" → "Codex" substitution, which corrupted several identifiers (`anthropic/Codex-sonnet-4`, `Codex Haiku`, `~/.Codex/projects/…`). Never trust an identifier from `AGENTS.md`; only its Cowork-specific brand/compliance/approval rules are unique, and those are recorded as *proposed*, not locked.

**Documentation drift is real.** Three documented statements are already outranked and should not be used for planning: `docs/ARCHITECTURE.md` claims 13 agents (it is 14) and 15 tables (it is 50+ referenced in code); `README.md` claims Memory v2 is fully shipped while `CLAUDE.md` still describes Ruflo keyword memory as current. The codebase map shows **both** memory tracks live side by side (`src/lib/memory/` v2 and `src/lib/ruflo/` v1) — which is why memory consolidation is an explicit requirement, not a documentation fix.

**Several specs have already been executed.** The project-boundary foundation plan and the publishing/verification hardening plan both mark all tasks complete, and the codebase confirms `ExecutionScope`, `marketing-data-boundary.ts`, `project-access.ts`, `director-only-tools.ts` and a fail-closed Mixpost signature helper exist. What remains from those specs is the deferred migration set, the isolation evidence suite, and wiring CI into the deploy gate.

**Compliance is not optional.** Downscale, DownscaleDerm, TeleScribe and EndorseMe are AHPRA/TGA regulated at $60K/$120K per offence. Scent Sell and NRS itself are not. Health brands get `zeroDataRetention: true` on the gateway call and a compliance filter inside `save_output`.

**Diagnostics rule.** The user is non-technical: never ask for DevTools. Client breadcrumbs POST to `/api/debug/upload-log` and are read from the terminal (`scripts/read-upload-trace.mjs`). Extend that pattern for any new class of client-side bug.

## Constraints

- **Tech stack**: Next.js 15.3 (NOT 16), React 19, Tailwind 4 (oklch only), shadcn/ui v4 on base-ui (`render` prop, never `asChild`), Supabase (three clients, never mixed), AI SDK v6 `streamText`, Zod v4 with `zod/v3` for tool schemas. — ADR-CLAUDE-21.
- **Security**: Structural, not prompt-based. MCP tool hiding, project scoping and RLS are enforced in code and in Postgres. A prompt instruction is never an acceptable control. — project-boundary design.
- **Data boundary**: NRS is marketing-only. Patient, clinical, personal, customer, confidential-operational and private lab data is rejected at the channel boundary, and rejected content is never written to prompts, jobs, memories or audit detail.
- **Approval**: Publishing, sending, paid spend and data export are always explicit approval actions. Drafts land in Review; approval never widens scope.
- **Schema**: Forward-only migrations `NNN_snake_case.sql`, never renumbered or edited after application; `src/types/database.ts` updated in the same commit; trigger function is `update_updated_at()`. Live migrations need explicit approval. `media_items` has **no `status` column** — including one silently drops the whole update (PGRST204).
- **Performance/serverless**: Media must stream, never buffer. Director `stepCountIs(8)`, workers `stepCountIs(3)`, `MAX_CONCURRENT_WORKERS = 4`. These are runaway guards, not tuning knobs.
- **Budget**: Integer cents only, priced centrally in `src/lib/ai/model-routing.ts`, charged to `agent_registry`, 429 when exhausted.
- **Process**: Superpowers workflow is mandatory (`brainstorming` → `writing-plans` → `test-driven-development` → `verification-before-completion`). gbrain brain-first lookup before external research. Australian English throughout.
- **Deployment**: Pushes to `main` deploy production. There is currently no automated gate between a push and production.

## Key Decisions

<decisions status="locked" source="CLAUDE.md" precedence="0" count="33">

Full text: `.planning/intel/decisions.md`. These are locked — changing any one requires an explicit ADR amendment, not a code change.

| ID | Decision |
|----|----------|
| ADR-CLAUDE-01 | Rule Zero — build for how marketing works in 12 months; "medium term" = 2 weeks |
| ADR-CLAUDE-02 | Build our own technology; third-party tools are temporary bridges, never the product |
| ADR-CLAUDE-03 | Publishing via direct platform APIs, no middleware dependencies — **see DEC-03, contradicts ADR-CLAUDE-14** |
| ADR-CLAUDE-04 | Never show plumbing — Mixpost, Postiz, OAuth must never surface in the UI |
| ADR-CLAUDE-05 | First Principle — the user is a non-technical business owner; conversation-first, auto-fill, plain language |
| ADR-CLAUDE-06 | One screen: brands + chat. The Director is the only face; departments are invisible |
| ADR-CLAUDE-07 | MCP allowlist — plug-in AIs are messengers, enforced by `HIDDEN_FROM_MCP` |
| ADR-CLAUDE-08 | New-tool exposure procedure: bounded/read-only auto-exposed; multi-step must be hidden + documented |
| ADR-CLAUDE-09 | MCP auth — Bearer and OAuth 2.0 PKCE both mint the same `nrs_sk_` key type |
| ADR-CLAUDE-10 | Agent execution uses `streamText`, never `ToolLoopAgent` |
| ADR-CLAUDE-11 | True multi-agent AgentWorker — own model, memory, tools, budget, audit per department |
| ADR-CLAUDE-12 | 14 agents: 1 Director + 13 departments; `martech` archived |
| ADR-CLAUDE-13 | Rule-based intent router, not an LLM call; 2+ departments ⇒ `convene_meeting` |
| ADR-CLAUDE-14 | Mixpost self-hosted publisher replaces Ayrshare — **see DEC-03, contradicts ADR-CLAUDE-03** |
| ADR-CLAUDE-15 | `runMediaProcessingPipeline` is the single source of truth for `media_items` processing writes |
| ADR-CLAUDE-16 | `media_items` has no `status` column — a `status` field rejects the entire update |
| ADR-CLAUDE-17 | Never ask the user to open DevTools; build self-reporting client diagnostics |
| ADR-CLAUDE-18 | Compliance filter (Haiku, AHPRA/TGA) runs automatically inside `save_output` |
| ADR-CLAUDE-19 | Memory is Ruflo today with mem0-on-pgvector as the planned replacement |
| ADR-CLAUDE-20 | Planned major builds: mem0 memory, self-updating daily research knowledge |
| ADR-CLAUDE-21 | Stack selection (Next 15.3, React 19, Tailwind 4 oklch, base-ui, AI SDK v6, zod/v3 for tools) |
| ADR-CLAUDE-22 | Three rooms: Director's Office, Creative Studio, Command Centre — **see DEC-02 for Studio sub-tabs** |
| ADR-CLAUDE-23 | Flat routes only, no route groups; `force-dynamic` on base-ui pages |
| ADR-CLAUDE-24 | Homepage and Three.js are off-limits |
| ADR-CLAUDE-25 | Australian English; oklch silver/chrome palette hue ~240; IBM Plex |
| ADR-CLAUDE-26 | Budget in cents, append-only audit, configs-vs-registry split, central cost formula |
| ADR-CLAUDE-27 | Repo is `~/NotRealSmartAgency`; secrets stay in `.env.local`; build + lint must pass |
| ADR-CLAUDE-28 | gbrain brain-first is mandatory; no paid third-party AI APIs; embeddings via local Ollama |
| ADR-CLAUDE-29 | Read the three Creative Studio specs before any Creator/Review/Schedule/Media work |
| ADR-CLAUDE-30 | Superpowers development workflow is mandatory |
| ADR-CLAUDE-31 | Team access model: `team_members` roles + three RLS helper functions |
| ADR-CLAUDE-32 | Hybrid API-key resolution: `user_integrations` first, env var fallback |
| ADR-CLAUDE-33 | Master Marketing Proforma — 21 sections per brand with RAG and staleness |

</decisions>

<decisions status="proposed" source="AGENTS.md" precedence="1" count="7">

Imported from the Cowork-facing mirror. Not locked — no `Accepted` status field is present in the source. Promote or discard deliberately.

| ID | Decision |
|----|----------|
| ADR-AGENTS-01 | Always call `list_brands` first; trust the tools; report tool errors rather than guessing |
| ADR-AGENTS-02 | Never cross-post between brands; always confirm which brand before publishing |
| ADR-AGENTS-03 | Health brands (Downscale, TeleScribe, DownscaleDerm, EndorseMe): no testimonials, no before/after, no guaranteed outcomes, no named medications. Scent Sell and NRS are unrestricted |
| ADR-AGENTS-04 | Audience targeting per brand: TeleScribe → clinicians, Downscale → patients |
| ADR-AGENTS-05 | Show the content, wait for approval, then publish. One action at a time |
| ADR-AGENTS-06 | Check `query_calendar` before creating posts to avoid duplicates |
| ADR-AGENTS-07 | Recorded Mixpost account inventory per brand |

</decisions>

<decisions status="open" count="3">

Three competing variants surfaced by ingest. **Neither variant has been selected.** Both positions are preserved verbatim in `.planning/INGEST-CONFLICTS.md` and `.planning/intel/constraints.md`. Each gates at least one roadmap phase.

---

**DEC-01 — Telegram channel state: disabled surface, or primary marketing interface?**

- *Variant A (disable)* — `docs/superpowers/plans/2026-07-24-nrs-project-boundary-foundation.md` (SPEC, precedence 20): "Telegram webhook stays disabled; no code path may re-enable it." Its execution record confirms the webhook was replaced with a fail-closed maintenance response that creates no jobs, reads no memory and lists no projects. Reinforced by the precedence-10 boundary design: "Telegram remains disabled until the entire acceptance suite passes and the BotFather token has been rotated."
- *Variant B (build on it)* — `docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md` (SPEC, precedence 20): "Keep the existing project-scoped Telegram webhook as the secure edge until an Eve channel reaches parity", and builds seven tasks of intake, evidence, learning and delivery on top of a live webhook.
- *Why unresolved*: equal precedence (both 20); resolving by date would be an arbitrary tiebreaker. The precedence-10 design does resolve the design-vs-plan axis in favour of "gated on the acceptance suite + token rotation", but not the plan-vs-plan clash.
- *What it changes*: whether the Telegram marketing chief is buildable at all in this milestone.
- *Gates*: **Phase 4**. Also shapes the acceptance-suite scope in Phase 1.
- *To resolve*: pick a variant and record it as an ADR. If re-enabling, mark the foundation plan's Telegram constraint superseded and raise the chief plan's precedence in the manifest. If staying disabled, keep Phase 4 gated behind the Phase 1 acceptance suite plus BotFather token rotation.

---

**DEC-02 — Creative Studio room model: six creation rooms, or a four-room pipeline?**

- *Variant A (six rooms)* — `docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md` (SPEC, precedence 10): the Create tab becomes "a launchpad into 6 full-screen creation workspaces" at `/agency/studio/{video,design,post,campaign,repurpose}` plus an enhanced Calendar tab. Founding principles: user has options (AI does it / edit yourself / both), strategy guides everything, Director reviews everything, same brain everywhere, one click to value.
- *Variant B (four-room pipeline)* — `docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md` (SPEC, precedence 10): an explicit tab replacement — "BEFORE: All Content | Calendar | Media | Create | Grid Planner (default: All Content). AFTER: Create | Review | Schedule | Media (default: Create)" — folding Grid Planner into Create, All Content into Command Centre, and Calendar into Schedule. Creator is THE centre with three entry points.
- *Why unresolved*: both are precedence-10 design specs describing the same surface with incompatible structures.
- *What it changes*: routes, tab config in `src/lib/room-config.ts`, and component ownership across `src/components/agency/studio/`. Building from both produces contradictory navigation. Note the codebase currently contains routes matching **both** models (`studio/create`, `studio/review`, `studio/calendar`, `studio/media` **and** `studio/post`, `studio/design`, `studio/video`, `studio/campaign`, `studio/repurpose`), so the ambiguity is already shipped.
- *Gates*: **Phase 2**, and the Studio-facing parts of Phase 6.
- *To resolve*: choose one model — or state explicitly that the six-room design is superseded by the four-room pipeline — and set the winning spec's precedence in `.planning/ingest-manifest.yaml`.

---

**DEC-03 — Publishing transport: direct platform APIs, or the Mixpost bridge?**

- *Variant A (direct APIs)* — `CLAUDE.md` Rule Zero (ADR, **locked**, precedence 0): "Publishing: Direct platform APIs (Meta Graph, YouTube Data, TikTok Content, LinkedIn). No middleware dependencies. CLI agentic pattern — agent calls platform API directly as a tool."
- *Variant B (Mixpost bridge)* — `CLAUDE.md` (same locked ADR): "Mixpost Self-Hosted Publisher (LIVE) … Cron publisher uses Mixpost first, Ayrshare as fallback." Reinforced by the precedence-10 boundary design: "Mixpost remains the owned publishing bridge."
- *Why unresolved*: the contradiction is **internal to a single locked ADR** — a locked document cannot outrank itself. Precedence cannot resolve it.
- *What it changes*: publishing architecture, failure modes, and the Rule Zero compliance story ("no middleware dependencies" versus a self-hosted Laravel middleware). Roadmapping either direction silently discards a locked decision. The codebase already implements both: `src/lib/publishers/{meta,linkedin,tiktok,twitter,youtube}.ts` behind `USE_NATIVE_PUBLISHER_<PLATFORM>` flags, falling back to Mixpost, then Ayrshare.
- *Gates*: **Phase 3**. Phase 5 depends on whichever transport reports performance data.
- *To resolve*: state whether Mixpost is the target transport or an explicitly time-boxed bridge to direct platform APIs, then amend the Rule Zero publishing clause in `CLAUDE.md` so the locked ADR no longer contradicts itself.

---

**DEC-04 (related, auto-resolved but stale) — MCP exposure of `publish_to_social` and `manage_posts`.**
Not one of the three competing variants, but flagged for attention. The locked ADR-CLAUDE-07 lists `publish_to_social` and `manage_posts` as *exposed* on MCP; the precedence-10 publishing-hardening design requires them to stay *Director-only*, and its implementation plan marks every task complete. Precedence was applied as written (locked ADR wins), but the ADR text predates the hardening decision and the codebase now contains `src/lib/mcp/director-only-tools.ts`. Reconciling this is a requirement in Phase 3 (PUB-03), not an assumption.

</decisions>

---
*Last updated: 2026-07-28 after unattended `gsd-ingest-docs` → roadmap run*
