# NotRealSmart Agency

**Your own AI marketing agency.** You talk to one Director. Behind it, fourteen
specialist departments do the work — and you never see them.

> Not(Artificial) Real(Intelligence) Smart

Built by a clinician who runs a group of small businesses and got sick of paying
agencies.

---

## What this actually is

Most marketing tools hand you a form and expect you to know what to put in it.
This one asks. You say *"we're quiet on Instagram this week"*, and the Director
works out what that means, pulls in whichever departments it needs, drafts the
work, and brings it back to you for a yes or a no.

Three rules shape everything in this repo, and they override normal engineering
instinct:

1. **Conversation first, never forms first.** If something is missing, the
   Director asks for it in chat. It does not open a wizard.
2. **The Director is the only face.** Fourteen departments exist. They are
   invisible. Nobody using this should ever hear the words "delegation",
   "worker" or "OAuth".
3. **Never send the owner to DevTools.** No Network tab, no console, no
   "paste me the error". Diagnostics report themselves to a server endpoint and
   are read from a terminal instead — `/api/debug/upload-log` feeding
   `scripts/read-upload-trace.mjs` is the working pattern to copy.

## How a post actually reaches a social account

This is the part people get wrong, so it is here near the top rather than buried
in the architecture section.

**There is one door: `src/lib/publishers/dispatcher.ts`.** It is the only
function allowed to decide where a post goes, and every new publishing path must
go through it.

That rule exists because the choice used to live in two places that disagreed.
The 5-minute cron preferred Zernio; `/api/scheduled-posts/publish-now` had no
Zernio code in it at all and always went to Mixpost. Those are two separate OAuth
connections to two separate services, and nothing asserts they point at the same
Facebook Page. The Review panel puts both buttons on the same row, so "Schedule"
landed on one account and "Publish now" landed on the other — and once a row was
marked failed, the cron would not retry it, because it only selects
`status='scheduled'`.

**Write path, re-checked 2026-08-17:** cron, `/api/scheduled-posts/publish-now`,
and `publish_to_social` all go through `publishToPlatform`. The remaining gap is
**reads** — social analytics and several account lists still ask Mixpost;
`/api/studio/overview` now asks Zernio when the brand has a profile. Verify:

```bash
grep -rln "publishToPlatform" src
```

Behind the door are two transports:

| Transport | Used for | Why |
|---|---|---|
| **Zernio** | Subscribers | Zernio owns the platform OAuth apps, their review cycles and their sunsets, so we do not have to |
| **Self-hosted Mixpost** | Justin's own brands | Keeps it exercised daily, which is the only thing that makes a fallback a real fallback rather than a dusty one |

Selection is **per brand**: if the brand has a Zernio profile with an account for
that platform, the post goes to Zernio; otherwise it falls through to native
(where a `USE_NATIVE_PUBLISHER_*` env var is set) or to Mixpost. Zernio profile
ids live on `brands.social_urls.zernio_profile_id`. Two brands are linked so far
— Scent Sell and EndorseMe.

Every attempt is written to the `publisher_runs` table, whichever transport it
took.

### Why this does not break the Build-First rule

We build our own technology first; third-party services are bridges, never the
product. Zernio does not break that, because of **where the abstraction sits**.
NRS still owns everything that is actually the product — the brand intelligence,
the AHPRA/TGA gate, the composer, the scheduling model, the memory layers.
Zernio is a *transport* sitting behind our own interface, swappable without
touching a line of product logic. Wiring Zernio's API shapes up through the
application would have sold the spine. Putting it behind `dispatcher.ts` does
not.

Decision and full reasoning:
`~/Obsidian/Decisions/2026-08-17-nrs-zernio-for-subscribers-mixpost-as-fallback.md`.

### The one thing you must not assume about Zernio

> **Zernio does not enforce customer isolation. A profile is an organisational
> boundary, not a security one. Every boundary between subscribers is our code.**

Zernio's own multi-tenant guide is explicit: posts validate `accountId` against
your whole team, not against a profile, so you must keep the
account-to-customer mapping yourself and only ever pass a customer their own
account ids.

