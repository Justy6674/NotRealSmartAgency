# Telegram Marketing Chief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NotRealSmart on Telegram Justin's private, natural-language marketing chief: it understands the active project, researches approved sources, remembers verified decisions and feedback, delivers finished work, and never requires slash commands for normal use.

**Architecture:** Keep the existing project-scoped Telegram webhook as the secure edge until an Eve channel reaches parity. Add a Telegram-chief orchestration layer between inbound text and `runDirectorJob`: it resolves a safe conversational intent, gathers only project-approved evidence, passes a compact evidence pack plus project memory to the Director, and formats a complete plain-text delivery. Learning is project-bound, source-attributed, and reviewable; no customer data, secrets, or sibling-project context enters it.

**Tech Stack:** Next.js, TypeScript, Supabase/Postgres + pgvector, Vercel AI Gateway, Telegram Bot API, GitHub App (selected repositories, read-only), Eve migration target.

## Global Constraints

- Telegram is natural language first. Never tell Justin to type `/` for routine work; retain slash parsing only as undocumented backwards compatibility.
- A Telegram session has exactly one active project. A plain-language switch request opens an explicit project picker; wording alone never expands scope.
- Every connector is project-bound, read-only by default, and limited to a named resource contract. Never retrieve raw database tables, customer lists, patient data, credentials, or source secrets.
- Brand facts, founder decisions, preferences, generated drafts, and performance outcomes are separate data classes. Generated copy is never promoted to fact merely because the model wrote it.
- Live website/repository/social evidence overrides conflicting stale memory, is time-stamped, and is cited internally in the delivery record.
- All publishing, messaging to customers, email, paid-spend, and data export remain explicit approval actions. NRS may prepare a draft and a proposed audience rule, never broadcast by itself.
- Telegram output is concise, plain text, and complete: no Markdown delimiters, no generic praise, no unexplained claims, and no vague “want me to?” ending.
- Keep the current explicit project-grant, scope-proof, audit, and webhook-secret controls. New work must not weaken them.
- Move the durable agent brain to Eve only behind parity tests and a reversible cutover; do not rewrite the live bot in place.

## Experience Contract

Justin can send: “Do Today: scan the site, compare our positioning with competitors, and give me this week’s launch plan.”

NRS replies with:

1. A short, truthful acknowledgement naming the project and the work underway.
2. A finished brief: verified findings, recommended decision, ready-to-use assets, and the single best next action.
3. An inline action only when it is safe: save a plan, make posts, request publishing approval, or change project.
4. A human response such as “too clinical”, “remember we are national”, or “make that for Scent Sell” which becomes scoped feedback or presents the project picker.

## File Map

**Modify**

- `src/app/api/webhooks/telegram/route.ts` — replace slash-first routing with the Telegram-chief intake, keep owner pairing/scope validation, and deliver a named run result.
- `src/lib/telegram/scoped-telegram.ts` — map plain-language project, connection, status, and feedback phrases to safe intents; callbacks remain the only selector for project changes.
- `src/lib/telegram/telegram-marketing-copy.ts` and `src/lib/telegram/telegram-job-status.ts` — enforce the final Telegram delivery contract.
- `src/lib/mcp/director-job.ts` — accept a prepared evidence pack and a work contract, persist outcome metadata, and retain deterministic source-first scan flows.
- `src/lib/agents/prompt-builder.ts` — inject only active-project verified knowledge, approved source freshness, user corrections, and channel-specific response instructions.
- `src/lib/memory/store.ts`, `src/lib/memory/fact-extractor.ts`, and `src/lib/ruflo/memory-extractor.ts` — add typed, attributable project learning with confidence, source, and review state.
- `src/lib/agents/performance-learner.ts`, `src/app/api/cron/consolidate-memories/route.ts`, and `src/app/api/cron/performance-learn/route.ts` — consolidate only proven project outcomes and expire stale source facts.
- `src/lib/github/github-app-client.ts`, `src/lib/github/repository-context.ts`, and `src/app/api/integrations/github/callback/route.ts` — build bounded evidence from installed, selected GitHub repositories only.
- `supabase/migrations/041_telegram_marketing_chief.sql` — add the durable run/evidence/learning schema, RLS, and provenance checks after explicit migration approval.

**Create**

