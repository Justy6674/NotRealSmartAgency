# Architecture

**Audience: engineers.** This is a map of the system's shape — where the load-bearing
decisions live and which single function owns each one. It is written for whoever is
about to change the code, not for the owner.

**Every fact below was read from the source on 2026-08-17.** Where a number would go
stale (model IDs, tool lists, table lists), this document names the authoritative file
instead of copying its contents. That rule is not fussiness: the previous version of
this page confidently listed three model IDs that had never existed in the codebase,
and a reader who trusted it would have "fixed" working code to match a fiction.

**Order of authority when sources disagree:** the Obsidian spec (`~/Obsidian/Reference/nrs-*`,
`~/Obsidian/Decisions/`) on *what should be built* → the code on *what is built* →
graphify on *how it connects* → `CLAUDE.md` → this file → `AGENTS.md` / `README.md`.

## Do not look it up here

| The question | The only answer that is current |
|---|---|
| Which model does X run? | `src/lib/ai/model-routing.ts` |
| Does model ID `Y` exist, and what does it cost? | `curl -s https://ai-gateway.vercel.sh/v1/models` |
| Which tools does department Z get? | `getToolsForAgent()` in `src/lib/agents/tools/index.ts` |
| Which agent types are live? | `ACTIVE_AGENT_TYPES` / `AGENT_LABELS` in `src/types/database.ts` |
| What columns does a table have? | `src/types/database.ts`, then the live Supabase schema |
| What calls this function? | `graphify explain "<file>"` — do not fan out greps |
| Why was it built this way? | `gbrain search "<topic>"`, and the header comment on the file |

Comments in this codebase carry the incident that motivated the code. `create-draft.ts`,
`publish-gate.ts`, `memory-value.ts`, `zernio/client.ts` and `publishers/dispatcher.ts`
each explain, at the top, the failure they exist to prevent. Read those headers before
changing behaviour in them.

---

## Agent execution — two entry points, one worker

`streamText` / `generateText` from AI SDK v6, always through `gateway(...)`.
**Never `ToolLoopAgent`** — it breaks in this codebase.

```
                 ┌──────────────────────────────┐
   web chat ────▶│  POST /api/chat              │  the Director, and the only face
   MCP client ──▶│  route.ts                    │  streamText, stopWhen stepCountIs(8)
                 │  maxDuration = 300 (Fluid)   │  gateway(modelRoute.model)
                 └───────────┬──────────────────┘
                             │ delegate_to_agent (1)  /  convene_meeting (2–6)
                             ▼
                 ┌──────────────────────────────┐
   /api/heartbeat│  runAgentWorker()            │  every department
   (15-min cron) │  lib/agents/worker.ts        │  generateText, stepCountIs(3)
        ─────────▶│                              │  MAX_CONCURRENT_WORKERS = 4
                 └──────────────────────────────┘  own model · own memory namespace
                                                    own tool set · own budget · own audit row
```

- **Director** — `src/app/api/chat/route.ts`. Per request: validate → fetch brand and
  agent config under RLS → `getOrCreateAgentRegistry` + `checkBudget` (429 if over) →
  `buildSystemPromptWithMemory` → intent-router hints → stream → `onFinish` records spend
  to `agent_registry` / `ai_usage` / `audit_log` and extracts memories.
- **Workers** — `runAgentWorker` in `src/lib/agents/worker.ts`. `convene_meeting` runs
  2–6 in parallel through `runParallelAgents` (`Promise.allSettled`), capped at
  `MAX_CONCURRENT_WORKERS`. Each department writes to its own memory namespace,
  `nrs-{brandSlug}-{agentType}`.
- **The 15-minute heartbeat uses the same `runAgentWorker`**, so cron and chat cannot
  drift apart in behaviour.

### The capability contract

`src/lib/agents/task-capability-plan.ts` is the reason a department cannot answer
"I checked the website" without having checked the website. A `DirectorTaskCapability`
(`canva_asset`, `video_evidence`, `website_evidence`, `competitor_research`,
`current_research`, `caption_hashtag_analysis`, `product_identity`, `compliance_review`)
names the accountable department and the tools that must actually have run this turn —
`requiredAnyToolNames` / `requiredAllToolNames`, plus minimum design and media receipts
for Canva work. Prose is not evidence.

The same capability feeds `TIER_BY_TASK_CAPABILITY` in `model-routing.ts`, so a task can
override the department's default model tier. Full rules:
`~/Obsidian/Reference/nrs-director-capability-contract.md`.

---

## Request flow

