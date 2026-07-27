<!-- refreshed: 2026-07-28 -->
# Architecture

**Analysis Date:** 2026-07-28

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                        Client surfaces                       │
├──────────────────┬──────────────────┬───────────────────────┤
│  Next.js web UI  │   MCP clients    │   Telegram bot / app  │
│ `src/app/agency` │ Claude Desktop,  │ `src/app/telegram`    │
│ `src/components` │ Code, Cowork     │ `src/lib/telegram`    │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Entry / auth boundary                     │
│ `src/middleware.ts` (Supabase session) ·                     │
│ `src/lib/auth/api-key.ts` + OAuth ·                          │
│ `src/lib/security/project-access.ts` (project scoping)       │
└────────┬────────────────────────────────────┬───────────────┘
         │                                    │
         ▼                                    ▼
┌───────────────────────────┐    ┌────────────────────────────┐
│   Director (streaming)    │    │   Director (async job)     │
│ `src/app/api/chat/route`  │    │ `src/lib/mcp/director-job` │
│ streamText + stepCountIs8 │    │ tracked in `mcp_jobs`      │
└────────────┬──────────────┘    └─────────────┬──────────────┘
             │      delegate_to_agent / convene_meeting        │
             ▼                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│           AgentWorker layer — 13 department agents           │
│ `src/lib/agents/worker.ts`  generateText, ≤4 concurrent,     │
│ ≤3 tool steps, own model / memory / tools / budget / audit   │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        Tool layer                            │
│ `src/lib/agents/tools/*` assembled by `tools/index.ts`       │
│ Zod-schema AI SDK tools built by context-taking factories    │
└────────┬───────────────────┬──────────────────┬─────────────┘
         │                   │                  │
         ▼                   ▼                  ▼
┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│ Supabase       │  │ Publishing       │  │ Media pipeline  │
│ Postgres/Auth/ │  │ `src/lib/        │  │ `src/lib/media/ │
│ Storage (RLS)  │  │  publishers/`,   │  │ process-        │
│ `src/lib/      │  │ `src/lib/mixpost`│  │ pipeline.ts`    │
│  supabase/*`   │  │ → platforms      │  │ ffmpeg/ASR/AI   │
└────────────────┘  └──────────────────┘  └─────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Session middleware | Refresh Supabase session on every non-static request | `src/middleware.ts` → `src/lib/supabase/middleware.ts` |
| Director (web) | Streaming chat, prompt assembly, intent routing, spend + memory bookkeeping | `src/app/api/chat/route.ts` |
| Director (MCP) | Same Director run, async, job-tracked for external AI clients | `src/lib/mcp/director-job.ts`, `src/lib/mcp/director-chat.ts` |
| Director execution rules | Shared execution contract + completion detection | `src/lib/agents/director-execution.ts`, `src/lib/mcp/director-completion.ts` |
| AgentWorker | Independent per-department agent execution unit | `src/lib/agents/worker.ts` |
| Intent router | Free, rule-based department classification (single + multi) | `src/lib/agents/intent-router.ts` |
| Prompt builder | System prompt + memory retrieval per agent namespace | `src/lib/agents/prompt-builder.ts` |
| Model policy | Tier→model map, fallbacks, pricing, provider options | `src/lib/ai/model-routing.ts` |
| Agent registry | Runtime state: model, status, budget, org chart | `src/lib/agents/registry.ts` |
| Tool assembly | Per-agent-type tool sets | `src/lib/agents/tools/index.ts` |
| MCP server | Per-request MCP surface + `HIDDEN_FROM_MCP` allowlist | `src/lib/mcp/server.ts`, `src/lib/mcp/tool-adapter.ts` |
| Project scoping | Enforces which workspaces a principal may see | `src/lib/security/project-access.ts` |
| Marketing data boundary | Rejects restricted input before it reaches a model | `src/lib/security/marketing-data-boundary.ts` |
| Media pipeline | Single owner of all `media_items` processing writes | `src/lib/media/process-pipeline.ts` |
| Publisher dispatcher | Native-vs-Mixpost routing, retry, rate limits | `src/lib/publishers/dispatcher.ts` |
| Memory v2 | LLM fact extraction, embeddings, scoped store | `src/lib/memory/{fact-extractor,embeddings,store,session-memory}.ts` |
| Memory v1 (legacy) | Regex extraction + keyword search | `src/lib/ruflo/` |
| Proforma engine | 21-section living brand document, RAG + staleness | `src/lib/proforma/` |
| Goal loop | Active-goal retrieval and Director goal continuity | `src/lib/agents/goal-loop.ts` |
| Client state | Active brand / agent / conversation / view | `src/stores/agency-store.ts` |