- `src/lib/telegram/telegram-chief-intent.ts` — deterministic intent classifier and safe fallback for ordinary language.
- `src/lib/telegram/telegram-chief-state.ts` — project-bound conversation state without raw message retention.
- `src/lib/marketing/evidence-pack.ts` — normalize website, GitHub, social, and analytics observations with source/freshness/confidence.
- `src/lib/marketing/work-contract.ts` — define the exact deliverable expected from common asks: audit, launch plan, campaign, content pack, website review, or status.
- `src/lib/marketing/learning-ledger.ts` — append only verified corrections, explicit founder decisions, and measured outcomes.
- `src/lib/marketing/telegram-delivery.ts` — build the concise completed-result format and safe Telegram action buttons.
- `src/lib/agents/telegram-chief-evals.ts` — reusable transcript/evidence safety evaluation fixtures.
- `agent/` and `evals/` — Eve parity implementation, added only after the current Telegram chief passes its behaviour and isolation evaluations.

## Tasks

### Task 1: Lock the conversation contract and safe natural-language intake

**Files:** `src/lib/telegram/telegram-chief-intent.ts`, `src/lib/telegram/scoped-telegram.ts`, `src/app/api/webhooks/telegram/route.ts`, unit tests alongside each file.

- [ ] Write examples for plain-language project changes, scans, launch plans, research requests, “remember this”, corrections, and status questions.
- [ ] Assert that “switch to Scent Sell” returns a project-picker action and never changes the active project from text alone.
- [ ] Implement the deterministic parser before calling the model; unknown messages continue to the Director within the active project.
- [ ] Replace user-facing references to `/projects` and `/connect` with normal-language examples and buttons.
- [ ] Keep legacy command support without advertising it, so existing paired chats do not break.
- [ ] Verify private-chat-only, owner pairing, active-grant, and webhook-secret rejection paths remain unchanged.
- [ ] Commit: `feat: add natural Telegram chief intake`.

### Task 2: Build a source-grounded evidence pack

**Files:** `src/lib/marketing/evidence-pack.ts`, `src/lib/agents/tools/scan-website.ts`, GitHub connector files, `src/lib/mcp/director-job.ts`, tests.

- [ ] Define `EvidenceItem` with `projectId`, `sourceType`, `sourceUrl`, `observedAt`, `freshUntil`, `claim`, `excerpt`, `confidence`, and `classification`.
- [ ] Write failing tests showing a site-scan request always creates a fresh website evidence item and that it overrides conflicting stale brand memory in the Director prompt.
- [ ] Add bounded source collectors: configured public website and sitemap; selected GitHub App paths; approved social profiles; aggregate analytics only.
- [ ] Reject unconfigured URLs, public web claims without a source, repositories without an active binding, private paths outside the allow-list, and any detected customer/patient data.
- [ ] Persist the evidence pack against the run, not as invisible prompt text, so every conclusion can be reviewed later.
- [ ] Commit: `feat: ground Telegram work in project evidence`.

### Task 3: Give the Director an explicit work contract

**Files:** `src/lib/marketing/work-contract.ts`, `src/lib/mcp/director-job.ts`, `src/lib/agents/prompt-builder.ts`, tests.

- [ ] Define contracts for `site_review`, `marketing_audit`, `launch_plan`, `campaign_pack`, `content_pack`, `competitor_research`, and `status_update`.
- [ ] For each contract, require the inputs, evidence threshold, structured output, and one next action rather than an open-ended chat response.
- [ ] Make short commands such as “scan the site” deterministic source-first jobs; only use a specialist when it materially improves the defined deliverable.
- [ ] Require the Director to label uncertainty and missing evidence rather than inventing positioning, analytics, testimonials, compliance status, or repository facts.
- [ ] Persist a short redacted run summary and delivery status for debugging and quality measurement.
- [ ] Commit: `feat: add marketing work contracts`.

### Task 4: Implement durable, project-bound learning

**Files:** memory files, `src/lib/marketing/learning-ledger.ts`, migration 041, tests.

- [ ] Write migration tests before requesting permission to apply migration 041 to live Supabase.
- [ ] Store four distinct learning types: `founder_decision`, `brand_preference`, `verified_fact`, and `measured_outcome`.
- [ ] Every learning item carries `brand_id`, provenance, confidence, freshness, source/run id, and active/quarantined review state.
- [ ] Parse explicit feedback (“remember we are national”) into a proposed learning item; automatic capture may only store it when it is a direct user correction or backed by evidence.
- [ ] Quarantine ambiguous legacy and generated-only memories; they never enter a Telegram prompt until reviewed.
- [ ] Update retrieval to use semantic relevance plus recency and confidence, always filtered by active project id.
- [ ] Consolidate duplicates and expire source facts without rewriting founder decisions.
- [ ] Commit: `feat: add attributable project learning`.