```
User message
    │
    ├── auth (Supabase) · brand + agent config under RLS
    ├── workspace/brand scope resolution · marketing-data-boundary inspection
    ├── budget check → 429 if exceeded
    ├── memory: v2 semantic search + compounding session record → injected into prompt
    ├── intent router (rule-based, free) → routing advisory, not a decision
    │
    ▼
resolveAgentModelRoute()  ──▶  tier + primary + fallback chain + Gateway provider options
    │                          (zero-retention on health brands)
    ▼
streamText(gateway(modelRoute.model), tools, stopWhen: stepCountIs(8))
    │
    ├── delegate_to_agent  → one department via runAgentWorker
    ├── convene_meeting    → N departments in parallel, capped at 4
    └── the Director's own tools
    │
    ▼
onFinish
    ├── estimateGatewayCost(actualModel, usage) → budget cents
    ├── recordAgentSpend → agent_registry · insert ai_usage · logAudit
    └── extract facts (v2 store, semantic dedup) + update session memory
```

---

## Model routing — one source of truth

`src/lib/ai/model-routing.ts` owns every model choice in the application. **Do not copy
model IDs out of it into this or any other document.** Four tiers — `fast`, `agency`,
`frontier`, `code` — each with an explicit fallback chain, all resolved through the
Vercel AI Gateway (credentials are auto-injected on Vercel; never configure a provider
directly).

Departments map to a tier only where there is a real reason; everything else falls
through to `agency`. `TIER_BY_AGENT` is a list of exceptions, not a config file to fill
in. The exceptions, and why they exist:

| Department | Tier | Reason |
|---|---|---|
| `compliance` | `frontier` | It scores copy against AHPRA and TGA advertising rules. The one place where being wrong is a regulatory matter, not a bad caption. The cost difference is cents per draft. |
| `competitor`, `website` | `fast` | Both chew whole pages of scraped HTML. The work is extraction, not craft, and nearly all their tokens are input. |
| `analytics` | `fast` | Reads numbers out of structured query results. There is no prose to get right. |
| `automation` | `code` | Reasons about integrations, payloads and failures — engineering work. |

`TIER_BY_TASK_CAPABILITY` layers on top: a concrete task capability beats the broad
department default. `compliance_review` routes to `frontier` from wherever it is called,
which is how `runComplianceFilter` gets the frontier model even though it is invoked from
a publishing route rather than from the compliance department.

**Cost.** `estimateGatewayCost()` uses a per-model pricing table with separate cache-read
and cache-write rates, sums input + cacheRead + cacheWrite + output in USD, then
`Math.ceil(usd * 100)` for budget cents. There is no flat per-token constant anywhere —
if you find one in another document, it is wrong.

Every ID and price in that file was read from `GET https://ai-gateway.vercel.sh/v1/models`
on the date recorded in its comments, not recalled. Re-read the catalogue before changing
one.

---

## Publishing — one door, two paths not yet behind it

**`publishToPlatform()` in `src/lib/publishers/dispatcher.ts` is the door a publishing path
is required to use**, and backend selection lives in exactly one function,
`selectPublisherBackend()`, in that same file.

**It is not yet the only door.** Read that as a rule being migrated to, not a property the
codebase already has — the gap is described under *Why this is one function and not two*
below, and it is live. Re-check the callers before you rely on either statement:

```bash
grep -rln "publishToPlatform" src
```

As at 2026-08-17 that returns three files: `src/app/api/cron/publish-posts/route.ts`,
the dispatcher itself, and `src/lib/agents/regulatory-invariants.test.ts`. Anything else
that reaches a live account is doing it on its own.

```
                       ┌────────────────────────────────────────────┐
 /api/cron/publish-    │  publishToPlatform()                       │
 posts (5-min) ───────▶│  lib/publishers/dispatcher.ts              │
                       │                                            │
                       │  1. read brand once (shared by selector    │
                       │     and gate — reading twice is how the    │
                       │     two answers get to differ)             │
                       │  2. selectPublisherBackend()               │
                       │  3. checkPublishAllowed()  ◀── AHPRA/TGA   │
                       │  4. rate limit → media validation          │
                       │  5. send · log publisher_runs · retry      │
                       └───────┬──────────┬──────────┬──────────────┘
                               ▼          ▼          ▼
                            Zernio     native    Mixpost
                        (subscribers) (env flag) (self-hosted)   ▲
                                                                 │
 /api/scheduled-posts/publish-now ───────────────────────────────┤  NOT through the door.
 publish_to_social agent tool ───────────────────────────────────┘  Gated, but Mixpost-only.
```

### How the backend is chosen, per brand

1. **Zernio** — the brand has `brands.social_urls.zernio_profile_id` *and* the team's
   Zernio account list contains an account whose `profileId` matches that brand **and**
   whose `platform` string matches exactly. Both halves of that match matter: the account
   list is the whole team's, so dropping the profile comparison would let a post land on
   another brand's connected account.