## Pattern Overview

**Overall:** Multi-agent orchestration on a serverless Next.js App Router monolith, with a database-backed agent registry and an RLS-enforced Postgres as the only durable state.

**Key characteristics:**
- **One Director, thirteen invisible departments.** The user only ever talks to `overall`. Departments are spawned as workers, never surfaced as UI choices.
- **Workers, not prompt-switching.** `delegate_to_agent` and `convene_meeting` spawn genuinely separate `generateText` runs with their own model, memory namespace, tool set and budget — not a re-prompt of the same conversation.
- **Every model call goes through the AI Gateway.** No direct provider SDK usage in the agent path.
- **Tools are context-taking factories.** Each file in `src/lib/agents/tools/` exports `createXTool(ctx)` returning an AI SDK tool with a Zod schema.
- **Structural, not prompt-based, security.** MCP tool hiding, project scoping and RLS are enforced in code and in the database, not by instructions in a prompt.
- **Conversation-first UX.** Missing data is asked for in chat; forms are the fallback, never the entry point.

## Layers

**Presentation (`src/app/**/page.tsx`, `src/components/`):**
- Purpose: React 19 App Router pages and 266 components.
- Depends on: hooks in `src/hooks/`, the Zustand store, `/api/*` routes.
- Used by: browser only.
- Note: pages using base-ui components declare `export const dynamic = 'force-dynamic'`.

**HTTP (`src/app/api/**/route.ts`):**
- Purpose: ~120 route handlers — chat, CRUD, OAuth, webhooks, cron, MCP.
- Depends on: `src/lib/supabase/server.ts` (RLS) or `admin.ts` (service role), and `src/lib/`.
- Used by: UI, cron, external platforms, MCP clients.

**Agent orchestration (`src/lib/agents/`, `src/lib/mcp/`):**
- Purpose: Director run, worker execution, intent routing, prompt building, registry/budget, audit.
- Depends on: `src/lib/ai/model-routing.ts`, `src/lib/memory/`, tool layer, Supabase.
- Used by: `/api/chat`, `/api/heartbeat`, `/api/mcp`, Telegram routes.

**Tools (`src/lib/agents/tools/`):**
- Purpose: 70+ capability units — content writing, scanning, publishing, media, analytics, delegation.
- Depends on: the domain-service layer.
- Used by: `getToolsForAgent()` only. Never called directly from routes.

**Domain services (`src/lib/{mixpost,publishers,media,video,transcription,canva,memory,proforma,stripe,email,telegram,github,webhooks,security}/`):**
- Purpose: third-party clients and business logic, framework-agnostic.
- Depends on: Supabase + external HTTP APIs.
- Used by: tools and routes.

**Data (`src/lib/supabase/`, `supabase/migrations/`, `src/types/database.ts`):**
- Purpose: three clients, 42 migrations, hand-maintained types.
- Depends on: nothing.
- Used by: everything above.

## Data Flow

### Primary Director chat turn

1. Browser posts to `/api/chat` from `src/components/agency/ChatInterface.tsx`.
2. Auth + Zod validation; 401 on no user, 400 on bad shape (`src/app/api/chat/route.ts:46`).
3. Brand fetched under RLS; agent config fetched from `agent_configs` (`route.ts:82`).
4. `getOrCreateAgentRegistry` → `checkBudget`; 429 if the monthly budget is exhausted (`route.ts:96`).
5. `inspectMarketingInput` rejects restricted input (`src/lib/security/marketing-data-boundary.ts`).
6. `ensureProforma` loads/creates the 21 brand proforma sections; a snapshot + RAG/staleness summary is folded into the prompt.
7. `buildSystemPromptWithMemory` retrieves memories for `nrs-{brandSlug}-{agentType}` plus the global `nrs-agency` namespace.
8. Director-only prompt augmentation: intent routing hints, marketing skill context, draft-queue summary, brand-context safety, approval rules, caption format, media analysis rules (`route.ts:180-330`).
9. `getToolsForAgent` assembles tools; Director additionally gets `delegate_to_agent`, `convene_meeting`, and `web_search`.
10. `resolveAgentModelRoute` picks the tier/model; `streamText` runs with `stopWhen: stepCountIs(8)`.
11. `onFinish`: `recordAgentSpend`, insert `ai_usage`, `logAudit`, memory v1 + v2 extraction, session-memory extraction (`route.ts:395-500`).
12. `result.toUIMessageStreamResponse()` streams back to the client.

