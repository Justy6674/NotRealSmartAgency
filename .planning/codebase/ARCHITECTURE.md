<!-- refreshed: 2026-07-30 -->
# Architecture

**Analysis Date:** 2026-07-30

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ENTRY CHANNELS                                   │
├───────────────────┬────────────────────┬────────────────────┬───────────────┤
│  Web chat (UI)    │  MCP (external AI) │  Telegram          │  Cron          │
│ `src/app/api/     │ `src/app/api/mcp/  │ `src/app/api/      │ `src/app/api/  │
│  chat/route.ts`   │  route.ts`         │  webhooks/telegram`│  heartbeat`    │
│  streamText       │  chat_with_director│  runDirectorJob    │  runAgentWorker│
└─────────┬─────────┴─────────┬──────────┴──────────┬─────────┴───────┬───────┘
          │                   │                     │                 │
          │        ┌──────────▼─────────────────────▼─────────┐       │
          │        │   PROJECT-SCOPE GATE (capability check)   │       │
          │        │ `src/lib/security/project-access.ts`      │       │
          │        │ `src/lib/agents/director-execution.ts`    │       │
          │        │  McpPrincipal → grants → assertCapability │       │
          │        └──────────┬───────────────────────────────┘       │
          │                   │                                        │
          ▼                   ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DIRECTOR (agent_type = 'overall')                     │
│  Web:  streamText  `src/app/api/chat/route.ts:391`                           │
│  Async: runDirectorJob `src/lib/mcp/director-job.ts:82` (mcp_jobs row)       │
│  Prompt: `src/lib/agents/prompt-builder.ts:542` buildSystemPromptWithMemory  │
│  Routing hint: `src/lib/agents/intent-router.ts:135` classifyIntent          │
└───────────────┬───────────────────────────────────┬─────────────────────────┘
                │ delegate_to_agent / convene_meeting│ direct tool calls
                ▼                                   ▼
┌───────────────────────────────────────┐  ┌────────────────────────────────┐
│      AgentWorker (13 departments)     │  │  TOOL LAYER (~56 factories)    │
│  `src/lib/agents/worker.ts:111`       │  │ `src/lib/agents/tools/index.ts`│
│  own model / memory / tools / budget  │  │  getToolsForAgent(type, ctx)   │
│  runParallelAgents max 4 concurrent   │  └────────────┬───────────────────┘
└───────────────┬───────────────────────┘               │
                │                                       │
                ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (Postgres + RLS)                            │
│  brands · brand_proforma_sections · agent_registry · agent_memories          │
│  scheduled_posts · media_items · outputs · tasks · goals · mcp_jobs          │
│  api_keys · project_access_grants · audit_log · execution_audit              │
└──────────────┬────────────────────────────────────────┬─────────────────────┘
               │                                        │
               ▼                                        ▼