2. **native** — `USE_NATIVE_PUBLISHER_{PLATFORM}=true`. Only LinkedIn is wired.
3. **Mixpost** — the self-hosted fallback, and what Justin's own brands stay on.

`selectPublisherBackend` deliberately cannot throw. A selector that threw would take the
publish down with it, and the safe direction on an unanswered Zernio call is the fallback
that already works, not a dropped post.

### Why this is one function and not two

The choice used to live in two places that disagreed. The 5-minute cron preferred Zernio
whenever the brand had a Zernio account for the platform; `/api/scheduled-posts/publish-now`
had no Zernio code in it at all and always went to Mixpost. Those are two separate OAuth
connections to two separate services, and nothing in this codebase asserts they point at
the same Facebook Page or LinkedIn organisation. The Review panel puts both buttons on the
same row. **That write-path split is closed** (`f2d9aac`): cron, Publish now, and
`publish_to_social` all call `publishToPlatform`. A brand connected to Zernio but not
Mixpost used to publish cleanly on one button and fail on the other — and once failed, the
cron would never retry it, because it only selects `status='scheduled'`.

Caption assembly moved into the dispatcher for the same reason: three paths joined
hashtags differently (one without a `#` at all) and appended the brand sign-off
inconsistently, so the same row reached the public as different words depending on who
sent it. `buildCaption()` is now built once, for every backend, and it is the exact text
handed to the gate.

**Write path closed 2026-08-17 (`f2d9aac`). Remaining gap is reads.** Cron, Publish now,
and `publish_to_social` all call `publishToPlatform`. `INLINE_EQUIVALENT` is empty: the
shared gate runs for every project on those paths. **Scent Sell and EndorseMe** still
carry `social_urls.zernio_profile_id`. Their writes go to Zernio. Several *screens*
(social analytics, Mixpost account routes, the performance learner) still ask Mixpost;
`/api/studio/overview` now asks Zernio when the brand has a profile
(`src/lib/studio/overview-accounts.ts`, `bd1d307`).

Confirm the current callers yourself — `grep -rln "publishToPlatform" src`, or
`graphify explain "dispatcher.ts"` — rather than trusting this paragraph.

### Reporting the outcome honestly

`PublishResult` carries a `confirmed` flag, and it is not decoration.

- Zernio's `publishNow` create response is terminal: it carries the per-platform status,
  the permalink and, on failure, `errorMessage`. `readZernioOutcome()` reads it. A status
  that is neither published nor failed is reported as **dispatched-but-unconfirmed**, not
  as a failure — calling an in-flight post failed enqueues a retry, and the retry would
  publish the post a second time.
- Mixpost accepting a post is not Mixpost publishing it. Confirmation arrives later on the
  `post.published` webhook, so the Mixpost path returns `confirmed: false`.

### Known gap, recorded rather than papered over

`publisher_runs` still carries `check (publisher in ('native','mixpost'))` from
`supabase/migrations/034_direct_publishing.sql:39`. Until that constraint is widened,
Zernio audit rows are rejected, `logRun` returns `null`, and the retry path never enqueues
because it needs the run ID. **The publish itself is unaffected; the audit row is not
written.** Widening a live constraint is a schema migration and needs Justin's sign-off.

Background: `~/Obsidian/Decisions/2026-08-17-nrs-zernio-for-subscribers-mixpost-as-fallback.md`.

### Why a third-party transport does not break Build-First

Build-First says plug-ins are temporary bridges, never the product. The distinction that
matters is **where the abstraction sits**. NRS keeps owning the product — brand
intelligence, the AHPRA/TGA gate, the composer, the scheduling model, the memory layers.
Zernio is a *transport* behind our own interface, swappable without touching product
logic. Wiring Zernio's API shapes through the application would have sold the spine;
putting it behind `dispatcher.ts` does not. Self-hosted Mixpost stays on Justin's own
brands specifically so it is exercised daily and is therefore a genuine fallback rather
than a dusty one.

---

## Tenant isolation is ours, not Zernio's

This is the most counterintuitive fact in the publishing stack, and it is the one most
likely to be assumed away.

> "Posts validate `accountId` against your whole team, not against a profile… keep the
> account-to-customer mapping in your database and only pass a customer their own account
> IDs." — Zernio's own multi-tenant guide

**A Zernio profile is an organisational boundary, not a security one.** Zernio deliberately
does not enforce customer isolation. Every boundary between subscribers is NRS code.

**MEASURED against the live account on 2026-08-17:** `listAccounts({ profileId })` accepts
the filter and ignores it — ten accounts returned with it, the same ten without.
A source comment had asserted the opposite. Two live consequences of having trusted it:

1. Callers used that result to answer "does this account belong to this brand". Against an
   unfiltered list the answer is always yes, so the ownership check permitted every account
   in the team.
2. The same social accounts sit under more than one profile — Zernio *migrates* accounts to
   another profile when one is deleted rather than deleting them — so a publisher matching
   on platform alone could match twice and post identical content twice to one page.

The filter is applied in our code, in `fetchZernioAccounts()`
(`src/lib/zernio/client.ts`), **after** `normaliseAccount`, because the raw `profileId`
field is sometimes a populated `{_id, name}` object rather than a string. Comparing the raw
field to a string is always false, which is why the Zernio branch had never once evaluated
true in production while the configuration looked correct everywhere a person would check.

Pinned by **`src/lib/zernio/account-scoping.test.ts`**, which asserts against the source
because reproducing it needs live credentials and a second populated profile.

Two more properties of the shared account that shape design, from
`~/Obsidian/Reference/nrs-zernio-multi-tenant-integration.md`:

- The rate limit (60–1,200 RPM, scaling with connected accounts) is **shared across all
  tenants**. Prefer webhooks over polling; one smooth background queue, not per-tenant
  crons firing together.
- `402 PAYMENT_REQUIRED` means *our* team billing is suspended and **every subscriber stops
  at once**. It must be handled distinctly from a per-tenant failure and surfaced to Justin,
  not to the subscriber.

That reference note also lists what NRS still lacks before subscriptions can be sold — no
webhook endpoint, no stored `accountId` → customer mapping, one full-access team key, no
`402` handling, no fairness queue. Read it before extending Zernio use.

---

## Gates — at the exits, not in the callers

Which brands are regulated is **data, not a constant**: it is `brands.compliance_flags`
(`{ahpra, tga, tga_categories}`), read at gate time. Do not hard-code the set, and do not
trust a list in a document — including this one. As at 2026-08-17 the live table has four
*active* brands carrying a flag (Black Health Intelligence, Downscale Weight Loss, EndorseMe
and TeleCheck Clinic, with Downscale Weight Loss the only one flagged for TGA as well as
AHPRA) and two inactive ones. AHPRA/TGA advertising breaches run to $60,000 per offence.

Compliance was once enforced in one place only — the Mixpost agent tool — while the
scheduled publisher and the direct publishers had no check at all. Two chokepoints now,
plus a guardrail test that fails the build when a new code path skips one:

| Gate | File | Rule |
|---|---|---|
| Publishing | `src/lib/agents/publish-gate.ts` → `checkPublishAllowed()` | The rule for every path to a live account. Runs on the exact words that will be sent, signature included — a review of something adjacent to the post is not a review of the post. **Four exits do not reach it yet** — they are named in `UNGATED_EXITS_KNOWN`, below. |
| Saving | `src/lib/agents/save-gate.ts` → `complianceGateForSave()` | The outputs library is not passive storage: `query_outputs` is given to every department, so anything saved becomes something later work imitates. Failed content must not be written down. |

Both **fail closed in both directions**. A review that found violations blocks, and a
review that could not run also blocks. The second case is the one that matters: the
compliance filter catches its own errors and returns a default-valid result, so without
the `checkCompleted` check a model outage is indistinguishable from a clean pass.

Unregulated brands pass straight through after deterministic product-name protection —
the gate does not run an LLM over ordinary fragrance captions.

The regulatory review itself (`src/lib/agents/compliance-filter.ts`) goes through the
Gateway like every other call, with zero-retention and no-training provider options, and
reports what it cost back to the caller.

### The guardrail that keeps it that way

**`src/lib/agents/regulatory-invariants.test.ts`** does not check a list of filenames — it
did once, and three new publishers were added afterwards that it never looked at. It now
states the rule the other way round: **find every mechanism by which this codebase can put
words in front of the public, and require each one to reach the gate.**

- `LIVE_SEND` — the patterns that constitute an exit to a live account (Mixpost immediate
  publish, server-side schedule, queue, approve; `createZernioPost`; `blotatoCreatePost`;
  `publisher.publish`). A new publisher is caught by the mechanism it must use, not by
  whether anyone remembered to add it to a list.
- Each file containing an exit must call `checkPublishAllowed` **or** `await publishToPlatform(...)`.
- `RETIRED` — publishers removed on purpose, asserted to match **nothing**. Ayrshare is
  here. Re-adding it is a new exit and has to be argued for in this file.
- `INLINE_EQUIVALENT` — one entry (`lib/agents/tools/publish-to-social.ts`), recognised by
  the specific checks it performs inline, never by path. It drifted once already: its
  incomplete-review branch tested `ahpra` only, so a TGA-regulated brand's claims went out.
  **This list may only shrink.**