### Delegation / meeting

1. Director calls `delegate_to_agent` (`src/lib/agents/tools/delegate.ts`) or `convene_meeting` (`.../convene-meeting.ts`).
2. `runAgentWorker(agentType, task, ctx, options)` per department (`src/lib/agents/worker.ts`).
3. Each worker fetches its own config + registry entry, checks its own budget, retrieves its own memories, assembles its own tools, sets registry status `working`.
4. `generateText` with `stopWhen: stepCountIs(3)` (`MAX_WORKER_STEPS`).
5. Meetings run workers under `Promise.allSettled()` capped at `MAX_CONCURRENT_WORKERS = 4`.
6. Each worker records its own spend, audit row and memories; status returns to `idle`. Results are attributed by department in the UI.

### MCP client request

1. External AI client hits `/api/mcp` with a Bearer `nrs_sk_` key or an OAuth-issued token.
2. `resolveApiKey` validates; an `McpPrincipal` with project grants is produced.
3. `createNRSMcpServer(principal)` builds a fresh stateless server; `adaptToolsForMCP(..., HIDDEN_FROM_MCP)` filters the surface.
4. Orchestration/content tools are absent — the client must call `chat_with_director`, which enqueues an `mcp_jobs` row and returns immediately.
5. `src/lib/mcp/director-job.ts` runs the Director asynchronously; the client polls `get_director_response`.

### Publish

1. Draft created via `draft_post` / `manage_posts` → row in `scheduled_posts` (status `draft`).
2. `syncDraftToMixpost` mirrors it into Mixpost (idempotent on `metadata.mixpost.post_uuid`); brand + hashtag-group tags mirrored by `src/lib/mixpost/sync-tags.ts`.
3. Human approval in the Review room (`src/components/agency/studio/ReviewRoom.tsx`).
4. `/api/cron/publish-posts` (every 5 min) picks up due posts → `src/lib/publishers/dispatcher.ts` → native publisher if `USE_NATIVE_PUBLISHER_<PLATFORM>=true`, else Mixpost, else Ayrshare.
5. Every attempt logged to `publisher_runs`; failures enqueued in `publisher_retry_queue`.
6. Mixpost posts back to `/api/webhooks/mixpost` (HMAC-verified) to reconcile status.

### Media