Measured against the live account on 2026-08-17: `listAccounts({ profileId })`
accepts the filter and **ignores it** — ten accounts came back with the filter
and the same ten without. A source comment had asserted the opposite. Filtering
therefore happens in our code, inside `fetchZernioAccounts`
(`src/lib/zernio/client.ts`), and it happens **after** `normaliseAccount`,
because the raw `profileId` is sometimes a populated `{_id, name}` object rather
than a string. That behaviour is pinned by
`src/lib/zernio/account-scoping.test.ts` — if that test goes red, subscriber
isolation is broken, not the test.

The same social account can also sit under more than one profile, because Zernio
migrates accounts to another profile when one is deleted rather than deleting
them. An unfiltered publisher matching on platform alone can match twice and
post identical content twice to the same page.

Full pattern, the eight integration steps, rate limits, pricing and the list of
what NRS still lacks before subscriptions can be sold:
`~/Obsidian/Reference/nrs-zernio-multi-tenant-integration.md`.

## Regulated health advertising — read this before changing any exit

This is not a footnote. It is the reason two whole modules exist.

Of the eleven active brands, **four advertise regulated health services** and
are subject to AHPRA and TGA advertising law. The penalty runs to **$60,000 per
offence**. A single unreviewed claim in a caption is a regulatory event, not a
typo.

So the regulatory checks live at the **exits**, not in the callers — because a
new code path can forget to call a check, but it cannot avoid the door it has to
leave through:

- **`src/lib/agents/publish-gate.ts`** — every path to a live account must reach
  it. Compliance used to be enforced in one place only, the Mixpost agent tool,
  which left two ways to publish unreviewed: schedule a post, or publish direct.
  `src/lib/agents/regulatory-invariants.test.ts` scans the whole source tree for
  exits to a live account and fails the build if one does not reach the gate. It
  carries an explicit list of known holes, and each entry is asserted to *still
  be a hole* — so closing one makes the test fail until the list is updated, and
  nothing can be quietly added to it.
- **`src/lib/agents/save-gate.ts`** — the outputs library is not passive
  storage. `query_outputs` is handed to every department, so anything saved
  becomes something later work imitates. Content that failed a review must not
  be written down, or the violation propagates.

The review itself is `runComplianceFilter`
(`src/lib/agents/compliance-filter.ts`). It routes with
`taskCapability: 'compliance_review'`, which maps to the **frontier** tier —
`anthropic/claude-opus-5`. That is deliberately the most expensive model in the
ladder. The cost difference is cents per draft; being wrong is a regulatory
matter. **Do not "optimise" this onto a cheaper tier.**

Adding a new publisher or a new save path? Route it through the existing gate.
Do not re-implement the check.

---

## Commands

```bash
npm install
cp .env.local.example .env.local
# Supabase, Stripe, Resend, Zernio and Mixpost keys go in .env.local
npm run dev    # http://localhost:3000
```

| Command | What it runs |
|---|---|
| `npm run dev` | `next dev --turbopack`, port 3000 |
| `npm run build` | `next build` (Webpack, not Turbopack — Vercel compatibility) |
| `npm start` | `next start` |
| `npm run lint` | `eslint` — flat config at `eslint.config.mjs` (`next/core-web-vitals`) |
| `npm test` | `tsx --test` over every `src/**/*.test.ts` — **182 test files** |

The fast loop is a single file, not the whole suite:

```bash
npx tsx --test src/lib/agents/publish-gate.test.ts
npx tsx --test src/lib/zernio/account-scoping.test.ts
```

Operational scripts in `scripts/` run the same way and hit **live Supabase** via
`.env.local`:

```bash
npx tsx scripts/run-pipeline.ts <mediaItemId>     # re-run media processing on one row
node scripts/verify-media-state.mjs <id>          # dump a media_items row
node scripts/read-upload-trace.mjs                # client upload breadcrumbs, no DevTools
```

Before claiming a feature is done: `npm test`, `npm run lint` and `npm run build`
all pass, then `graphify update .`.

## Where the authoritative knowledge lives

Three memory systems already know things about this repo. Reading source files
to work out something they can answer is a failure, not diligence.