- `UNGATED_EXITS_KNOWN` — a **register of open exposure, not an exemption**. Each entry is
  asserted to *still be a hole*, so an entry that gains a gate fails as stale and must be
  deleted. The list is capped, so a new ungated publisher cannot be parked there. Four
  entries as at 2026-08-17 — `tools/blotato.ts`, `tools/manage-posts.ts` and the Mixpost
  `queue` and `approve` routes. Read the current entries in the test before assuming
  publishing is fully gated.
- The gate must appear **before** the send in source order — a gate called after the
  platform call is decoration.
- The cron is asserted not to take back backend choice from `selectPublisherBackend`.

---

## Canonical write paths — one function owns each write

Three places where "just insert the row" is the bug.

**Drafts — `createDraftPost()` in `src/lib/posts/create-draft.ts`.** The one place a draft
is born: the `scheduled_posts` insert *and* the Mixpost push together. Never raw-insert
`scheduled_posts`. It returns a `mixpost` outcome of `synced` | `pending` | `failed` |
`skipped` | `duplicate`, and **callers must relay it rather than claiming success** —
`pending` means the upload is still running past our wait bound. Reporting `pending` as
done is a lie the owner discovers on the platform, not in the app. It has many call sites
across tools, API routes and the Telegram Mini App — `graphify explain "create-draft.ts"`
lists them with file and line.

**Media — `runMediaProcessingPipeline()` in `src/lib/media/process-pipeline.ts`.** Owns
every `media_items` mutation across all four stages — `thumbnail`, `delivery`,
`transcription`, `ai` (`ProcessingStage`, process-pipeline.ts:56). `delivery` writes the
`{path}_social.mp4` that publishing prefers and is the stage most often forgotten. It is
idempotent by stage. Browser upload, desktop upload, intake upload, the Telegram paths and
the Director's `process_media` tool all delegate to it. **Schema trap:** `media_items` has
`transcription_status` but **no `status` column** — an update including `status:` is
rejected wholesale by PostgREST (PGRST204) and silently drops every other key with it.
Spec: `~/Obsidian/Reference/nrs-media-processing-pipeline.md`.

**MCP exposure — `DIRECT_MCP_TOOLS` in `src/lib/mcp/director-only-tools.ts`.**

> **There is no `HIDDEN_FROM_MCP` denylist.** That symbol does not exist anywhere in `src/`
> — `grep -rn HIDDEN_FROM_MCP src/` returns nothing (checked 2026-08-17). The mechanism was
> inverted to a genuine **allowlist**. `README.md` and `AGENTS.md` both now describe it as
> removed. The mirrored specs under `docs/specs/` (`nrs-mcp-architecture.md`,
> `nrs-video-pipeline-architecture.md`) still describe the denylist as live and are stale on
> this point; they are copies of Obsidian notes, and the code wins.

`adaptToolsForMCP(tools, mcpServer, principal, toolFactory)` in
`src/lib/mcp/tool-adapter.ts` iterates `getDirectMcpToolEntries(tools)`, so **a newly added
tool is Director-only by default and must be explicitly added to `DIRECT_MCP_TOOLS` to be
reachable from an MCP client.** The consequence is the opposite of the old guidance: a new
query-only tool that you "leave alone" will silently never appear to Claude Desktop, Cowork
or Codex. Orchestration and content tools need no action at all.

MCP clients are messengers. They hand intent to `chat_with_director` and wait; they do not
write marketing copy and they do not reach a live account. Two tests hold the surface
honest: `direct-tool-registration.test.ts` (every allowlisted name actually exists on the
Director) and `direct-tools-coverage.test.ts` (the surface may not grow past a cap without
review). The MCP server itself is Streamable HTTP at `/api/mcp`, with OAuth 2.0 + PKCE
across `/api/mcp/{authorize,register,token}` and the two `/.well-known/oauth-*` documents,
and is created fresh per request, scoped to one authenticated principal's granted projects.
Spec: `~/Obsidian/Reference/nrs-mcp-architecture.md`.

---

## Agents — 1 Director + 14 departments

`ACTIVE_AGENT_TYPES` in `src/types/database.ts` is the list: `overall` (the Director) plus
`content`, `seo`, `paid_ads`, `strategy`, `email`, `growth`, `brand`, `competitor`,
`website`, `compliance`, `analytics`, `automation`, `video`, `help`. `martech` is archived
and kept only so old conversations still resolve. Labels are owner-facing and deliberately
plain — "Get Found Online", not "SEO & GEO".

**Departments are invisible to the owner.** The Director is the only face.

Tool sets come from `getToolsForAgent(agentType, ctx)` in `src/lib/agents/tools/index.ts`.
They change often enough that listing them here guarantees this page goes stale. Read the
function; do not read a table in a document.

