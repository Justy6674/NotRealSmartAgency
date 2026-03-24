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

| Department | Agent Type | Tools |
|---|---|---|
| NRS Director | `overall` | delegate, scan_website, scan_github, scan_social, marketing_audit, create_task, request_approval, save_output |
| Content & Copy | `content` | save_output, word_count, create_task, request_approval |
| SEO & GEO | `seo` | save_output, word_count, scan_website, create_task, request_approval |
| Paid Ads | `paid_ads` | save_output, word_count, create_task, request_approval |
| Strategy & Launch | `strategy` | save_output, create_task, request_approval |
| Email Marketing | `email` | save_output, word_count, create_task, request_approval |
| Growth & Partnerships | `growth` | save_output, word_count, scan_website, create_task, request_approval |
| Brand | `brand` | save_output, create_task, request_approval |
| Market Intelligence | `competitor` | save_output, scan_website, create_task, request_approval |
| Web & CRO | `website` | save_output, word_count, scan_website, create_task, request_approval |
| Compliance | `compliance` | save_output, scan_website, create_task, request_approval |
| Analytics & Reporting | `analytics` | save_output, scan_website, create_task, request_approval |
| Automation & AI | `automation` | save_output, scan_github, create_task, request_approval |

## Architecture

### Agent Execution (AI SDK 6 ToolLoopAgent)
Chat route creates a `ToolLoopAgent` per request with agent config, brand context, and memory. Director delegates to subagents via `generateText()`. Budget checked via `prepareStep`, cost recorded in `onFinish`. Every action logged to `audit_log`.

### Heartbeat (Vercel Cron)
`/api/heartbeat` runs every 15 min via Vercel Cron. Processes assigned tasks autonomously. Budget enforcement with auto-pause. Monthly reset on 1st. Uses Fluid Compute (`maxDuration=300`).

### Memory System
- Namespace: `nrs-{brandSlug}-{agentType}` per brand per department
- Stored in `agent_memories` table (Supabase)
- Retrieved before each chat, stored after each response
- Director also searches global namespace `nrs-agency`

### Stack
- **Next.js 15.3** (NOT 16), **React 19**, **Tailwind CSS 4** (oklch only)
- **shadcn/ui v4** (base-ui — use `render` prop, NOT `asChild`)
- **Supabase** (3 clients: browser, server, admin)
- **Vercel AI SDK v6** ToolLoopAgent + AI Gateway (auto-injected)
- **IBM Plex Sans + Mono**
- **zustand** (client state)

### Route Structure (flat — no route groups)
```
/                        → Landing page (water ripple hero — DO NOT TOUCH)
/about                   → Space hero + terminal FAQ
/pricing                 → Coming Soon
/login, /signup          → Auth pages
/agency/chat             → Main chat interface
/agency/tasks            → Task board
/agency/agents           → Org chart + budgets
/agency/approvals        → Approval queue
/agency/costs            → Cost dashboard
/agency/brands           → Brand management
/agency/outputs          → Output library
/api/chat                → ToolLoopAgent streaming
/api/heartbeat           → Cron endpoint
/api/agents, tasks, goals, approvals, audit → CRUD routes
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

## Critical Gotchas

- **NEVER touch the homepage** (`src/app/page.tsx`, WaterRippleHero)
- **NEVER use Three.js** for new features — use CSS/SVG/Canvas 2D only
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

## Key Conventions

- **Budget in cents** (integer, no floating point)
- **Audit log is append-only** — no UPDATE/DELETE policies
- **Agent configs = templates** (system prompts, tool lists)
- **Agent registry = runtime state** (status, budget, org chart per user)
- **Zod v3** for AI SDK tool schemas (`zod/v3` import)
- **IBM Plex** font, **silver/chrome** palette