| Layer | Use it for | How |
|---|---|---|
| **Obsidian** (`~/Obsidian`) | *What should be built* — the specs | `~/Obsidian/Reference/nrs-*`, `~/Obsidian/Decisions/` |
| **graphify** (`graphify-out/`) | *How it connects* — callers, imports, paths | `graphify explain "<file>"`, `graphify path "<a>" "<b>"` |
| **gbrain** | *Prior decisions and history* across all projects | `gbrain search "<topic>"`, `gbrain query "<question>"` |

**Order of authority when they disagree:**

> Obsidian spec (what should be built) → code (what *is* built) → graphify (how
> it connects) → `CLAUDE.md` → `AGENTS.md` / this README / `docs/`.

The specs that outrank this file: `nrs-creative-studio-definitive-architecture.md`,
`nrs-director-capability-contract.md`, `nrs-media-processing-pipeline.md`,
`nrs-mcp-architecture.md`, `nrs-video-pipeline-architecture.md`,
`nrs-social-publishing-build-plan.md`, `nrs-zernio-multi-tenant-integration.md`,
and the Mixpost notes `nrs-mixpost-webhooks.md` /
`nrs-mixpost-upload-limits.md`.

Check graphify's freshness before trusting it — `graphify-out/GRAPH_REPORT.md`
names the commit it was built from; compare against `git rev-parse HEAD`.

**Never state a model id, API version or platform capability from memory.** They
go stale faster than any training cut-off. `src/lib/ai/model-routing.ts` is
authoritative for models; `curl -s https://ai-gateway.vercel.sh/v1/models` is
authoritative for the live catalogue; the platform's own changelog is
authoritative for everything else.

---

## Stack

Versions below were read from `package.json`, not recalled.

- **Next.js 15.5.21** + React 19 + Tailwind CSS 4 (oklch colours only)
- **Supabase** — auth, PostgreSQL + pgvector, RLS, Storage
- **Vercel AI SDK v6** (`ai` ^6.0.235) — `streamText` through the AI Gateway.
  Never `ToolLoopAgent`; it breaks in this codebase.
- **Vercel Cron** — six scheduled jobs (below) — plus Fluid Compute
  (`maxDuration = 300` on the chat route)
- **Zernio** (`@zernio/node` ^0.2.580) and **self-hosted Mixpost** — the two
  publishing transports
- **Stripe** (checkout, portal, webhooks) · **Resend** (transactional email)
- **shadcn/ui v4 on base-ui** — use the `render` prop, never `asChild`;
  `force-dynamic` on pages using base-ui
- **IBM Plex Sans + Mono** · **Zustand** for client state · GSAP + Motion

## Architecture

```
BROWSER  ── Today · Director's Office · Creative Studio · Command Centre
   │                    chat panel on every room  →  sendToDirector (DOM event)
   │  POST /api/chat  (streaming)
   ▼
DIRECTOR  src/app/api/chat/route.ts
   │  validate → brand + agent config (RLS) → getOrCreateAgentRegistry
   │  → checkBudget (429 if over) → buildSystemPromptWithMemory
   │  → intent-router hints → streamText(gateway(modelRoute.model))
   │  → stopWhen: stepCountIs(8)
   │  → onFinish: record spend to ai_usage + audit_log, extract memories
   │
   │  delegate_to_agent (one)  |  convene_meeting (2–6 in parallel)
   ▼
DEPARTMENTS  src/lib/agents/worker.ts — runAgentWorker
   │  own model · own memory namespace · own tools · own budget · own audit row
   │  stepCountIs(3) · max 4 concurrent
   │  must return EVIDENCE a tool ran this turn — src/lib/agents/task-capability-plan.ts
   ▼
EXITS  publish-gate.ts ─┐                    save-gate.ts
                        ▼                          ▼
        dispatcher.ts (ONE DOOR)            outputs library
        Zernio → native → Mixpost
                        ▼
        publisher_runs (audit)  ·  webhooks → status back
```

### Agent execution — two entry points, one worker

- **`POST /api/chat`** is the Director. `stopWhen: stepCountIs(8)`,
  `maxDuration = 300`.
