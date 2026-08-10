# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before you touch anything: the knowledge layer is not optional

This repo has three memory systems that already know things. Reading source files to work out something they can answer is a failure, not diligence. Use them in this order.

### 1. graphify — the code graph, for "how does this work / where is X / what calls Y"

`graphify-out/` is live in this repo: **17,613 nodes · 23,585 edges · 1,689 files**, built from commit `c6512bce`. Query it instead of fanning out greps.

```bash
graphify explain "create-draft.ts"                     # node + every caller and import, with file:line
graphify path "chat/route.ts" "worker.ts"              # shortest path; add --undirected if none found
graphify update .                                      # AFTER changing code — no LLM, no API cost
```

`graphify explain "create-draft.ts"` returns all eight call-sites of `createDraftPost` (fill-calendar, draft-post-tool, repurpose-content, process-media, ab-test, manage-posts, approve-proposal, scheduled-posts/route) in one call. Do not grep for that.

Check freshness before trusting it: `GRAPH_REPORT.md` names the commit it was built from — compare against `git rev-parse HEAD`. Useful hub nodes for this repo: `create-draft.ts`, `process-pipeline.ts`, `model-routing.ts`, `prompt-builder.ts`, `tools/index.ts`, `mixpost/client.ts`, `publishers/dispatcher.ts`, `session-memory.ts`, `useAgencyStore`, `sendToDirector`.

### 2. gbrain — the cross-project brain, for decisions, history and "have we tried this"

Brain-first lookup before any web search, external API call, or working something out from scratch. 15,049 pages, all embedded.

```bash
gbrain search "NRS director capability contract"
gbrain query "why did NRS move off Ayrshare"
gbrain doctor        # if it misbehaves — do not paper over it, report it
```

Cite anything you take from it as `(per ~/Obsidian/<path>:<line>)` or `(per gbrain slug:<slug>)`. Capture is ambient via signal-detector — do not ask permission to record a decision.

### 3. Obsidian — the specs. Read before building, write after.

`~/Obsidian/Reference/nrs-*` holds the definitive specs. These outrank both this file and the code when the question is *what should be built*:

| Spec | Read before touching |
|---|---|
| `nrs-creative-studio-definitive-architecture.md` | Creator, Review, Schedule, Media — **mandatory** |
| `nrs-creator-build-checklist.md` | any Creator work |
| `nrs-director-capability-contract.md` | Director tools, delegation, evidence rules |
| `nrs-media-processing-pipeline.md` | anything writing `media_items` |
| `nrs-mcp-architecture.md` | MCP surface, tool exposure, OAuth |
| `nrs-video-pipeline-architecture.md` | video, captions, transcode |
| `nrs-mixpost-webhooks.md`, `nrs-mixpost-webhook-setup.md`, `nrs-mixpost-upload-limits.md` | publishing |
| `nrs-social-publishing-build-plan.md` | new platform integrations |

Also `~/Obsidian/Decisions/2026-04-08-nrs-complete-architecture-spec.md` and `2026-04-06-nrs-memory-architecture-v2.md`.

**Write after.** A significant session goes to `Sessions/`, a decision to `Decisions/YYYY-MM-DD-topic.md`, research to `Reference/`. Frontmatter (`created`, `tags`, `project`) and `[[wikilinks]]` on every note. If something learned here affects Downscale, Tele360, ScentSell or any sibling project, it goes in the vault — not just in this repo's comments.

**Order of authority when sources disagree:** Obsidian spec (what to build) → code (what is built) → graphify (how it connects) → this file → `AGENTS.md` / `README.md` / `docs/`.

## External platforms: never from memory, always from the live source

Every platform this app touches versions faster than any model's training data. A model ID, a Graph API version, an endpoint shape or a rate limit recalled from memory is **stale by default**. Fetch it. This is the same rule as the AI Gateway one below, applied everywhere.

### Where to look, per platform