**`getToolsForAgent` is not the whole tool set, and `web_search` is the trap.** It is a
Gateway sub-tool (`gateway.tools.perplexitySearch`), attached *outside* that function, so
grepping `tools/index.ts` for it finds nothing. An earlier revision of this page drew
exactly that inference and stated, as a correction of a supposed earlier error, that
`web_search` is never handed to an agent. It is. Two attach points, both verified
2026-08-17:

- `src/app/api/chat/route.ts` — attached to `overall` (the Director), `seo` and `competitor`,
  but **not** when a Desk context is in force.
- `src/lib/agents/worker.ts` — attached to every department in `WEB_SEARCH_AGENTS`
  (`seo`, `competitor`), or to any worker called with `withWebSearch: true`.

`grep -rn "web_search" src/` shows both in one call, and is the way to re-check this rather
than trusting the sentence above.

Two things about `tools/index.ts` worth knowing before you edit it:

- `managementTools` — the nine every agent gets — is `create_task`, `request_approval`,
  `handoff_to_department`, `query_outputs`, `read_proforma`, `get_brand_kit`,
  `project_brief`, `goal_interview`, `sync_brand_to_canva`. **`save_output` is not among
  them**; it is added per agent.
- A tool's returned string is read aloud to the owner, so it must not interpolate a raw
  error. Log with `console.error`, or pass through `userSafeError()`. Enforced by
  `src/lib/errors/no-raw-errors.test.ts`.

Import Zod as `import { z } from 'zod/v3'` for tool schemas — v4 shapes break AI SDK v6.

Minor inconsistency, recorded rather than silently tidied: the chat route's own
`VALID_AGENT_TYPES` includes archived `martech` and omits `help`, so `help` is reachable
through the worker but not as a direct chat target.

---

## Memory (in-app — distinct from gbrain)

Three layers on Supabase + pgvector, all under `src/lib/memory/`:

| Layer | File | What it is |
|---|---|---|
| Individual facts | `store.ts`, `fact-extractor.ts` | LLM fact extraction, vector search via the `match_memories` RPC, semantic dedup at 0.85 cosine — above that it **updates** rather than inserting. Falls back to keyword search when embedding fails. |
| Session record | `session-memory.ts` | A compounding 7-section markdown record per brand, updated in place every few turns and embedded for search. Injected into prompts as "Brand Learning". |
| Cross-department | namespaces | `nrs-{brandSlug}-{agentType}`, plus a global `nrs-agency` namespace. |

**Embeddings go through the Gateway** (`embeddings.ts`), model overridable via
`NRS_EMBEDDING_MODEL`, requested at `EMBEDDING_DIMENSIONS = 1536` because
`agent_memories.embedding` is `vector(1536)` and Postgres rejects anything else. The width
is a contract, not a preference. The predecessor called a provider directly and needed an
API key that was never set, so every embed threw silently and — per the header comment on
`embeddings.ts`, which is the only record of the figure — 7,074 memories were stored with no
vector at all. Two models do not share a vector space even at identical width, so changing
the model means re-embedding every row.

**`agent_memories.value` is a TEXT column.** Reads return a string, whatever was written.
Always go through `parseMemoryValue()` (`memory-value.ts`). Casting it straight to an object
fails silently and has already disabled three features at once — the thread boundary, the
correction tally and reaction learning. None of them threw.

Architecture note: `~/Obsidian/Decisions/2026-04-06-nrs-memory-architecture-v2.md`.

---

## Data, auth and scheduled work

- **64 tables in the live `public` schema** and 55 migrations shipped (checked 2026-08-17).
  Do not work from a table list in a document — read `src/types/database.ts`, then the live
  schema. Any doc claiming 15 or 22 tables is years behind.
- **RLS** uses three helper functions from `supabase/migrations/015_team_members.sql` —
  `is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand` — rather than
  per-table bespoke policies. Project- and key-level scoping sits on top in
  `src/lib/security/` (`project-access`, `execution-scope`, `marketing-data-boundary`),
  each with its own test.
- **Three Supabase clients, never mixed:** `lib/supabase/client.ts` (browser),
  `lib/supabase/server.ts` (RSC + API routes, respects RLS), `lib/supabase/admin.ts`
  (service role — webhooks, cron, dispatcher). `src/middleware.ts` refreshes the session on
  every non-static request; all `/agency/*` requires auth.
- **Budget in cents** (integers). `audit_log` is append-only. `agent_configs` are templates;
  `agent_registry` is runtime state (status, budget, model).
