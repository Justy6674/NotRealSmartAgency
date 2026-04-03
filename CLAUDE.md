# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## First Principle — Read This Before Every Build

**The user of this app is a non-technical business owner trying to be their own marketing agency.** They are not a developer. They do not know what "SEO & GEO" means. They cannot write JSON. They should never have to.

Every feature, every screen, every interaction must follow this rule:

> **The LLM drives tomorrow's complexity. The user just talks.**

- **Conversation-first, not form-first.** If data is missing, the agent asks for it in chat — never show a blank form and expect the user to fill it.
- **One obvious action per screen.** Not 14 sidebar options. Not 5 tabs. One thing to do next.
- **Auto-fill everything possible.** Scan the website, sync GitHub, guess social handles — without being asked.
- **Plain language, not jargon.** "Get more customers" not "Growth & Partnerships". "Make me a video" not "Generate video script output".
- **Minimum clicks to value.** If the user says "make me a TikTok video", the agent should write the script AND trigger generation — not make them navigate to Outputs and click a button.
- **The agent should know what to do.** Show what it already knows about the brand. Suggest what to do next. Don't wait to be asked.

This is the founding design principle. Every PR, every feature, every refactor must be evaluated against it.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — NOT Turbopack for Vercel compat)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9)
```

## What This App Is

**NotRealSmart Agency** — a self-owned agentic AI marketing agency platform. 1 Director + 13 department heads run marketing autonomously across 8 brands.

**Name:** Not(Artificial) Real(Intelligence) Smart. **Owner:** Black Health Intelligence Pty Ltd, ABN 23 693 026 112.

**Repo:** `~/NotRealSmartAgency` (NOT `~/notrealsmart` — that's the old repo, superseded).

### The 8 Brands
Downscale Weight Loss (AHPRA+TGA) | DownscaleDerm (TGA) | TeleCheck | TeleScribe | NotRealSmart | Downscale Diary | Scent Sell | EndorseMe (AHPRA)

### 14 Agents (1 Director + 13 Departments)

| Department | Agent Type | Key Tools (all also get create_task, request_approval, handoff_to_department, query_outputs) |
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
| Video & Scripting | `video` | save_output, word_count |

> `martech` exists as an archived agent type for backward compat with old conversations — not shown in UI.
> All agents get `query_outputs` for cross-agent learning (search past work from any department).

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

### Memory System (Ruflo — pending replacement with mem0)
- **Client:** `lib/ruflo/client.ts` — search + store via Supabase `agent_memories` table
- **Namespaces:** `lib/ruflo/namespaces.ts` — `nrs-{brandSlug}-{agentType}` per brand per department, `nrs-agency` for global
- **Extraction:** `lib/ruflo/memory-extractor.ts` — regex-based extraction of preferences, decisions, metrics from responses
- **Prompt integration:** `lib/agents/prompt-builder.ts` — `buildSystemPromptWithMemory()` searches memories before each chat, injects up to 15 (10 local + 5 global)
- **Known limitations:** Keyword search only (no semantic), regex extraction misses ~40-60% of insights, no deduplication, no importance scoring, no memory decay
- **Planned replacement:** mem0 self-hosted on Supabase pgvector — LLM-based fact extraction, semantic vector search, memory consolidation, graph relationships. See `project_memory_architecture.md` in memory files.

### Planned Major Builds (next sessions)
1. **mem0 memory system** — replace Ruflo with semantic search, LLM extraction, graph memory
2. **Director auto-greet** — conversation-first onboarding for incomplete brands
3. **Self-updating knowledge** — daily research cron, agents stay current with AI/marketing trends

### Meeting Room (Multi-Department Collaboration)
When the intent router detects 2+ departments needed, the Director uses `convene_meeting` instead of `delegate_to_agent`. All departments run in parallel via `Promise.allSettled`. Each gets meeting context ("you are in a meeting with X, Y, Z — focus on YOUR expertise"). Results returned as structured meeting output. Auto-saved to output library with `[Meeting]` prefix.

Compound triggers: comprehensive audit, launch plan, campaign, rebrand, growth strategy, content strategy, competitive analysis, video campaign, review my brand.

### 10-Action Report Bar (`components/agency/MessageActions.tsx`)
Every substantial assistant message (>100 chars) gets action buttons: Save, Email Me, Send to..., Baseline, Re-analyse, Todo, Copy, Remember, Full View, PDF. APIs: `POST /api/outputs`, `POST /api/email-report`, `POST /api/extract-todos`.

### GitHub Repo Scanning
Add Brand dialog has a scan button. `GET /api/scan-github-quick?url=...` fetches README + package.json + repo metadata. Auto-fills brand name, description, niche, extra_context.

### Video Generation Pipeline
Video agent writes platform-specific scripts (Reels, TikTok, YouTube, LinkedIn). Scripts saved as `video_script` output type with AHPRA/TGA compliance check. OutputCard has "Generate Video (HeyGen)" button → calls `/api/video/generate` → creates `video` output with player. Status polling via `/api/video/status`. Provider API keys managed in Brand Settings → Video tab via `/api/integrations`.

### "Review My Brand" Flow
Brand cards have "Review Brand" button → `POST /api/brands/{brandId}/review` runs website + GitHub + social scans in parallel → builds structured message → stores in Zustand `pendingReviewMessage` → redirects to Director chat → ChatInterface auto-sends → triggers 6-department meeting (competitor, SEO, content, analytics, compliance, website).

### Compliance Filter
`lib/agents/compliance-filter.ts` — uses Claude Haiku to evaluate content against AHPRA/TGA rules before saving outputs. Returns `{ isValid, flags, warnings }`. Runs automatically in `save_output` tool.

### Social Media Knowledge
`lib/agents/knowledge/social-media-benchmarks.ts` — platform benchmarks (engagement rates, CTR, CPC, video specs, posting times). Injected into agent prompts filtered by agent type (video gets video specs, analytics gets all formulas, etc.).

### Cross-Agent Learning
`query_outputs` tool (all agents) — search past outputs from any department. Memory extractor captures social metrics. Cross-department memories stored to `nrs-agency` global namespace.

### Client State (Zustand)
Single store `src/stores/agency-store.ts` — `useAgencyStore` persisted to localStorage key `nrs-agency`. Manages: `activeBrandId`, `activeAgentType`, `activeConversationId`, `activeView`, `sidebarOpen`, `pendingReviewMessage` (transient). Changing brand resets agent to `overall` and clears conversation.

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
/agency/media                  → Media library (upload, transcribe, generate captions)
/agency/activity               → Activity feed
/api/chat                      → streamText streaming endpoint
/api/heartbeat                 → Cron endpoint
/api/agents, tasks, goals, approvals, audit, conversations, outputs, brands → CRUD routes
/api/brands/[brandId]/review         → One-click brand audit (scans + Director chat)
/api/video/generate                  → Submit video generation job (HeyGen)
/api/video/status                    → Poll video generation status
/api/integrations                    → GET/POST provider API keys
/api/github/sync                     → Sync GitHub context to brand
/api/media/upload                    → Upload video/audio to Supabase Storage
/api/media/transcribe                → Deepgram/Whisper transcription
/api/media/[mediaItemId]/generate    → AI generates 6 platform captions
/api/media                           → GET/DELETE media items
/api/cron/publish-posts              → Cron: publish scheduled posts via Ayrshare
/api/stripe/checkout, portal, webhook → Stripe integration
```

### Content Automation Machine (CAM)
Upload → Transcribe → Generate → Schedule → Publish pipeline:
- `/agency/media` page with drag & drop batch upload to Supabase Storage `media` bucket
- 2-layer ASR: Deepgram nova-2 → OpenAI Whisper fallback (`lib/transcription/transcribe.ts`)
- AI generates 6 platform-specific captions per video (YouTube, TikTok, Instagram, Facebook, LinkedIn, X)
- `scheduled_posts` table tracks draft → scheduled → publishing → published flow
- Cron publisher (`/api/cron/publish-posts`, every 5 min) via Ayrshare API
- Provider settings: Ayrshare + Deepgram in Brand Settings → Video tab

### Department-Specific Quick Actions
`QuickActions.tsx` shows contextual buttons per department (not generic). 14 sets of 4-6 buttons with conditional AHPRA/TGA compliance prompts, website scan prompts, and GitHub scan prompts based on brand config.

### Database Tables
```
users, brands, conversations, messages, outputs, agent_configs,
agent_registry, agent_memories, goals, tasks, audit_log,
approval_queue, heartbeats, project_scans, ai_usage,
media_items, scheduled_posts
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