| Platform | Authoritative source (use this, in this order) |
|---|---|
| **AI Gateway / models** | `curl -s https://ai-gateway.vercel.sh/v1/models` — live catalogue, no auth needed. Then `vercel:ai-gateway` skill. |
| **Vercel / Next.js** | `vercel:*` skills — `vercel:nextjs`, `vercel:vercel-functions`, `vercel:deployments-cicd`, `vercel:env-vars`, `vercel:vercel-storage`, `vercel:react-best-practices`. The session-start `vercel:knowledge-update` corrects known-stale model beliefs — trust it over training data. |
| **Supabase** | `mcp__claude_ai_Supabase__search_docs` (GraphQL; call it even when you think you know), then `list_tables` / `get_advisors` / `get_logs` against the live project. `supabase-postgres-best-practices` skill. |
| **Anthropic / Claude API** | `claude-api` skill — read it before touching model IDs, pricing, caching or tool definitions. |
| **Meta (Facebook/Instagram)** | `developers.facebook.com/docs/graph-api/changelog` + the Instagram Platform changelog. Version table lists every version and its sunset date. |
| **TikTok** | `developers.tiktok.com` Content Posting API + Display API docs. |
| **LinkedIn** | `learn.microsoft.com/en-us/linkedin/marketing/versioning` — monthly `YYYYMM` versions, minimum one year support. |
| **YouTube / Google** | `developers.google.com/youtube/v3` + OAuth scope docs. |
| **X / Twitter** | `docs.x.com` — v2 endpoints and access-tier limits. |
| **Stripe** | `stripe:stripe-docs` and `stripe:stripe-best-practices` skills. |
| **Resend** | `resend:resend`, `resend:react-email` skills. |
| **Canva** | the `mcp__claude_ai_Canva__*` tools are the live surface; `help` describes them. |
| **Mixpost** | Self-hosted, so the running instance is the truth: the Laravel source on the VPS at `/opt/mixpost/`, plus `~/Obsidian/Reference/nrs-mixpost-*` which were derived from it. Public Mixpost docs lag the Pro build. |

**Fetching method** — follow the web access ladder: official API / changelog endpoint first, then WebClaw (`mcp__webclaw__scrape`, `mcp__webclaw__research`) for extraction, then Browser Harness when a real browser is genuinely needed, then PixelRAG when layout carries the meaning (pricing tables, comparison grids). Never Playwright/Puppeteer/Firecrawl outside a project E2E suite.

### Pinned external versions in this code — check before touching, and re-check on a schedule

These are hard-coded and go stale silently. Verified against live docs on **2026-08-09**:

| Pin | Location | Status at last check |
|---|---|---|
| Meta Graph `v21.0` | `src/lib/publishers/meta.ts:25`, `src/app/api/oauth/meta/callback/route.ts:19` | Latest is **v26.0**. v21.0 sunsets **21 Jan 2027**. |
| `LinkedIn-Version: 202401` | `src/lib/publishers/linkedin.ts:38` | Latest is **202607**. LinkedIn's docs cite `202401` as their example of a *deprecated* header. Note the calls go to `/v2/` (unversioned legacy), not `/rest/`, so the header may be inert — **verify against a live call before changing it**. |
| LinkedIn `api.linkedin.com/v2` | `src/lib/publishers/linkedin.ts:22`, `oauth/linkedin/callback/route.ts:16` | Legacy unversioned path; versioned API is `/rest/`. |
| X `api.x.com/2` | `src/lib/publishers/twitter.ts`, `oauth/twitter/callback/route.ts` | v2 is current. |
| YouTube Data `v3` | `oauth/youtube/callback/route.ts:18` | v3 is current. |
| Stripe `2026-02-25.clover` | `src/lib/stripe/client.ts:8` | Pinned deliberately — do not bump without reading the Stripe upgrade guide. |
| Mixpost Pro **v6** workspace-scoped paths | `src/lib/mixpost/client.ts` | `/api/{workspace_uuid}/…`. Confirm against the VPS build before changing path shapes. |

When you touch a publisher, re-verify its pin against the live changelog and update this table with the date you checked. An unchecked pin in a health-brand publishing path is a compliance exposure, not just a bug.

## Commands

```bash
npm run dev      # Turbopack dev server, port 3000
npm run build    # Production build (Webpack, not Turbopack — Vercel compat)
npm run lint     # ESLint flat config v9 (eslint.config.mjs, next/core-web-vitals)
npm test         # node:test via tsx over every src/**/*.test.ts
```

Run a single test file directly — this is the fast loop, `npm test` runs everything:

```bash
npx tsx --test src/lib/brand/enforce-name.test.ts
npx tsx --test src/lib/agents/publish-gate.test.ts
```

Operational scripts run the same way and hit **live Supabase** via `.env.local`:

```bash
npx tsx scripts/run-pipeline.ts <mediaItemId>     # re-run media processing on one row
node scripts/verify-media-state.mjs <id>          # dump a media_items row
node scripts/read-upload-trace.mjs                # client upload breadcrumbs, no DevTools needed
```

Before claiming a feature is done: `npm test`, `npm run lint`, `npm run build` all pass, then `graphify update .`.

## The two hard product rules

These override normal engineering instinct, so read them before designing anything.

1. **The user is a non-technical business owner.** Conversation-first, never form-first. If data is missing, the Director asks in chat. Plain language, never department names or plumbing (the user does not know what Mixpost or OAuth are). **Never ask the user to open DevTools, the Network tab or a console** — instrument the client to POST breadcrumbs to a server endpoint and read them from the terminal (`/api/debug/upload-log` → `scripts/read-upload-trace.mjs` is the working pattern; extend it rather than asking for a paste).
2. **The Director is the only face.** Thirteen departments exist and are invisible. External AI clients (Claude Desktop, Cowork, Codex) are *messengers* — they hand intent to `chat_with_director` and wait. They never write marketing copy or orchestrate directly.

