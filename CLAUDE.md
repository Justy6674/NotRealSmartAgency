# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — NOT Turbopack for Vercel compat)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9)
```

## What This App Is

**NotRealSmart Agency** — a self-owned agentic AI marketing agency platform. 1 Director + 12 department heads run marketing autonomously across 8 brands.

**Name:** Not(Artificial) Real(Intelligence) Smart. **Owner:** Black Health Intelligence Pty Ltd, ABN 23 693 026 112.

**Repo:** `~/NotRealSmartAgency` (NOT `~/notrealsmart` — that's the old repo, superseded).

### The 8 Brands
Downscale Weight Loss (AHPRA+TGA) | DownscaleDerm (TGA) | TeleCheck | TeleScribe | NotRealSmart | Downscale Diary | Scent Sell | EndorseMe (AHPRA)

### 13 Agents (1 Director + 12 Departments)

| Department | Agent Type | Key Tools (all also get create_task, request_approval, handoff_to_department) |
|---|---|---|
| NRS Director | `overall` | delegate_to_agent, convene_meeting, save_output, scan_website, scan_github, scan_social, marketing_audit, browse_page, generate_image, send_email, read_gmail, generate_slides, web_search |
| Content & Copy | `content` | save_output, word_count, generate_image, generate_slides |
| SEO & GEO | `seo` | save_output, word_count, scan_website, browse_page, web_search |
| Paid Ads | `paid_ads` | save_output, word_count, generate_image |
| Strategy & Launch | `strategy` | save_output, browse_page, generate_slides |
| Email Marketing | `email` | save_output, word_count, send_email, read_gmail |
| Growth & Partnerships | `growth` | save_output, word_count, scan_website, send_email, browse_page, read_gmail |
| Brand | `brand` | save_output, generate_image |
| Market Intelligence | `competitor` | save_output, scan_website, browse_page, web_search |
| Web & CRO | `website` | save_output, word_count, scan_website, browse_page, generate_image |
| Compliance | `compliance` | save_output, scan_website, browse_page |
| Analytics & Reporting | `analytics` | save_output, scan_website, browse_page |
| Automation & AI | `automation` | save_output, scan_github, browse_page |

> `martech` exists as an archived agent type for backward compat with old conversations — not shown in UI.

## Architecture

### Agent Execution (AI SDK v6 `streamText`)
Chat route (`/api/chat/route.ts`) uses `streamText()` (NOT ToolLoopAgent — that breaks streaming). Each request:
1. Validates request (brandId, agentType, conversationId)
2. Fetches brand (RLS-protected) + agent config from Supabase
3. Gets/creates agent registry entry, checks budget (`429` if exceeded)
4. Builds system prompt: base rules → user work context → brand context → agent system prompt → compliance rules (if AHPRA/TGA)
5. Retrieves Ruflo memories for context
6. For Director: runs intent router, appends routing hints to system prompt
7. Streams via `gateway('anthropic/claude-sonnet-4')` with fallbacks `['openai/gpt-4.1', 'google/gemini-2.5-flash']`
8. `stopWhen: stepCountIs(5)` — max 5 tool-use steps per turn
9. `onFinish`: records spend, logs to `ai_usage` + `audit_log`, extracts memories

Director delegates to subagents via `delegate_to_agent` tool (uses `generateText()` internally). Web search (Perplexity via AI Gateway) available to Director, SEO, and Market Intelligence.

### Intent Router (`lib/agents/intent-router.ts`)
Rule-based keyword classification that analyses the user's message and suggests which department should handle it. Returns `{ suggestedAgent, confidence, shouldDelegate }`. Injected into Director's system prompt as routing hints — fast and free (no LLM call).

### Heartbeat (Vercel Cron)
`/api/heartbeat` runs every 15 min via Vercel Cron. Processes assigned tasks autonomously. Budget enforcement with auto-pause. Monthly reset on 1st. Uses Fluid Compute (`maxDuration=300`).

### Memory System (Ruflo)
- **Client:** `lib/ruflo/client.ts` — search + store via Ruflo API
- **Namespaces:** `lib/ruflo/namespaces.ts` — `nrs-{brandSlug}-{agentType}` per brand per department, `nrs-agency` for global
- **Extraction:** `lib/ruflo/memory-extractor.ts` — automatically extracts key facts from assistant responses on chat finish
- **Prompt integration:** `lib/agents/prompt-builder.ts` — `buildSystemPromptWithMemory()` searches memories before each chat, injects relevant ones into system prompt
- Also backed by `agent_memories` table in Supabase

### Meeting Room (Multi-Department Collaboration)
When the intent router detects 2+ departments needed, the Director uses `convene_meeting` instead of `delegate_to_agent`. All departments run in parallel via `Promise.allSettled`. Each gets meeting context ("you are in a meeting with X, Y, Z — focus on YOUR expertise"). Results returned as structured meeting output. Auto-saved to output library with `[Meeting]` prefix.

Compound triggers: comprehensive audit, launch plan, campaign, rebrand, growth strategy, content strategy, competitive analysis.

### 10-Action Report Bar (`components/agency/MessageActions.tsx`)
Every substantial assistant message (>100 chars) gets action buttons: Save, Email Me, Send to..., Baseline, Re-analyse, Todo, Copy, Remember, Full View, PDF. APIs: `POST /api/outputs`, `POST /api/email-report`, `POST /api/extract-todos`.

### GitHub Repo Scanning
Add Brand dialog has a scan button. `GET /api/scan-github-quick?url=...` fetches README + package.json + repo metadata. Auto-fills brand name, description, niche, extra_context.

### Client State (Zustand)
Single store `src/stores/agency-store.ts` — `useAgencyStore` persisted to localStorage key `nrs-agency`. Manages: `activeBrandId`, `activeAgentType`, `activeConversationId`, `activeView`, `sidebarOpen`. Changing brand resets agent to `overall` and clears conversation.

### Stack
- **Next.js 15.3** (NOT 16), **React 19**, **Tailwind CSS 4** (oklch only)
- **shadcn/ui v4** (base-ui — use `render` prop, NOT `asChild`)
- **Supabase** (3 clients: browser, server, admin)
- **Vercel AI SDK v6** `streamText` + AI Gateway (auto-injected via `@ai-sdk/gateway`)
- **Stripe** — checkout, portal, webhooks (`lib/stripe/`)
- **Resend** — transactional email
- **GSAP** + **Motion** (Framer Motion) — animations (landing page, about page)
- **IBM Plex Sans + Mono**, **lucide-react** icons
- **zustand** (client state), **Zod v4** (`zod/v3` import for AI SDK tool schemas)

### Route Structure (flat — no route groups)
```
/                              → Landing page (water ripple hero — DO NOT TOUCH)
/about                         → Space hero + terminal FAQ
/pricing                       → Coming Soon
/faq                           → FAQ page
/privacy, /terms               → Legal pages
/login, /signup, /forgot-password → Auth pages
/agency                        → Agency dashboard redirect
/agency/chat                   → Main chat interface (new conversation)
/agency/chat/[conversationId]  → Existing conversation
/agency/tasks                  → Task board
/agency/agents                 → Org chart + budgets
/agency/approvals              → Approval queue
/agency/costs                  → Cost dashboard
/agency/brands                 → Brand list
/agency/brands/[brandSlug]     → Brand profile editor
/agency/outputs                → Output library
/agency/activity               → Activity feed
/api/chat                      → streamText streaming endpoint
/api/heartbeat                 → Cron endpoint
/api/agents, tasks, goals, approvals, audit, conversations, outputs, brands → CRUD routes
/api/stripe/checkout, portal, webhook → Stripe integration
```

### Database Tables
```
users, brands, conversations, messages, outputs, agent_configs,
agent_registry, agent_memories, goals, tasks, audit_log,
approval_queue, heartbeats, project_scans, ai_usage
```

### Three Supabase Clients (don't mix)
- `lib/supabase/client.ts` — browser
- `lib/supabase/server.ts` — server (RSC, API routes)
- `lib/supabase/admin.ts` — service role (webhooks, heartbeat)

### Tool Implementation Pattern
All tools in `lib/agents/tools/`. Factory functions take context (supabase, userId, brandId) and return AI SDK tool objects with Zod schemas. Tool index (`tools/index.ts`) assembles per-agent tool sets. Management tools (`create_task`, `request_approval`, `handoff_to_department`) are shared across all agents.

## Critical Gotchas

- **NEVER touch the homepage** (`src/app/page.tsx`, WaterRippleHero)
- **NEVER use Three.js** for new features — use CSS/SVG/Canvas 2D only (Three.js exists only for the landing/about heroes)
- **Test locally before pushing** (`npm run dev` + check in browser)
- **Correct repo is `~/NotRealSmartAgency`** — NOT `~/notrealsmart`
- **No route groups** — flat routes only
- **`force-dynamic`** on pages with base-ui components
- **`render` prop** not `asChild` for base-ui composition
- **oklch colours only** (silver/chrome palette, hue ~240)
- **Australian English** throughout (colour, behaviour, organisation)
- **AI Gateway** auto-injected — never configure manually
- **AHPRA/TGA compliance** — $60K/$120K penalties per offence
- **Trigger function is `update_updated_at()`** not `update_updated_at_column()`
- **Supabase creds in `.env.local`** — never ask for them, just use them
- **DB password:** `IloveBB0307$$`
- **streamText works, ToolLoopAgent breaks** — never switch to ToolLoopAgent for chat

## Key Conventions

- **Budget in cents** (integer, no floating point)
- **Audit log is append-only** — no UPDATE/DELETE policies
- **Agent configs = templates** (system prompts, tool lists, stored in `agent_configs` table)
- **Agent registry = runtime state** (status, budget, model, org chart — per user, stored in `agent_registry` table)
- **Zod v3** import path for AI SDK tool schemas (`import { z } from 'zod/v3'`)
- **IBM Plex** font, **silver/chrome** palette
- **Default model:** `anthropic/claude-sonnet-4` (overridable per agent in registry)
- **Cost calculation:** `(inputTokens * 0.3 + outputTokens * 1.5) / 100` → cents
- **Types:** all in `src/types/database.ts` — `AgentType`, `Brand`, `AgentConfig`, `Task`, `Goal`, etc.
