# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Before claiming a feature is done: `npm test`, `npm run lint`, and `npm run build` must all pass.

## The two hard product rules

These override normal engineering instinct, so read them before designing anything.

1. **The user is a non-technical business owner.** Conversation-first, never form-first. If data is missing, the Director asks in chat. Plain language, never department names or plumbing (the user does not know what Mixpost or OAuth are).
2. **The Director is the only face.** Thirteen departments exist and are invisible. External AI clients (Claude Desktop, Cowork, Codex) are *messengers* — they hand intent to `chat_with_director` and wait. They never write marketing copy or orchestrate directly.

## Architecture

### Agent execution — two entry points, one worker

`streamText` from AI SDK v6 everywhere. **Never `ToolLoopAgent`** — it breaks in this codebase.

- **`POST /api/chat`** (`src/app/api/chat/route.ts`, 524 lines) is the Director. Per request: validate → fetch brand + agent config (RLS) → `getOrCreateAgentRegistry` + `checkBudget` (429 if over) → `buildSystemPromptWithMemory` → intent-router hints → stream → `onFinish` records spend to `ai_usage` + `audit_log` and extracts memories. `stopWhen: stepCountIs(5)`. `maxDuration = 300` (Fluid Compute).
- **`runAgentWorker`** (`src/lib/agents/worker.ts`) is every department. Own model, own memory namespace, own tool set, own budget, own audit row, `stepCountIs(3)`, max 4 concurrent (`MAX_CONCURRENT_WORKERS`).
- The Director reaches workers via `delegate_to_agent` (one) or `convene_meeting` (2–6 in parallel, `Promise.allSettled`). `/api/heartbeat` uses the same worker so cron and chat behave identically.

### Model routing — one source of truth

`src/lib/ai/model-routing.ts` owns every model choice. Four tiers (`fast`/`agency`/`frontier`/`code`) with explicit fallback chains. Departments map to a tier only when there is a real reason; everything else falls through to `agency`. It is a list of exceptions, not a config file to fill in.

Model IDs and prices in that file were read from `GET https://ai-gateway.vercel.sh/v1/models` on 2026-08-09, not recalled. If you change a model ID, check the live catalogue — do not write one from memory. AI Gateway credentials are auto-injected on Vercel; never configure a provider manually.

### Gates — regulatory checks live at the exits, not in the callers

Four of the brands advertise regulated health services (AHPRA/TGA, up to $60K per offence). Two chokepoints enforce this so a new code path cannot skip it:

- `src/lib/agents/publish-gate.ts` — every publishing route passes through it. Previously only the Mixpost tool checked, so scheduling or direct-publishing reached live accounts unreviewed.
- `src/lib/agents/save-gate.ts` — the outputs library is not passive storage; `query_outputs` is given to every department, so anything saved becomes something later work imitates. Failed content must not be written down.

Add a new publisher or a new save path → route it through the existing gate; do not re-implement the check.

### Canonical pipelines — one function owns each write

Three places where "just insert the row" is the bug:

- **Drafts** — `src/lib/posts/create-draft.ts` `createDraftPost()`. The one place a draft is born: insert *and* Mixpost push together. Never raw-insert `scheduled_posts`. It returns a `mixpost` field of `synced` / `pending` / `failed` — **relay that honestly**; `pending` is not done.
- **Media** — `src/lib/media/process-pipeline.ts` `runMediaProcessingPipeline()`. Owns every `media_items` mutation touching thumbnail, transcription or AI tagging. Both the browser route `/api/media/process` and the Director's `process_media` tool delegate to it.
- **MCP exposure** — `src/lib/mcp/server.ts` `HIDDEN_FROM_MCP`. Hidden tools are never registered on the MCP surface; they exist only inside the Director's internal loop. A new tool that is multi-step or writes marketing copy goes in that set. Query-only or bounded single-shot tools need no action.

### Memory

Three layers, all on Supabase + pgvector: individual facts (`agent_memories`, semantic search, >0.85 cosine = update not insert), a compounding per-brand session record, and a cross-department global namespace (`nrs-agency`). Namespaces are `nrs-{brandSlug}-{agentType}`.

`agent_memories.value` is a **TEXT** column — reads return a string. Always go through `parseMemoryValue()` (`src/lib/memory/memory-value.ts`). Casting it straight to an object fails silently and has already disabled three features at once.

### Tools

73 files in `src/lib/agents/tools/`. Factory functions take context (`supabase`, `userId`, `brandId`) and return AI SDK tool objects with Zod schemas. `tools/index.ts` assembles the per-agent set via `getToolsForAgent()`. Import Zod as `import { z } from 'zod/v3'` for tool schemas — v4 shapes break AI SDK.

A tool's returned string is **read aloud to the owner**, so it may not interpolate a raw error. Log with `console.error`, or pass through `userSafeError()` first. This is enforced by a test (below).

### Data & auth

Three Supabase clients, do not mix: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (RSC + API routes), `lib/supabase/admin.ts` (service role — webhooks, cron). `src/middleware.ts` refreshes the session on every non-static request; all `/agency/*` requires auth. RLS uses three helper functions (`is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand`) rather than per-table policies. Migrations in `supabase/migrations/`, numbered then date-stamped. Types live in `src/types/database.ts` — check it before writing an update.

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

Comments in this codebase carry the incident that motivated the code (see `memory-value.ts`, `create-draft.ts`, `publish-gate.ts`). Match that: explain why the obvious approach was wrong, not what the code does.

## Related docs, and how much to trust them

- `AGENTS.md` (674 lines) — the fullest inventory: all 14 agents and their tools, the 21-section proforma, slash commands, room navigation, Mixpost specifics. **Caveat: it has been through a find/replace of "Claude" → "Codex"**, so it contains corrupted identifiers (`anthropic/Codex-sonnet-4`, `~/.Codex/projects/`). Read it for structure, not for literal strings.
- `README.md` — accurate on intent, stale on versions (says Next 15.3; package.json is 15.5.21) and on the memory system (describes Ruflo as current).
- `docs/ARCHITECTURE.md` — stale model list (`claude-sonnet-4 → gpt-4.1`); `src/lib/ai/model-routing.ts` is authoritative.
- `~/Obsidian/Reference/nrs-*` — the definitive specs for Creative Studio, the media pipeline, MCP architecture and Mixpost webhooks. Read the Creative Studio spec before touching Creator / Review / Schedule / Media.

When code and prose disagree, the code wins.