- **Six Vercel crons**, defined in `vercel.json` — that file is the only list worth reading:
  `/api/heartbeat` (15 min), `/api/cron/recover-director-jobs` (5 min),
  `/api/cron/publish-posts` (5 min), `/api/cron/daily-intel` (daily),
  `/api/cron/web-vitals` (weekly), `/api/cron/weekly-traffic` (weekly). Five further
  `/api/cron/*` routes exist in the tree (`backfill-memory-embeddings`,
  `consolidate-memories`, `learn-projects`, `monitor-alerts`, `performance-learn`) and are
  **not** registered in `vercel.json` — nothing schedules them automatically.
- **Webhooks in:** `/api/webhooks/mixpost`, `/api/webhooks/telegram`, `/api/webhooks/zernio`
  (inbox events only today — Zernio's `post.published` / `post.failed` are not yet handled,
  which is why publish confirmation is polled).

---

## UI shape

Four rooms, defined in `src/lib/room-config.ts` — `Today` (`/agency/board`),
`Director's Office` (`/agency/chat`), `Creative Studio` (`/agency/studio`), `Command Centre`
(`/agency/tasks`). Flat routes; no route groups.

**Creative Studio has no sub-tabs.** They were removed deliberately in favour of a left
sidebar (`src/components/agency/studio/StudioSidebar.tsx`, 14 destinations) to avoid double
navigation, matching Mixpost Pro's layout. Command Centre keeps sub-tabs, ordered by
urgency — Inbox sits second because a customer message waiting on a reply is the most
time-sensitive thing there, and because `StudioSidebar` is `hidden md:flex`, so anything
filed in Studio is unreachable on a phone.

`/agency/studio/create` renders the composer (`PostCreator`). The second composer at
`/agency/studio/post` was retired to a redirect.

Product rules that override normal engineering instinct, and are not negotiable:

1. **The owner is non-technical.** Conversation-first, never form-first. If data is missing,
   the Director asks in chat. **Never ask him to open DevTools, the Network tab or a
   console** — instrument the client to POST breadcrumbs to a server endpoint and read them
   from the terminal (`/api/debug/upload-log` → `scripts/read-upload-trace.mjs` is the
   working pattern; extend it rather than asking for a paste).
2. **The Director is the only face.** External AI clients are messengers.

Studio spec: `~/Obsidian/Reference/nrs-creative-studio-definitive-architecture.md`.

---

## Styling

- **Australian English** in all code, copy and comments (colour, behaviour, organisation).
- **oklch colours only.** Neutral greys plus a silver/chrome hue around 240 in
  `globals.css`; gold accents around hue 75 appear in components.
- **Fonts:** IBM Plex Sans (body), IBM Plex Mono (code/terminal), loaded via
  `next/font/google` in `src/app/layout.tsx` and exposed as `--font-sans` / `--font-mono`.
- **Dark by default:** `next-themes` with `attribute="class"`, `defaultTheme="dark"`,
  `enableSystem={false}` (`src/providers/ThemeProvider.tsx`). Variables in
  `src/app/globals.css`.
- **shadcn v4 / base-ui:** use the `render` prop, **never `asChild`**. Pages using base-ui
  need `force-dynamic`.
- **No new Three.js.** It exists only for the landing and about heroes. Never touch
  `src/app/page.tsx` or `WaterRippleHero`.

---

## Tests are guardrails, not just unit tests

`npm test` runs `tsx --test` over every `src/**/*.test.ts` — 181 files as at 2026-08-17.
Run one directly for the fast loop:

```bash
npx tsx --test src/lib/agents/publish-gate.test.ts
```

Several tests read the source tree and fail the build on an architectural violation. Treat
a failure as "you broke a rule", not "fix the assertion":

| Test | Rule it holds |
|---|---|
| `lib/agents/regulatory-invariants.test.ts` | Every exit to a live account reaches the gate, before the send; retired publishers stay retired; backend choice stays in `selectPublisherBackend` |
| `lib/agents/publish-gate.test.ts`, `save-gate.test.ts` | The two chokepoints, including fail-closed on an incomplete review |
| `lib/zernio/account-scoping.test.ts` | Zernio account filtering happens in our code, after normalisation |
| `lib/mcp/direct-tool-registration.test.ts`, `direct-tools-coverage.test.ts` | The MCP allowlist names real tools and does not quietly grow |
| `lib/errors/no-raw-errors.test.ts` | No tool returns a raw error string to the owner |
| `lib/security/*.test.ts` | Project scope, execution scope, marketing-data boundary, GitHub connector isolation |
| `lib/video/binary-shipped.test.ts`, `agents/heygen-removal.test.ts` | Dependency invariants |

Before claiming a feature is done: `npm test`, `npm run lint`, `npm run build` all pass,
then `graphify update .`.

---

## The interface architecture (settled 2026-08-17)

Five prior attempts were rejected. What follows is what Justin approved, and the reasoning, so
it is not re-litigated by the next person to open a design file. Reference screens live in
`.mockups/dept-*.html`.