┌────────────────────────────────┐      ┌─────────────────────────────────────┐
│ Publishing                     │      │ External providers                   │
│ `src/lib/publishers/           │      │ AI Gateway (`@ai-sdk/gateway`)       │
│  dispatcher.ts` native → then  │      │ Canva · Blotato · Deepgram · Resend  │
│  Mixpost `src/lib/mixpost/`    │      │ Stripe · GitHub App · Perplexity     │
└────────────────────────────────┘      └─────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Web chat route | Streams the Director/department turn to the browser, owns per-turn budget, audit, memory extraction | `src/app/api/chat/route.ts` |
| AgentWorker | One independent department execution: own config, model, memory, tools, budget, audit | `src/lib/agents/worker.ts` |
| Tool assembler | Builds the per-agent-type tool set from ~56 factories | `src/lib/agents/tools/index.ts` |
| Prompt builder | Assembles brand context + knowledge + memory + goal into the system prompt | `src/lib/agents/prompt-builder.ts` |
| Intent router | Keyword classification → routing hints injected into the Director prompt (no LLM call) | `src/lib/agents/intent-router.ts` |
| Delegation | `delegate_to_agent` — 1..N departments, parallel via `runParallelAgents` | `src/lib/agents/tools/delegate.ts` |
| Meetings | `convene_meeting` — N departments with per-department briefs, parallel | `src/lib/agents/tools/convene-meeting.ts` |
| MCP server factory | Registers the *allowlisted* MCP surface for one authenticated, project-scoped connection | `src/lib/mcp/server.ts` |
| MCP allowlist | The only AI SDK tools an external client may invoke directly | `src/lib/mcp/director-only-tools.ts` |
| MCP tool adapter | Wraps an AI SDK tool as an MCP tool, rebuilding it per-call with the requested `brand_id` | `src/lib/mcp/tool-adapter.ts` |
| Async Director job | Full Director run for MCP/Telegram, writing progress into `mcp_jobs` | `src/lib/mcp/director-job.ts` |
| Project access | Capability model (`director:chat`, `draft:post`, `direct:read`, `direct:utility`, `publish:request`) | `src/lib/security/project-access.ts` |
| Model routing | Tier selection (fast/agency/frontier/code), fallback chains, cost estimation | `src/lib/ai/model-routing.ts` |
| Agent registry | Per-user, per-department runtime state: model, status, monthly budget in cents | `src/lib/agents/registry.ts` |
| Heartbeat | Cron worker: goal reviews, assigned-task execution, monthly budget reset | `src/app/api/heartbeat/route.ts` |
| Memory v1 (Ruflo) | Keyword memory store/search over `agent_memories` | `src/lib/ruflo/client.ts` |
| Memory v2 | Embedding store + `match_memories` RPC semantic search | `src/lib/memory/store.ts` |
| Proforma | 21 strategic sections per project, seeded from brand data | `src/lib/proforma/sections.ts`, `src/lib/proforma/auto-populate.ts` |
| Discovery | Source-grounded first pass on a newly connected project (GitHub + sitemap + social) | `src/lib/discovery/project-discovery-run.ts` |
| Publisher dispatcher | Native platform API first, Mixpost as fallback | `src/lib/publishers/dispatcher.ts` |

## Pattern Overview

**Overall:** Orchestrator + independent worker agents on a serverless Next.js App Router backend, with a project-scoped capability gate in front of every non-web channel.

**Key Characteristics:**
- **One Director, thirteen workers.** The Director never prompt-switches into a department; it spawns a genuinely separate `generateText` run per department (`src/lib/agents/worker.ts:250`).
- **The project (`brands` row) is the isolation unit.** Every prompt, memory namespace, tool closure, and grant is bound to a single `brand_id`.
- **Channels are untrusted; the Director is trusted.** MCP and Telegram clients are messengers — they can read state and call a handful of bounded utilities, and everything else must pass through `chat_with_director`.
- **Tools are factories, not singletons.** `brandId` is baked into the closure at creation, so any cross-project call requires rebuilding the tool (`src/lib/mcp/tool-adapter.ts:70`).
- **Cost and audit are first-class.** Every agent execution records spend against `agent_registry`, writes `ai_usage`, and appends to `audit_log`.

## Layers

**Entry / transport layer:**
- Purpose: authenticate, validate, and scope an inbound request
- Location: `src/app/api/`
- Contains: route handlers, MCP transport, OAuth endpoints, webhooks, cron endpoints
- Depends on: `src/lib/supabase/*`, `src/lib/auth/api-key.ts`, `src/lib/security/*`
- Used by: browser UI, external MCP clients, Telegram, Vercel Cron, Mixpost/Stripe webhooks

**Security / scope layer:**
- Purpose: turn an identity into an explicit, per-project, per-capability grant
- Location: `src/lib/security/`, `src/lib/agents/director-execution.ts`
- Contains: `McpPrincipal`, `ProjectCapability`, `assertProjectCapability`, `createExecutionScope`, marketing-input inspection
- Depends on: `api_keys`, `api_key_project_grants`, `project_access_grants`
- Used by: MCP route, MCP tools, Telegram webhook, Director job runner