## Architecture

### Agent execution — two entry points, one worker

`streamText` from AI SDK v6 everywhere. **Never `ToolLoopAgent`** — it breaks in this codebase.

- **`POST /api/chat`** (`src/app/api/chat/route.ts`, 524 lines) is the Director. Per request: validate → fetch brand + agent config (RLS) → `getOrCreateAgentRegistry` + `checkBudget` (429 if over) → `buildSystemPromptWithMemory` → intent-router hints → stream → `onFinish` records spend to `ai_usage` + `audit_log` and extracts memories. `stopWhen: stepCountIs(5)`. `maxDuration = 300` (Fluid Compute).
- **`runAgentWorker`** (`src/lib/agents/worker.ts`) is every department. Own model, own memory namespace, own tool set, own budget, own audit row, `stepCountIs(3)`, max 4 concurrent (`MAX_CONCURRENT_WORKERS`).
- The Director reaches workers via `delegate_to_agent` (one) or `convene_meeting` (2–6 in parallel, `Promise.allSettled`). `/api/heartbeat` uses the same worker so cron and chat behave identically.
- `src/lib/agents/task-capability-plan.ts` holds the capability contract — a department must return *evidence* that a tool actually ran this turn, not a claim that it did. See `nrs-director-capability-contract.md`.

### Model routing — one source of truth

`src/lib/ai/model-routing.ts` owns every model choice. Four tiers (`fast`/`agency`/`frontier`/`code`) with explicit fallback chains. Departments map to a tier only when there is a real reason (compliance → frontier, competitor/website/analytics → fast); everything else falls through to `agency`. It is a list of exceptions, not a config file to fill in.

Model IDs and prices there were read from `GET https://ai-gateway.vercel.sh/v1/models` on 2026-08-09, not recalled. If you change one, check the live catalogue — never write a model ID from memory. AI Gateway credentials are auto-injected on Vercel; never configure a provider manually.

### Gates — regulatory checks live at the exits, not in the callers

Four brands advertise regulated health services (AHPRA/TGA, up to $60K per offence). Two chokepoints, so a new code path cannot skip them:

- `src/lib/agents/publish-gate.ts` — every publishing route passes through it. Previously only the Mixpost tool checked, so scheduling or direct-publishing reached live accounts unreviewed.
- `src/lib/agents/save-gate.ts` — the outputs library is not passive storage; `query_outputs` is given to every department, so anything saved becomes something later work imitates. Failed content must not be written down.

Add a new publisher or save path → route it through the existing gate; do not re-implement the check.

### Canonical pipelines — one function owns each write

Three places where "just insert the row" is the bug:

- **Drafts** — `src/lib/posts/create-draft.ts` `createDraftPost()`. The one place a draft is born: insert *and* Mixpost push together. Never raw-insert `scheduled_posts`. Returns a `mixpost` field of `synced` / `pending` / `failed` — **relay it honestly**; `pending` is not done.
- **Media** — `src/lib/media/process-pipeline.ts` `runMediaProcessingPipeline()`. Owns every `media_items` mutation touching thumbnail, transcription or AI tagging. Both `/api/media/process` and the Director's `process_media` tool delegate to it. `media_items` has `transcription_status` but **no `status` column** — an update including `status:` is rejected wholesale by PostgREST and silently drops everything with it.
- **MCP exposure** — `src/lib/mcp/server.ts` `HIDDEN_FROM_MCP`. Hidden tools are never registered on the MCP surface; they exist only inside the Director's internal loop. A new tool that is multi-step or writes marketing copy goes in that set. Query-only or bounded single-shot tools need no action.

### Memory (in-app, distinct from gbrain)

Three layers on Supabase + pgvector: individual facts (`agent_memories`, semantic search, >0.85 cosine = update not insert), a compounding per-brand session record, and a cross-department global namespace (`nrs-agency`). Namespaces are `nrs-{brandSlug}-{agentType}`.

`agent_memories.value` is a **TEXT** column — reads return a string. Always go through `parseMemoryValue()` (`src/lib/memory/memory-value.ts`). Casting it straight to an object fails silently and has already disabled three features at once.

### Tools

73 files in `src/lib/agents/tools/`. Factory functions take context (`supabase`, `userId`, `brandId`) and return AI SDK tool objects with Zod schemas. `tools/index.ts` assembles the per-agent set via `getToolsForAgent()`. Import Zod as `import { z } from 'zod/v3'` for tool schemas — v4 shapes break AI SDK.

A tool's returned string is **read aloud to the owner**, so it may not interpolate a raw error. Log with `console.error`, or pass through `userSafeError()` first. Enforced by a test (below).

### Data & auth