### The shape

```
 ┌──────────────┬───────────────────────────────────┬──────────────────┐
 │  SIDEBAR     │            THE WORK               │  DIRECTOR RAIL   │
 │  236px       │                                   │  380px           │
 │              │  Social media is a DEPARTMENT     │  tabs            │
 │ [business ▾] │  with inner tabs:                 │  conversation    │
 │ [health ⏻ ]  │  Compose · Posts · Calendar ·     │  suggested       │
 │              │  Media · Templates · Schedule ·   │  ───────────     │
 │ + Create post│  Analytics                        │  input (pinned)  │
 │              │                                   │                  │
 │ 12 sections, │  Every primary action here is a   │  collapsible     │
 │ flat, always │  MANUAL control.                  │                  │
 │ expanded     │                                   │                  │
 └──────────────┴───────────────────────────────────┴──────────────────┘
```

### The rules, and why each exists

**1. The human drives. The AI is optional.**
Every screen must be complete and fully usable with the Director rail collapsed. Every primary
action is a manual control a person clicks. AI proposals are secondary, quieter, dismissable, and
never the only way to start anything.

*Why:* Justin — "stop assuming agent is in control, HUMANS WILL DRIVE MUCH OF THIS IF THEY CHOOSE."
A product that only works when you talk to it has excluded every subscriber who wants the tooling
and none of the conversation. The test when reviewing any screen: collapse the rail — is it still
whole?

**2. The Director rail is on every screen, and it is persistent.**
Right side, full height, tabs (Director | Preview | Activity | Analytics), conversation, a
suggested list, and an input **pinned to the bottom**. It follows the owner between screens and
stays current to what is on screen.

*Why:* this is the pattern Vercel's Agent panel and Supabase's assistant use, and it is what
Justin asked for twice after two designs put the AI in the centre instead. A blank chat box as
the front door is the failure mode being avoided — a busy owner does not know what to ask.

**3. The business selector is the tenant scope, and it retints everything.**
Selecting a business filters accounts, counts, posts and media to it, and the whole UI retints
from three custom properties — `--brand`, `--brand-deep`, `--brand-wash`. One variable set, not
per-component theming.

*Why:* the daily friction in Mixpost is ~20 accounts from 14 brands in one row. **Design for the
common case: almost every subscriber has ONE business**, so with one business the selector reads
as a quiet label, not a switcher. Justin has fourteen; that is the exception, not the default.

**4. Healthcare mode is a per-business switch that sets the guardrails.**
On: every post, blog and ad is checked against AHPRA/TGA before it can go out, a compliance record
appears under Settings, wording changes throughout, and Advertising gains a health section. Off:
none of that appears at all.

*Why:* the rules follow the business so the owner never has to remember them, and an unregulated
project (Scent Sell) is never shown an AHPRA warning it does not need. Note the "words to avoid"
list is doing **regulatory** work on a health business, not stylistic work — it cannot be edited
as freely as ordinary brand preferences.

**5. The sidebar is flat and always expanded — twelve sections with sub-items visible.**
Dashboard · Business analysis · Branding & voice · Connections · Competitors · Google
searchability · AI searchability · Website · Blogging · Social media · Advertising · Engagement,
then Settings under a THIS BUSINESS heading.

*Why:* Justin, on seeing it — "in this format is super easy for me to follow." It is more ink than
a collapsing tree, and that trade was made deliberately. Google searchability (found via Google)
and AI searchability (found and described correctly by ChatGPT, Claude, Perplexity, Gemini) are
**separate sections**, at his instruction.

**6. Create post opens the Social media department, not a modal.**
That department is the whole posting experience, with its own inner tabs.

*Why:* Justin — "the create Post needs to actually open Social Media Department, and then that's
the whole Mixpost." Mixpost's navigational clarity is the thing being adopted; NRS adds the
agency functions around it.

**7. Analytics, Media library and Calendar are nested under Social media.**
Blogging reaches the media library for images, and Advertising reaches analytics, without either
becoming a second copy.

**8. Blogging never publishes to the subscriber's website.**
NRS drafts, checks and hands over text and images, and helps get a post into their sitemap. It
does not publish.

*Why:* Justin — "It's their blog." For a health business, publishing to their site on their behalf
is a legal exposure, not a convenience. No control may imply otherwise.

**9. Unfinished states stay visible and honest.**
"Google searchability — not set up" and "Nothing has gone out yet" are deliberate. A design pass
will want to tidy them away because they look unresolved; they are the difference between this
product and one that lies.

### What has no backend yet

Google searchability and AI searchability are designs for something unbuilt — no Search Console,
no AI-visibility checking. Blogging is partial. The screens are honest about this; the code must
stay honest about it too.