**Agent layer:**
- Purpose: run an agent turn with the right identity, knowledge, memory, tools, and budget
- Location: `src/lib/agents/`
- Contains: worker, prompt builder, intent router, registry, goal loop, compliance filter, marketing skills, knowledge packs
- Depends on: AI Gateway, Supabase, tool layer, memory layer
- Used by: chat route, MCP director job, heartbeat, delegation/meeting tools

**Tool layer:**
- Purpose: give agents capabilities against internal data and external services
- Location: `src/lib/agents/tools/` (~56 non-test files)
- Contains: one factory per tool returning an AI SDK `tool({ description, inputSchema, execute })`
- Depends on: Supabase, Mixpost, Canva, Blotato, media pipeline, publishers
- Used by: `getToolsForAgent`, and (filtered) the MCP surface

**Integration layer:**
- Purpose: talk to third parties behind a stable internal contract
- Location: `src/lib/mixpost/`, `src/lib/publishers/`, `src/lib/canva/`, `src/lib/blotato/`, `src/lib/transcription/`, `src/lib/video/`, `src/lib/stripe/`, `src/lib/email/`, `src/lib/github/`, `src/lib/telegram/`
- Used by: tool layer and cron routes

**Data layer:**
- Purpose: single source of truth, with RLS as the last line of defence
- Location: `supabase/migrations/`, `src/types/database.ts`, `src/lib/supabase/{client,server,admin}.ts`

## Data Flow

### Primary request path — web Director chat

1. `POST /api/chat` authenticates via the Supabase server client (`src/app/api/chat/route.ts:45`).
2. Request validated with Zod: `messages`, `brandId`, `agentType`, `conversationId` (`src/app/api/chat/route.ts:37`).
3. Brand fetched under RLS; `agent_configs` row fetched for the agent type (`src/app/api/chat/route.ts:69`).
4. `getOrCreateAgentRegistry` + `checkBudget` — a spent-out agent returns HTTP 429 (`src/app/api/chat/route.ts:97`).
5. `inspectMarketingInput` rejects restricted input before any model call (`src/app/api/chat/route.ts:125`).
6. `ensureProforma` loads (or first-time seeds) the 21 proforma sections and a status summary is built with staleness per `CADENCE_DAYS` (`src/app/api/chat/route.ts:135`).
7. `buildSystemPromptWithMemory` assembles brand context + knowledge + retrieved memory + active goal (`src/lib/agents/prompt-builder.ts:542`).
8. For the Director only, ~10 additional directive blocks are appended/prepended: intent-routing hints, marketing-skill context, pending-draft queue summary, auto-research trigger when `market_context` is RED, brand-context safety, product-research rule, mandatory approval-before-publish, inquisitive behaviour, creation-session rule, hashtag rule, identity enforcement, media-analysis rule, caption-format rule (`src/app/api/chat/route.ts:181-345`).
9. `getToolsForAgent` builds the tool set; for the Director, `delegate_to_agent` + `convene_meeting` are attached, and `web_search` (Perplexity via Gateway) for `overall`/`seo`/`competitor` (`src/app/api/chat/route.ts:349-379`).
10. `resolveAgentModelRoute` picks the tier, then `streamText` runs with `stopWhen: stepCountIs(8)` (`src/app/api/chat/route.ts:391-396`).
11. `onFinish` records spend, inserts `ai_usage`, writes `audit_log`, and fires memory extraction v1 (regex) + v2 (LLM) plus session memory (`src/app/api/chat/route.ts:402-497`).

### Delegation / meeting flow