- **`runAgentWorker`** (`src/lib/agents/worker.ts`) is every department.
  `MAX_WORKER_STEPS = 3`, `MAX_CONCURRENT_WORKERS = 4`, `Promise.allSettled`
  across a meeting.
- `/api/heartbeat` uses the same worker, so cron and chat behave identically.
- `src/lib/agents/task-capability-plan.ts` holds the capability contract: a
  department must return *evidence* that a tool actually ran this turn, not a
  claim that it did. See `nrs-director-capability-contract.md`.

### Model routing — one source of truth

`src/lib/ai/model-routing.ts` owns every model choice. Four tiers with explicit
fallback chains:

| Tier | Primary | Falls back to |
|---|---|---|
| `fast` | `anthropic/claude-haiku-4.5` | `google/gemini-3-flash`, `openai/gpt-5.6-luna` |
| `agency` *(default)* | `anthropic/claude-sonnet-5` | `openai/gpt-5.6-terra`, `google/gemini-3-flash` |
| `frontier` | `anthropic/claude-opus-5` | `anthropic/claude-sonnet-5`, `openai/gpt-5.6-terra` |
| `code` | `openai/gpt-5.3-codex` | `anthropic/claude-sonnet-5`, `openai/gpt-5.6-terra` |

Departments map to a tier only where there is a real reason; everything else
falls through to `agency`. It is a list of exceptions, not a config file to fill
in. A handful of *task* capabilities can override the department tier — most
importantly `compliance_review → frontier`.

Cost is estimated per model from a pricing table with separate cache-read and
cache-write rates, summed in USD and rounded up to budget cents. There is no
flat per-token constant.

Those model ids were read from the live Gateway catalogue, not recalled. If you
change one, check the catalogue. AI Gateway credentials are auto-injected on
Vercel — never configure a provider manually.

### Canonical pipelines — one function owns each write

Four places where "just insert the row" is the bug:

- **Publishing** — `src/lib/publishers/dispatcher.ts`. The one door to a live
  account. The choice used to live in two places that disagreed, so the same
  `scheduled_posts` row landed on Zernio via "Schedule" and on Mixpost via
  "Publish now".
- **Drafts** — `src/lib/posts/create-draft.ts` `createDraftPost()`. The one
  place a draft is born: insert *and* transport push together. Never raw-insert
  `scheduled_posts`. It returns a status of `synced` / `pending` / `failed` —
  **relay it honestly**; `pending` is not done.
- **Media** — `src/lib/media/process-pipeline.ts`
  `runMediaProcessingPipeline()`. Owns every `media_items` mutation touching
  thumbnail, transcription or AI tagging. `media_items` has
  `transcription_status` but **no `status` column** — an update including
  `status:` is rejected wholesale by PostgREST and silently drops everything
  sent with it.
- **MCP exposure** — see below. It is an allowlist, and the default is *not*
  what most people assume.

### MCP — an allowlist, not a denylist

External AI clients (Claude Desktop, Cowork, Codex) are **messengers**. They
hand intent to `chat_with_director` and wait. They do not write marketing copy
and they do not orchestrate.

`DIRECT_MCP_TOOLS` in `src/lib/mcp/director-only-tools.ts` is the only set of
tools an external client may invoke directly — read-only agency state, the brand
kit, the goal interview, a couple of bounded utilities. It is filtered through
`getDirectMcpToolEntries` inside `adaptToolsForMCP`.

**The default is Director-only.** A newly added tool is invisible to MCP until
it is explicitly reviewed and added to that set. If you add a query tool and
wonder why Claude Desktop cannot see it, this is why. (An older `HIDDEN_FROM_MCP`
denylist is described in some docs — it no longer exists, and its advice was
the exact inverse of the current behaviour.)

The MCP server itself is Streamable HTTP at `/api/mcp`, with OAuth 2.0 + PKCE
(`/api/mcp/authorize`, `/token`, `/register`) alongside API-key auth.

### Memory (in-app — distinct from gbrain)

Three layers on Supabase + pgvector:

1. **Individual facts** (`agent_memories`) — LLM fact extraction on the `fast`
   tier, semantic search via the `match_memories()` Postgres function, and
   dedup at >0.85 cosine similarity (update, not insert). Types: preference,
   brand_rule, decision, observation, metric.
2. **Session memory** — a compounding 7-section markdown record per brand that
   *updates* rather than replaces, so knowledge grows.
3. **Cross-department** — a global namespace (`nrs-agency`) the Director reads
   across departments.

Namespaces are built in `src/lib/ruflo/namespaces.ts`:
`nrs-{brandSlug}-{agentType}` per department, `nrs-{brandSlug}` brand-wide, and
`nrs-agency` for the global agency view.

Embeddings go through the AI Gateway using **`google/gemini-embedding-001`**
(override with `NRS_EMBEDDING_MODEL`), requested at **1536 dimensions** because
`agent_memories.embedding` is `vector(1536)` and Postgres rejects anything else.
The width is a contract, not a preference. The previous client called OpenAI
directly and needed a key that was never set, so every embed threw silently and
thousands of memories were stored with no vector at all — nothing could be
recalled by meaning. Two models do not share a vector space even at identical
width, so changing the model means re-embedding every row.

`agent_memories.value` is a **TEXT** column — reads return a string. Always go
through `parseMemoryValue()` (`src/lib/memory/memory-value.ts`). Casting it
straight to an object fails silently and has already disabled three features at
once.

Memory has a user-facing surface too: `GET /api/memories?brandId=X`,
`GET /api/memories/export` (JSON export), `DELETE /api/memories?scope=single|brand`,
and `MemoryBrowser.tsx` inside Brand Settings. `user_id` sits on every row with RLS:
owner full CRUD, team admin read + write, team viewer read-only, service role
for cron.

### Data & auth

Three Supabase clients — do not mix them: `lib/supabase/client.ts` (browser),
`lib/supabase/server.ts` (RSC + API routes), `lib/supabase/admin.ts` (service
role — webhooks, cron). `src/middleware.ts` refreshes the session on every
non-static request; all `/agency/*` requires auth.

RLS uses three helper functions — `is_owner_or_team_member`,
`can_write_for_owner`, `can_access_brand` (introduced in
`supabase/migrations/015_team_members.sql`) — rather than hand-written
per-table policies.

The live `public` schema holds **64 tables** across **55 migrations** (checked
2026-08-17), and it moves. Do not treat any list in a document as the schema:
`src/types/database.ts` and `supabase/migrations/` are the truth, and
`list_tables` against the live project beats both.

Budget is in **cents** (integers). `audit_log` is append-only. `agent_configs`
are templates; `agent_registry` is runtime state. The trigger is
`update_updated_at()`, not `update_updated_at_column()`.

### Scheduled jobs

Six crons in `vercel.json`:

| Path | Schedule |
|---|---|
| `/api/heartbeat` | every 15 min |
| `/api/cron/publish-posts` | every 5 min |
| `/api/cron/recover-director-jobs` | every 5 min |
| `/api/cron/daily-intel` | daily, 20:00 |
| `/api/cron/web-vitals` | weekly, Monday 20:00 |
| `/api/cron/weekly-traffic` | weekly, Sunday 21:00 |

## Tests are guardrails, not just unit tests

Several tests read the source tree and fail the build on an *architectural*
violation. A failure means "you broke a rule", not "fix the assertion":

- `src/lib/errors/no-raw-errors.test.ts` — a tool's returned string is read
  aloud to the owner, so it may not interpolate a raw error. This scans for it.
- `src/lib/agents/publish-gate.test.ts`, `save-gate.test.ts`,
  `regulatory-invariants.test.ts` — the compliance chokepoints.
- `src/lib/zernio/account-scoping.test.ts` — pins the measured fact that
  Zernio's `profileId` filter is inert and isolation is ours.
- `src/lib/security/execution-scope.test.ts`, `marketing-data-boundary.test.ts`,
  `project-access.test.ts`, `project-scope-migration.test.ts`,
  `github-app-connector-migration.test.ts` — project-scope and connector
  isolation.