### Task 5: Deliver finished work, not model-shaped text

**Files:** `src/lib/marketing/telegram-delivery.ts`, Telegram formatter/status files, webhook route, tests.

- [ ] Create one plain-text delivery formatter with `What I found`, `What I recommend`, `Ready to use`, and `Next action` only when relevant.
- [ ] Strip Markdown and AI scaffolding after generation, but also reject malformed answers before delivery and make one bounded repair pass using the work contract.
- [ ] Include source names and freshness in an internal detail record; surface concise source references to Justin when they support a decision.
- [ ] Add inline buttons for safe follow-ons: `Save plan`, `Make posts`, `Change project`, and approval-request actions. Buttons do not publish or message anyone.
- [ ] Test Telegram length splitting, actionable errors, cancellation, duplicate update handling, and no raw Markdown tokens in final text.
- [ ] Commit: `feat: deliver finished Telegram marketing briefs`.

### Task 6: Close the learning loop with evidence, not vibes

**Files:** performance learner, cron routes, work contract, tests.

- [ ] Attach a campaign hypothesis and a measurable metric to created plans and draft assets.
- [ ] Ingest only approved aggregate performance data from the active project; no recipient identities, chat content, patient data, or cross-project aggregation.
- [ ] Let the Director state what changed its recommendation and why, based on a recorded outcome rather than self-reported success.
- [ ] Add stale-data alerts that ask for a refresh rather than silently reusing old scans.
- [ ] Add opt-in founder briefings only after Justin chooses cadence and projects; no unsolicited client/customer marketing messages.
- [ ] Commit: `feat: add evidence-based marketing learning loop`.

### Task 7: Migrate the durable agent layer to Eve without a risky rewrite

**Files:** `agent/agent.ts`, `agent/instructions.md`, `agent/channels/telegram.ts`, `agent/connections/`, `agent/subagents/`, `agent/hooks/audit.ts`, `agent/instrumentation.ts`, `evals/`, Next config.

- [ ] Pin the installed Eve version and create an Eve Director that reads the same project scope and typed evidence pack as the current system.
- [ ] Use `defineState` for per-chat pointers only; keep detailed knowledge in Supabase with project RLS.
- [ ] Model research/read tools can run only on explicit source contracts. Every send, publish, export, spend, or connector write uses `approval()` and idempotency keys.
- [ ] Add audit hooks containing metadata only and set `recordInputs:false` and `recordOutputs:false`.
- [ ] Run the Eve agent in shadow mode against the transcript evaluation suite; compare scope, evidence, output shape, and latency without delivering duplicate messages.
- [ ] Cut Telegram over only after strict Eve evaluations, production rehearsal with Justin’s private chat, rollback route, and verified owner/project isolation.
- [ ] Commit: `feat: migrate Telegram chief to Eve`.

### Task 8: Prove the experience in production

**Files:** tests, operational checklist, no new user-facing code required beyond prior tasks.

- [ ] Unit-test every intent, source contract, learning type, formatter rule, grant boundary, GitHub allow-list, and approval gate.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; inspect the exact production deployment.
- [ ] Test a real private Telegram conversation with: a site scan, a correction, a project-switch request, a GitHub discovery run, a follow-on content request, and a denied unapproved-project request.
- [ ] Verify the stored evidence is current, the learning appears only in its project, no raw Markdown reaches Telegram, and each result answers the original request.
- [ ] Verify that a proposed client broadcast remains a draft plus an explicit approval request.
- [ ] Run `eve eval --strict` before Eve cutover and retain the old webhook route until rollback rehearsal passes.

## Definition of Done

- Justin never needs a slash command to operate NRS on Telegram.
- Every reply identifies the active project, completes a defined job, and stays free of raw Markdown and generic filler.
- NRS can reliably research the project’s approved website, selected repository, approved social profiles, and aggregate analytics.
- It learns direct founder corrections and measured outcomes for that project only, with provenance and a way to review/expire facts.
- It cannot use or reveal another project’s context, private repository paths outside the allow-list, customer/patient information, or credentials.
- It never publishes or broadcasts without an explicit approval event.
- A real Telegram rehearsal and the automated evaluation suite prove those statements before this is called complete.

## Execution Order

Implement Tasks 1–5 as the first live-value release. Tasks 6–7 extend learning and migrate safely once the natural-language experience is proven. Task 8 is a release gate, not an optional clean-up step.