1. Director calls `delegate_to_agent` (`src/lib/agents/tools/delegate.ts:48`) or `convene_meeting`.
2. Each department becomes a `runAgentWorker` call: own `agent_configs` row, own `agent_registry` model + budget, own memory namespace, own tools (`src/lib/agents/worker.ts:123-235`).
3. Worker status flips to `working`, then back to `idle` (`src/lib/agents/worker.ts:164`, `:267`).
4. `generateText` runs with `stopWhen: stepCountIs(3)` by default and an `AbortController` timeout — 120 s for delegation, 180 s for meetings (`src/lib/agents/worker.ts:246-258`).
5. Result is inserted into `outputs` with a department-mapped `output_type`, audited, and fed back into that department's memory namespace (`src/lib/agents/worker.ts:284-359`).
6. `runParallelAgents` batches at `MAX_CONCURRENT_WORKERS = 4` using `Promise.allSettled` (`src/lib/agents/worker.ts:404-445`).

### MCP flow (external AI client)

1. `POST /api/mcp`. Handshake methods (`initialize`, `tools/list`, `ping`, …) are public; everything else needs `Authorization: Bearer nrs_sk_…` (`src/app/api/mcp/route.ts:30-73`).
2. `resolveApiKey` → `toScopedMcpPrincipal` builds an `McpPrincipal` carrying `{ userId, keyId, grants[] }` (`src/lib/auth/api-key.ts:34`).
3. `createNRSMcpServer(principal)` registers: `list_projects`/`list_brands`, `chat_with_director`, `get_director_response`, `draft_post`, the `brands://list` resource, the `quick_start` prompt, and the allowlisted direct tools (`src/lib/mcp/server.ts:22-193`).
4. `adaptToolsForMCP` filters the Director's full tool set through `getDirectMcpToolEntries` — only names in `DIRECT_MCP_TOOLS` are ever registered (`src/lib/mcp/tool-adapter.ts:116-127`).
5. On each direct call, `assertProjectCapability(principal, brandId, 'direct:utility')` runs, the brand's existence is confirmed, and the tool is rebuilt with the correct `brandId` (`src/lib/mcp/tool-adapter.ts:45-72`).
6. `chat_with_director` inserts a `mcp_jobs` row (`status='queued'`) and returns a `job_id` in <1 s, then fires `runDirectorJob` via Next.js `after()` (`src/lib/mcp/director-chat.ts:90-128`).
7. `runDirectorJob` re-verifies the job's scope against the execution scope before doing any work (`src/lib/mcp/director-job.ts:100-114`), then runs the Director and writes the result back to `mcp_jobs`.
8. The client polls `get_director_response(job_id)` (`src/lib/mcp/director-job-tool.ts`).

### Heartbeat (autonomous work)

1. Vercel Cron hits `GET /api/heartbeat` every 15 minutes with `Authorization: Bearer $CRON_SECRET` (`vercel.json`, `src/app/api/heartbeat/route.ts:100`).
2. On the 1st of the month before 01:00, `agent_registry.spent_monthly_cents` resets to 0.
3. `enqueueDueGoalReviews` claims each due objective-level goal, skips it if open work exists, and queues a `goal_review` task for the Director (`src/app/api/heartbeat/route.ts:26-98`).
4. Only tasks with `status='assigned'` **and** a non-null `goal_id` on an active objective are executed — legacy unscoped tasks stay visible but never run autonomously (`src/app/api/heartbeat/route.ts:133-145`).
5. Each task runs through `runAgentWorker` with `timeoutMs: 240000, maxSteps: 5`; a goal review that didn't call `update_goal_progress` is treated as a failure (`src/app/api/heartbeat/route.ts:200-219`).

### Discovery pipeline (project onboarding)

1. GitHub App install callback (`src/app/api/integrations/github/callback/route.ts:322`) calls `runProjectDiscovery`.
2. GitHub: `readGitHubProductContext` → summary capped at 16 000 chars → written to `brands.github_context` + a `project_scans` row (`src/lib/discovery/project-discovery-run.ts:63-94`).
3. Website: `scanWebsiteCore` plus a **bounded, same-origin** sitemap read — robots.txt then at most 5 sitemap candidates, at most 50 page URLs, no page crawling (`src/lib/discovery/project-discovery.ts:88-107`).
4. Social: `scanSocialCore` against `brands.social_urls`.
5. All three write `project_scans` rows carrying the same `brand_id`; the callback then kicks a Director job so the first pass lands in the project's own context.