Three Supabase clients, do not mix: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (RSC + API routes), `lib/supabase/admin.ts` (service role — webhooks, cron). `src/middleware.ts` refreshes the session on every non-static request; all `/agency/*` requires auth. RLS uses three helper functions (`is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand`) rather than per-table policies. Migrations in `supabase/migrations/`. Types in `src/types/database.ts` — check it before writing an update.

Six Vercel crons (`vercel.json`): heartbeat 15min, publish-posts 5min, recover-director-jobs 5min, daily-intel, web-vitals, weekly-traffic.

## Tests are guardrails, not just unit tests

Several tests read the source tree and fail the build on an architectural violation. Treat a failure as "you broke a rule", not "fix the assertion":

- `src/lib/errors/no-raw-errors.test.ts` — scans every tool for raw error interpolation in returned strings
- `src/lib/agents/regulatory-invariants.test.ts`, `publish-gate.test.ts`, `save-gate.test.ts` — compliance chokepoints
- `src/lib/security/*-migration.test.ts` — project-scope and GitHub-connector isolation
- `src/lib/video/binary-shipped.test.ts`, `agents/heygen-removal.test.ts` — dependency invariants

## Conventions

- **Australian English** in all code, copy and comments (colour, behaviour, organisation)
- **oklch colours only**; silver/chrome palette, hue ~240; IBM Plex Sans + Mono
- **base-ui / shadcn v4**: use the `render` prop, never `asChild`. `force-dynamic` on pages using base-ui.
- **Flat routes** — no route groups
- Budget in **cents** (integers). `audit_log` is append-only.
- `agent_configs` = templates; `agent_registry` = runtime state (status, budget, model)
- Trigger is `update_updated_at()`, not `update_updated_at_column()`
- Supabase credentials are already in `.env.local` — use them, never ask for them
- **Never touch** `src/app/page.tsx` / `WaterRippleHero`. **No new Three.js** — it exists only for the landing and about heroes.
- Build our own tech first; third-party services are temporary bridges, never the product

Comments here carry the incident that motivated the code (see `memory-value.ts`, `create-draft.ts`, `publish-gate.ts`). Match that: explain why the obvious approach was wrong, not what the code does.

## Repo docs, and how much to trust them

- `AGENTS.md` (674 lines) — the fullest inventory: all 14 agents and their tools, the 21-section proforma, slash commands, room navigation, Mixpost specifics. **Caveat: it has been through a find/replace of "Claude" → "Codex"**, so it carries corrupted identifiers (`anthropic/Codex-sonnet-4`, `~/.Codex/projects/`). Read it for structure, not literal strings.
- `README.md` — accurate on intent, stale on versions (says Next 15.3; package.json is 15.5.21) and describes Ruflo as the current memory system.
- `docs/ARCHITECTURE.md` — stale model list (`claude-sonnet-4 → gpt-4.1`); `src/lib/ai/model-routing.ts` is authoritative.

When code and prose disagree, the code wins — except on *what should be built*, where the Obsidian spec wins.

## Skill routing

gstack is installed globally (53 skills). When a request matches one, **invoke it via the Skill tool** rather than improvising the same work by hand. When in doubt, invoke the skill. The owner should not have to type the command to get the discipline.

| The request | Invoke |
|---|---|
| Vague idea, "should we build X", empty repo | `/office-hours`, then `/spec` |
| Plan a feature | `/autoplan` (or `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`) |
| Bug, error, "why is this broken", "it worked yesterday", a red box | `/investigate` — never debug directly |
| "Does this work", QA a running app | `/qa` (report-only: `/qa-only`) |
| Visual polish, spacing, hierarchy | `/design-review`; new direction → `/design-consultation` |
| Before landing a change | `/review` |
| Anything touching auth, PHI, billing, payments, RLS | `/cso` — not optional on this codebase |
| Ship it | `/ship`, then `/land-and-deploy`, then `/canary` |
| Save / resume working context | `/context-save`, `/context-restore` |
| Weekly | `/retro`. Keep current with `/gstack-upgrade`. |

**Craft skills sit inside whichever gstack skill is running**, not instead of it: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, and `impeccable` for any UI work.

**Order of operations inside any of them:** the knowledge layer at the top of this file comes first. graphify before grepping, gbrain before searching the web, the Obsidian spec before designing. A skill does not excuse skipping those.

**Safety is on demand here, never a blocking gate.** `/careful` before destructive commands, `/freeze` to lock edits to one directory, `/guard` for both, `/unfreeze` to release. Do **not** add PreToolUse hooks that block edits — that is a deliberate standing decision, not an oversight.

**Ship straight to `main`.** No feature branches or PRs unless explicitly asked. Pause and confirm first for: live Supabase schema migrations, auth / RLS / billing / payments, refactors whose scope the owner has not seen, or any "hold" / "wait" / "stop".