- `src/lib/video/binary-shipped.test.ts` — `ffmpeg-static` resolves its path at
  runtime, so Next's tracer never learns the binary exists and it vanishes from
  the deployed function. This test is the only thing that catches it.
- `src/lib/agents/heygen-removal.test.ts` — dependency invariant.

## Navigation

Four rooms (`src/lib/room-config.ts`):

| Room | URL | Purpose |
|---|---|---|
| **Today** | `/agency/board` | The daily view — first in the list |
| **Director's Office** | `/agency/chat` | Primary chat |
| **Creative Studio** | `/agency/studio` | Everything content |
| **Command Centre** | `/agency/tasks` | Running the agency |

**Creative Studio has no sub-tabs.** They were deliberately removed in favour of
a left sidebar (`StudioSidebar.tsx`) with fourteen destinations: Dashboard,
Create Post, Posts, Calendar, Media Library, Review, Templates, Brand Kit,
Pages, Analytics, Hashtags, Social Accounts, Posting Schedule, Webhooks.

**Command Centre** has eleven sub-tabs: Tasks, Inbox, Agents, Approvals, Ads,
Costs, Analytics, Activity, Settings, Team, Brands. Inbox sits second on
purpose — a customer message waiting on a reply is the most time-sensitive thing
there, and it must be reachable on a phone (the Studio sidebar is
`hidden md:flex`).

There is **one composer**, at `/agency/studio/create`, rendering `PostCreator`.
`/agency/studio/post` was a second composer with neither the content validator
nor the per-platform options; it now 307-redirects to `/agency/studio/create`
rather than 404ing an old bookmark.

Routes are flat — no route groups.

## Agent organisation — 1 Director + 14 departments

`ACTIVE_AGENT_TYPES` (`src/types/database.ts`) holds fifteen types: the Director
plus fourteen departments. The labels below are the ones the code uses — plain
English, because the owner reads them.

| Type | Label |
|---|---|
| `overall` | NRS Director |
| `content` | Write Content |
| `seo` | Get Found Online |
| `paid_ads` | Run Ads |
| `strategy` | Plan & Launch |
| `email` | Send Emails |
| `growth` | Find Partners |
| `brand` | Build My Brand |
| `competitor` | Watch Competitors |
| `website` | Improve My Website |
| `compliance` | Check Compliance |
| `analytics` | Track Results |
| `automation` | Automate My Work |
| `video` | Make Videos |
| `help` | Get Help |

(`martech` is archived and kept only for backward compatibility with existing
conversations.)

Each department is a genuinely independent agent with its own model, memory
namespace, tools, budget and audit trail. The Director delegates behind the
scenes; users never see or pick departments.

### Tools

80 files in `src/lib/agents/tools/` (72 implementation, 8 test). Factory
functions take context (`supabase`, `userId`, `brandId`) and return AI SDK tool
objects with Zod schemas. `tools/index.ts` assembles the per-agent set via
`getToolsForAgent()` — **read that file for the current set rather than trusting
any list in a document**; tool inventories in prose go stale within weeks.

Nine management tools go to every agent: `create_task`, `request_approval`,
`handoff_to_department`, `query_outputs`, `read_proforma`, `get_brand_kit`,
`project_brief`, `goal_interview`, `sync_brand_to_canva`. `save_output` is *not*
among them — it is added per agent. `delegate_to_agent` and `convene_meeting`
are attached to the Director in the chat route, not in `tools/index.ts`.

Import Zod as `import { z } from 'zod/v3'` for tool schemas — v4 shapes break
the AI SDK.

## Integrations

### Publishing
Zernio (`src/lib/zernio/`, `@zernio/node`) — five API route families under
`/api/zernio/*` plus a webhook receiver, and three agent tools (`zernio_reply`,
`zernio_ads`, `zernio_analytics`). Self-hosted Mixpost at
`mixpost.notrealsmart.com.au` — ten API routes under `/api/mixpost/*` plus a
webhook receiver for publishing status. Mixpost is self-hosted, so the running
instance is the truth: the Laravel source on the VPS, plus the
`~/Obsidian/Reference/nrs-mixpost-*` notes derived from it. The public Mixpost
docs lag the Pro build.