**State Management:**
- Server state lives in Supabase; there is no server-side session cache.
- Client state is a single Zustand store persisted to `localStorage` key `nrs-agency` (`src/stores/agency-store.ts`) holding `activeBrandId`, `activeAgentType`, `activeConversationId`, `activeView`, and transient hand-offs like `pendingReviewMessage`.
- In-process only: `recordTurn`/`shouldExtractSessionMemory` counters in `src/lib/memory/session-memory.ts` — these do not survive a cold start.

## Key Abstractions

**Project (a `brands` row):**
- Purpose: the isolation unit. "Brand" in the schema, "project" in the newer security and MCP code — the same row.
- Type: `src/types/database.ts:321`
- Reaches agents via `buildBrandContext` (`src/lib/agents/prompt-builder.ts:251`) which renders name, tagline, description, website, socials, niche, business stage, marketing status/notes, verified products & services (twice — see Anti-Patterns), tone of voice, target audience, content pillars, competitors, and a derived competitive-edge block.

**Proforma section:**
- Purpose: 21 living strategic sections per project with RAG status and review cadence
- Definition: `src/lib/proforma/sections.ts:8`
- Seeding: `ensureProforma` inserts all 21 on first read, deriving RAG from what the brand row already knows (`src/lib/proforma/auto-populate.ts:177`)
- Consumption: the chat route renders `executive_snapshot` in full plus a status/staleness line per other section (`src/app/api/chat/route.ts:137-169`); agents read/write via the `read_proforma` / `update_proforma` tools (`src/lib/agents/tools/proforma.ts`)

**McpPrincipal + ProjectCapability:**
- Purpose: an identity is never enough — access is `(user, project, capability)`
- Definition: `src/lib/security/project-access.ts`
- Capabilities: `director:chat`, `draft:post`, `direct:read`, `direct:utility`, `publish:request`
- Persistence: `project_access_grants` joined to a key through `api_key_project_grants` (`supabase/migrations/039_project_scope_security.sql`)

**AgentWorker:**
- Purpose: one department execution as a first-class unit with its own everything
- Definition: `src/lib/agents/worker.ts:111`; result contract `WorkerResult` includes `toolNames` so code gates can assert what actually ran

**Memory namespace:**
- Purpose: scope retrieval to one department of one project
- Definition: `src/lib/ruflo/namespaces.ts` — `nrs-{brandSlug}-{agentType}`, brand-wide `nrs-{brandSlug}`, global `nrs-agency`
- Retrieval policy: ordinary project work may retrieve **only** the two project namespaces — `getProjectMemoryNamespaces` (`src/lib/agents/prompt-builder.ts:25`). `nrs-agency` is not in the ordinary path.

**Model tier:**
- Purpose: route by job, not by hardcoded model string
- Definition: `src/lib/ai/model-routing.ts:30` — `fast` haiku-4.5, `agency` sonnet-5 (default), `frontier` opus-5, `code` gpt-5.3-codex, each with a fallback chain

## Entry Points

**Web chat — `POST /api/chat`:**
- Location: `src/app/api/chat/route.ts`
- Triggers: the browser chat UI (`src/components/agency/ChatInterface.tsx`)
- Responsibilities: authenticated streaming turn for any agent type, budget gate, memory write-back
- `maxDuration = 300`

**MCP — `POST/GET/DELETE /api/mcp`:**
- Location: `src/app/api/mcp/route.ts`
- Triggers: Claude Desktop/Mobile/Code and any MCP client, via Bearer key or OAuth
- `maxDuration = 600`

**Telegram — `POST /api/webhooks/telegram`:**
- Location: `src/app/api/webhooks/telegram/route.ts`
- Triggers: paired Telegram chats; runs the same `runDirectorJob` with a `telegram` execution scope
- Companion mini-app endpoints under `src/app/api/telegram/mini-app/`