`/api/media/upload` (or the Director's `process_media` tool) → `runMediaProcessingPipeline` in `src/lib/media/process-pipeline.ts`: thumbnail (`ffmpeg -ss 1` fast-seek from the HTTPS URL, 30s kill timeout) → transcription (Deepgram nova-2 → Whisper fallback) → AI description/tags. A per-stage report is merged into `metadata.processing`; failures never cascade.

**State management:**
- Server state is Postgres. Client state is a single Zustand store, `src/stores/agency-store.ts`, persisted to `nrs-agency` in localStorage (`activeBrandId`, `activeAgentType`, `activeConversationId`, `activeView`, `sidebarOpen`, transient `pendingReviewMessage`). Changing brand resets the agent to `overall` and clears the conversation.

## Key Abstractions

**AgentWorker (`src/lib/agents/worker.ts`):**
- Purpose: one independent department execution.
- Contract: `runAgentWorker(agentType, task, ctx: WorkerContext, options: WorkerOptions): Promise<WorkerResult>`; `WorkerResult` carries `result`, `costCents`, `tokensUsed`, `model`, `durationMs`, `toolNames`, optional `error`.
- Pattern: fetch-config → budget-gate → memory → tools → `generateText` → record.

**Tool factory (`src/lib/agents/tools/*.ts`):**
- Purpose: a single agent capability.
- Contract: `createXTool(ctx: { supabase, userId, brandId, conversationId, agentRegistryId })` → AI SDK tool with a `zod/v3` schema.
- Assembly: `getToolsForAgent(agentType, ctx)` in `src/lib/agents/tools/index.ts` is the only consumer.

**GatewayModelRoute (`src/lib/ai/model-routing.ts`):**
- Purpose: one auditable source of truth for model choice, fallbacks and cost.
- Contract: `resolveAgentModelRoute({agentType, input, isHealthBrand, registeredModel})` → `{tier, model, fallbacks}`; `estimateGatewayCost(model, usage)` → `{usd, budgetCents, pricingModel, cacheReadTokens, cacheWriteTokens}`.
- Unknown custom registry models are budgeted conservatively as Opus 5.

**Memory namespace:**
- Format `nrs-{brandSlug}-{agentType}`, with `nrs-agency` as the cross-department global namespace. Defined in `src/lib/ruflo/namespaces.ts`, consumed by `src/lib/memory/store.ts` and `src/lib/agents/prompt-builder.ts`.

**McpPrincipal (`src/lib/security/project-access.ts`):**
- Purpose: the unit of MCP authorisation. `listGrantedProjectIds(principal)` is the only legitimate way to enumerate workspaces on an MCP connection.

**Brand proforma (`src/lib/proforma/sections.ts`):**
- 21 fixed section keys with `rag_status` and `review_cadence`; staleness computed against `CADENCE_DAYS`.

## Entry Points

**`src/middleware.ts`** — every request except static assets/images. Refreshes the Supabase session.

**`src/app/api/chat/route.ts`** — web Director. `maxDuration = 300`.

**`src/app/api/mcp/route.ts`** — MCP Streamable HTTP surface for external AI clients.

**`src/app/api/heartbeat/route.ts`** — Vercel Cron every 15 min; autonomous task execution through `runAgentWorker`.

**`src/app/api/cron/publish-posts/route.ts`** — Vercel Cron every 5 min; publishing.

**`src/app/api/cron/daily-intel/route.ts`** — Vercel Cron daily at 20:00; research refresh.

**`src/app/api/webhooks/{mixpost,telegram}/route.ts`, `src/app/api/stripe/webhook/route.ts`** — inbound third-party events.

**`src/app/page.tsx`** — public landing (WaterRippleHero). Do not modify.

## Architectural Constraints

- **Threading:** Single-threaded serverless request handlers. Concurrency is bounded explicitly — `MAX_CONCURRENT_WORKERS = 4` in `src/lib/agents/worker.ts` to stay inside AI Gateway per-user limits.
- **Step limits:** Director `stepCountIs(8)`; workers `stepCountIs(3)`. These are runaway-loop guards, not tuning knobs.
- **Serverless memory:** Media handling must stream, never buffer whole files. `extractFirstFrameFromUrl` in `src/lib/video/ffmpeg-thumbnail.ts` uses fast-seek-before-input so a 500 MB video costs only the bytes up to frame 1.
- **Global state:** Only the persisted Zustand store (client) and in-process turn counters in `src/lib/memory/session-memory.ts` (`recordTurn`, `shouldExtractSessionMemory`) — the latter resets between cold starts by design.
- **Three Supabase clients must not be mixed.** RLS-bearing `server.ts` for user requests; `admin.ts` (service role) only in webhooks, cron and MCP.
- **Schema drift is fatal, silently.** `media_items` has `transcription_status` but **no `status` column** — a PostgREST update containing `status` is rejected in full and drops every other field with it. Always check `src/types/database.ts` before adding fields to an update.
- **Routes are flat.** No route groups anywhere under `src/app/`.
- **Zod dual import.** `zod/v3` for AI SDK tool schemas, plain `zod` elsewhere.
- **Chromium tracing is explicit.** Any new route that runs a rendered-website audit must be added to `outputFileTracingIncludes` in `next.config.ts` or the Brotli browser pack will be missing at runtime.

## Anti-Patterns

### Direct provider SDK calls in the agent path

**What happens:** Importing `@ai-sdk/anthropic` and constructing a model directly inside a tool or route.
**Why it's wrong:** Bypasses the AI Gateway, so fallbacks, cost accounting (`ai_usage`), tag/user attribution and zero-data-retention for health brands are all lost.
**Do this instead:** `gateway(resolveAgentModelRoute(...).model)` with `getGatewayRouteProviderOptions(...)`, exactly as in `src/app/api/chat/route.ts`.

### Prompt-switching instead of spawning a worker

**What happens:** Appending "now act as the SEO department" to the Director's system prompt.
**Why it's wrong:** No independent memory namespace, no per-department budget, no separate audit row, and the department's own tool set is never assembled.
**Do this instead:** `delegate_to_agent` / `convene_meeting`, which route through `runAgentWorker` in `src/lib/agents/worker.ts`.

### Exposing an orchestration tool on MCP

**What happens:** A new multi-step or content-writing tool is added to `src/lib/agents/tools/` and is auto-exposed by `adaptToolsForMCP`.
**Why it's wrong:** Plug-in AIs would write marketing copy directly, bypassing the Director, brand voice, compliance filtering and the Review queue.
**Do this instead:** Add its name to `HIDDEN_FROM_MCP` in `src/lib/mcp/server.ts` and document the `chat_with_director` equivalent in the `quick_start` prompt. Only read-only queries and bounded single-shot actions stay exposed.

### A second media-processing path

**What happens:** A route writes thumbnails, transcription or tags onto `media_items` itself.
**Why it's wrong:** Duplicate writers clobber the merged `metadata.processing` report and re-trigger multi-minute transcodes.
**Do this instead:** Call `runMediaProcessingPipeline` in `src/lib/media/process-pipeline.ts`. It is the only permitted writer.

### Asking the user to open DevTools

**What happens:** A client-side hang is diagnosed by asking for a Network-tab screenshot.
**Why it's wrong:** The product's user is explicitly non-technical; this is a hard product rule, not a preference.
**Do this instead:** Instrument the client to POST breadcrumbs to `src/app/api/debug/upload-log/route.ts` (pattern in `src/components/agency/MediaUploader.tsx`) and read them with `scripts/read-upload-trace.mjs`.

### Publishing without in-conversation approval

**What happens:** The Director calls `publish_to_social` because the user said "publish X" earlier in the session.
**Why it's wrong:** Earlier intent is not approval of the final content; the drafts-first rule is a trust boundary.
**Do this instead:** Show the exact payload, ask, wait for an affirmative in the user's most recent message. Drafts via `draft_post` need no approval — they land in the Review queue.

## Error Handling

**Strategy:** Fail visibly at the HTTP boundary with a user-facing message; fail soft and non-cascading inside background work.

**Patterns:**
- Route errors return JSON `{ error, friendlyMessage, details? }` with the right status — 401 unauthorised, 400 invalid, 404 not found, 429 budget exceeded (`src/app/api/chat/route.ts:48-115`). `friendlyMessage` is written for a non-technical reader.
- Background enrichment (memory extraction, session memory, draft sync) is fired `void`-style with `.catch(console.error)` so it never fails the user's turn.
- Media stages record `{status, error?, duration_ms?}` per stage into `metadata.processing` and continue; one failed stage never blocks the others.
- Worker failures are captured on `WorkerResult.error`; meetings use `Promise.allSettled()` so one department failing does not abort the meeting.
- Publishing failures are logged to `publisher_runs` and re-queued via `src/lib/publishers/retry-queue.ts`.
- Errors typed centrally in `src/lib/errors/`.

## Cross-Cutting Concerns

**Logging:** `console.*` with a bracketed source tag (`[chat]`, `[worker]`) plus durable rows in `audit_log`, `execution_audit`, `ai_usage`, `publisher_runs`.

**Validation:** Zod at every route boundary; Zod (`zod/v3`) on every tool schema.

**Authentication:** Supabase Auth for humans via middleware; `nrs_sk_` keys / OAuth PKCE for machines via `src/lib/auth/api-key.ts`.

**Authorisation:** RLS policies in Postgres are the primary gate (`is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand`), with `src/lib/security/project-access.ts` layered on for MCP principals.

**Cost & budget:** Every model call is priced by `src/lib/ai/model-routing.ts` and charged against `agent_registry` in integer cents. No floating-point money.

**Compliance:** `src/lib/agents/compliance-filter.ts` (Haiku-graded AHPRA/TGA check) runs inside `save_output`; rules in `src/lib/agents/compliance-rules.ts`. Health brands get `zeroDataRetention: true` on the gateway call.

**Memory:** Dual-track — v1 regex (`src/lib/ruflo/memory-extractor.ts`) for immediate common patterns, v2 LLM fact extraction (`src/lib/memory/fact-extractor.ts` → `memoryStoreV2`) for structured durable facts, plus session memory every N turns.

---

*Architecture analysis: 2026-07-28*