Platforms the dispatcher understands: Facebook, Instagram, LinkedIn, TikTok,
YouTube, X/Twitter. **Which accounts are actually connected is per brand and per
transport** — check Studio → Social Accounts in the app, not a table in a README.

Known gaps before subscriptions can be sold (webhook coverage, stored
`accountId` → customer mapping, scoped per-tenant API keys, `402` handling, a
fairness queue) are listed in
`~/Obsidian/Reference/nrs-zernio-multi-tenant-integration.md`. That note owns
the list; this file does not duplicate it.

### Canva
27 tool factories in `src/lib/agents/tools/canva.ts`, OAuth 2.0 + PKCE via
`/api/canva/auth` and `/api/canva/callback`. Generate, edit
(start/perform/commit/cancel transactions), resize, upload assets, import
designs, comments, folders, export, brand templates, template-dataset
inspection, structured generation, design content reading. A template-based
asset is only reported as created once Canva returns an editable design receipt;
templates need published Autofill fields before NRS can replace copy safely.

### Video
Our own ffmpeg pipeline in `src/lib/video/` — transcode, thumbnails, audio
extraction, silence-tightening, subtitle generation and burn-in. No named video
vendor. The order **tighten → caption → publish** is load-bearing: captions
burnt from un-remapped word timings drift silently, and the drift grows through
the clip.

## Key features

- **77 slash commands** — type `/` for Discord-style autocomplete
- **Multi-agent meetings** — the Director convenes 2–6 departments in parallel
- **Master Marketing Proforma** — a 21-section living document per brand,
  written by the Director and read by every agent
- **Media → post pipeline** — upload, transcribe, propose copy, review, schedule
- **Inline rich cards** — post previews, calendar views, analytics in chat
- **Chat images** — paste or drag screenshots straight into the conversation
- **Intent router** (`src/lib/agents/intent-router.ts`) — rule-based and free,
  with an LLM fallback only for genuinely ambiguous messages; emits routing
  hints into the Director's context
- **Autonomous heartbeat** — every 15 minutes, agents pick up queued tasks
- **Team members** — invite collaborators with role-based and per-brand access
- **Post signatures and brand watermark** — per-brand attribution on published
  content

## Brands

Fourteen brands exist in the live `brands` table, **eleven active** (checked
2026-08-17): Black Health Intelligence, Do Today, Downscale Weight Loss,
EndorseMe, NotRealSmart, Scent Sell, Sniffopotamus, TeleCheck, TeleCheck Clinic,
TeleScribe, Underground Parfums.

Four of those eleven carry AHPRA or TGA compliance flags — Black Health
Intelligence, Downscale Weight Loss, EndorseMe and TeleCheck Clinic — and are
the reason the publish and save gates exist.

## Conventions

- **Australian English** in all code, copy and comments (colour, behaviour,
  organisation, prioritise, recognise)
- **oklch colours only** — silver/chrome palette, hue ~240
- Comments carry the *incident* that motivated the code — see
  `memory-value.ts`, `create-draft.ts`, `publish-gate.ts`,
  `publishers/dispatcher.ts`. Match that: explain why the obvious approach was
  wrong, not what the code does.
- **Never touch** `src/app/page.tsx` / `WaterRippleHero`. **No new Three.js** —
  it exists only for the landing and about heroes.
- Supabase credentials are already in `.env.local`. Use them; never ask for them.

## Other docs, and how much to trust them

- **`CLAUDE.md`** — the working guide for AI-assisted development here. Start
  there.
- **`AGENTS.md`** — the fullest inventory of agents, tools and slash commands.
- **`docs/ARCHITECTURE.md`** — the system diagram and request flow.

All three, and this file, describe a codebase that moves faster than prose does.
Treat every literal in them — a model id, a count, a symbol name, an env var —
as a claim to verify, not a fact to quote. The rule that keeps this honest:

> When code and prose disagree, **the code wins** — except on *what should be
> built*, where the **Obsidian spec** wins.

If you find something in here that is wrong, fix it in the same change as the
code. A document that confidently states something false is worse than one that
says nothing.

---

Black Health Intelligence Pty Ltd · ABN 23 693 026 112