**Heartbeat — `GET /api/heartbeat`:** cron, every 15 min, `maxDuration = 300`.

**Publish cron — `GET /api/cron/publish-posts`:** every 5 min; drains due `scheduled_posts` through `src/lib/publishers/dispatcher.ts`.

**Daily intel — `GET /api/cron/daily-intel`:** 20:00 daily.

**Mixpost webhook — `POST /api/webhooks/mixpost`:** HMAC SHA-256 verified (`src/lib/webhooks/mixpost-signature.ts`).

**Stripe webhook — `POST /api/stripe/webhook`.**

## Architectural Constraints

- **Threading:** single-threaded serverless functions. Parallelism is `Promise.all`/`allSettled` over network calls only, capped at `MAX_CONCURRENT_WORKERS = 4` (`src/lib/agents/worker.ts:39`).
- **Serverless lifetime:** background work after a response uses Next.js `after()` (`src/lib/mcp/director-chat.ts:122`). It is bounded by `maxDuration`, so `runDirectorJob` must finish inside 600 s or the `mcp_jobs` row is left `running`.
- **Global state:** module-level maps in `src/lib/memory/session-memory.ts` (turn counters) do not survive cold starts; treat them as best-effort. `src/lib/publishers/rate-limiter.ts` is likewise per-instance.
- **Three Supabase clients, never mixed:** `src/lib/supabase/client.ts` (browser), `server.ts` (RSC/route, RLS applies), `admin.ts` (service role, RLS bypassed). MCP, Telegram, cron, and webhooks all run on the admin client — which is precisely why the capability gate exists.
- **Tool closures are project-bound.** `getToolsForAgent(agentType, ctx)` captures `brandId`. Reusing a built tool for a different project is a bug; MCP rebuilds per call.
- **Step limits:** chat 8, worker 3 (delegation/meeting), heartbeat 5.
- **Circular imports:** none observed on the agent path; `worker.ts → tools/index.ts` and `tools/delegate.ts → worker.ts` are kept acyclic by *not* importing `delegate` from `tools/index.ts` — the Director's delegation tools are attached in the route (`src/app/api/chat/route.ts:358`), which is why `tools/index.ts:219` carries that note.
- **Zod version:** AI SDK tool schemas import `zod/v3`, not `zod`.

## Anti-Patterns

### Prompt directives duplicated across Director entry points

**What happens:** The identity-enforcement block, media-analysis rule, and caption-format rule are written out in full in both `src/app/api/chat/route.ts:257-345` and `src/lib/mcp/director-job.ts` — the source comments say so explicitly ("Mirror of the same rule in src/lib/mcp/director-job.ts").
**Why it's wrong:** Two copies of a several-hundred-line behavioural contract drift. A fix applied to the web Director silently leaves the MCP/Telegram Director on the old rules.
**Do this instead:** Extract the shared directive blocks into `src/lib/agents/prompt-builder.ts` (or a sibling `director-directives.ts`) and have both entry points compose them. Any new Director rule goes in one place.

### Brand products rendered twice into the same prompt

**What happens:** `buildBrandContext` emits a "Products & Services (VERIFIED …)" block at `src/lib/agents/prompt-builder.ts:294-307` and then a second "Products & Services" block at `:359-364` from the same `brand.products_services` array.
**Why it's wrong:** Duplicated context wastes tokens on every single turn of every agent, and the two blocks state slightly different framing, which is exactly the ambiguity the "VERIFIED" label was added to remove.
**Do this instead:** Keep the verified block, delete the second render, and add a prompt-builder test asserting a product name appears once.

### Read-modify-write on the budget counter

**What happens:** `recordAgentSpend` selects `spent_monthly_cents` then writes back `value + costCents` (`src/lib/agents/registry.ts:70-91`) — the comment even says "Use RPC or raw SQL for atomic increment".
**Why it's wrong:** Four workers running in parallel (the designed concurrency) will lose increments. Budget enforcement under-counts precisely when spend is highest.
**Do this instead:** Add a Postgres function `increment_agent_spend(registry_id uuid, cents int)` and call it via `supabase.rpc`.

### Fire-and-forget writes with `void`

**What happens:** The worker's output insert is `void ctx.supabase.from('outputs').insert(...)` (`src/lib/agents/worker.ts:284`).
**Why it's wrong:** In a serverless function the process can be frozen the moment the handler returns, so an un-awaited write may never reach Postgres — and the failure is silent. This class of bug has already cost a session in the Mixpost media cache path.
**Do this instead:** `await` the write, or wrap it in `after()` so the runtime keeps the function alive.

### Prompt assembly by array-index splicing

**What happens:** `buildSystemPromptWithMemory` splits the base prompt on `'\n\n---\n\n'` and splices the memory section in at index 2, then session memory at index 3 (`src/lib/agents/prompt-builder.ts:608-635`).
**Why it's wrong:** The insertion point is implicitly coupled to how many sections `buildSystemPrompt` happened to push. Adding a section at the top of `buildSystemPrompt` silently relocates memory into the middle of an unrelated block.
**Do this instead:** Build the prompt from a named section list (`{ id, body }[]`) and insert by id.

## Error Handling

**Strategy:** fail soft on enrichment, fail hard on scope.

**Patterns:**
- **Scope failures are terminal.** `assertProjectCapability` throws; MCP tool handlers convert it to `{ isError: true }` and stop (`src/lib/mcp/tool-adapter.ts:45-51`). `runDirectorJob` re-checks scope and calls `markJobError` rather than proceeding (`src/lib/mcp/director-job.ts:100-114`).
- **Enrichment failures degrade.** Memory retrieval wraps everything in try/catch and returns the base prompt with `memoryCount: 0` (`src/lib/agents/prompt-builder.ts:645`). The proforma loader logs and returns `[]`. Pending-draft injection is wrapped in a bare `try { } catch { /* non-fatal */ }` (`src/app/api/chat/route.ts:210`).
- **Worker failures are values, not throws.** `runAgentWorker` catches, resets registry status to `idle`, and returns a `WorkerResult` with `error` set (`src/lib/agents/worker.ts:371-394`). `runParallelAgents` partitions results into `results` / `errors`.
- **User-facing errors carry `friendlyMessage`.** Every non-200 from `/api/chat` includes a plain-language string for a non-technical user (`src/app/api/chat/route.ts:49`, `:59`, `:76`).
- **Budget exhaustion is a 429**, not a 500.

## Cross-Cutting Concerns

**Logging:** `console.log`/`warn`/`error` with a bracketed source tag (`[worker:content]`, `[chat]`, `[proforma]`, `[delegate]`). No logging framework. Durable evidence goes to `audit_log` (append-only, via `src/lib/agents/audit.ts`) and to `execution_audit` for scoped channel decisions — the latter has CHECK constraints forbidding `raw_input`, `message`, and `patient_data` keys in its `detail` JSONB.

**Validation:** Zod at every boundary — route bodies, AI SDK tool `inputSchema`, MCP tool `inputSchema` (which additionally injects a required `brand_id`). Import path is `zod/v3`.

**Authentication:**
- Web: Supabase cookie session refreshed by `src/middleware.ts` → `updateSession`.
- MCP: `nrs_sk_`-prefixed API key, SHA-256 hashed in `api_keys`, resolved by `resolveApiKey`; OAuth 2.0 (RFC 8414 discovery, RFC 7591 dynamic registration, PKCE S256) mints the same key type, with `oauth_auth_codes.project_ids` carrying the selected project set through the exchange.
- Telegram: one-time pairing code (SHA-256 hashed, project-scoped) → `telegram_accounts` → exactly one active `telegram_project_sessions` row per account.
- Cron: `Bearer $CRON_SECRET`.

**Authorisation:** RLS on every table plus three helper functions (`is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand`). Because MCP/Telegram/cron run on the service-role client, the capability layer in `src/lib/security/project-access.ts` is the real enforcement point for those channels.

**Compliance:** `src/lib/agents/compliance-rules.ts` injects AHPRA/TGA rules into prompts for flagged brands; `src/lib/agents/compliance-filter.ts` evaluates content before `save_output`. Health brands (`compliance_flags.ahpra || .tga`) request zero-data-retention at the Gateway (`src/app/api/chat/route.ts:400`) and route high-stakes work to the frontier tier (`src/lib/ai/model-routing.ts:206`).

**Input boundary:** `inspectMarketingInput` runs before any model call on every channel (`src/lib/security/marketing-data-boundary.ts`).

## Drift From CLAUDE.md

CLAUDE.md is broadly accurate on intent but stale on several load-bearing specifics. Verified against code on 2026-07-30:

| CLAUDE.md says | Code says | Evidence |
|---|---|---|
| MCP exposure is a **denylist**, `HIDDEN_FROM_MCP: ReadonlySet<string>` in `src/lib/mcp/server.ts` | It is an **allowlist**, `DIRECT_MCP_TOOLS` in `src/lib/mcp/director-only-tools.ts`; unlisted tools are Director-only by default | `src/lib/mcp/director-only-tools.ts:10`, `src/lib/mcp/tool-adapter.ts:122` |
| Chat uses `stopWhen: stepCountIs(5)` | 8 | `src/app/api/chat/route.ts:396` |
| Default model `anthropic/claude-sonnet-4`, hardcoded `gateway('anthropic/claude-sonnet-4')` | Tiered routing; `agency` default is `anthropic/claude-sonnet-5`, with `fast`/`frontier`/`code` tiers and fallback chains | `src/lib/ai/model-routing.ts:30-42`, `:195` |
| Cost = `(inputTokens * 0.3 + outputTokens * 1.5) / 100` cents | Per-model USD pricing table + cache-token accounting via `estimateGatewayCost` | `src/lib/ai/model-routing.ts:55-63`, `:150` |
| MCP auth resolves a user identity | Resolves a project-scoped `McpPrincipal` with explicit capabilities; a user identity alone enumerates nothing | `src/lib/security/project-access.ts`, `src/lib/mcp/server.ts:36` |
| Not mentioned | Telegram is a full third Director channel (webhook + mini-app + pairing + per-chat project session) | `src/app/api/webhooks/telegram/route.ts`, `src/lib/telegram/` |
| Not mentioned | Goal loop: `goals` objectives drive autonomous heartbeat work; unscoped tasks no longer execute | `src/lib/agents/goal-loop.ts`, `src/app/api/heartbeat/route.ts:133` |
| Not mentioned | `project_links`, `project_connectors`, `execution_audit`, memory `isolation_status` quarantine | `supabase/migrations/039_project_scope_security.sql` |
| Publishing is Mixpost-first with Ayrshare fallback | Native platform APIs first (Meta/LinkedIn/TikTok/Twitter/YouTube), Mixpost as fallback; no Ayrshare module exists in `src/lib` | `src/lib/publishers/dispatcher.ts:2-7`, `src/lib/publishers/` |
| Agent list is 14 types | 14 active plus `help` (in `AGENT_LABELS` and `toolSets`) and archived `martech` | `src/types/database.ts:422`, `src/lib/agents/tools/index.ts:320` |
| Crons: heartbeat, daily-intel, publish-posts | Same three scheduled — but `consolidate-memories`, `monitor-alerts`, and `performance-learn` routes exist with **no** `vercel.json` entry | `vercel.json`, `src/app/api/cron/` |
| HeyGen video generation | Removed; `src/app/api/video/generate` and `/status` are empty directories with no `route.ts`, and there is a regression test guarding removal | `src/lib/agents/heygen-removal.test.ts` |

---

*Architecture analysis: 2026-07-30*
