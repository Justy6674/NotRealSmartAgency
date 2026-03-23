# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — Turbopack has Vercel .rsc bug on Next.js 16, so we pin 15.3.3)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9, next/core-web-vitals + next/typescript)
```

## What This App Is

**NotRealSmart Agency** — an agentic AI marketing agency platform. Internal tool for the founder's 8 brands, with plans to sell as an agency service.

Not SaaS. No Stripe billing for now. One authenticated user. Claude-style chat dashboard where 10 specialised AI agents produce finished marketing deliverables.

**Name:** Not(Artificial) Real(Intelligence) Smart. **Owner:** Black Health Intelligence Pty Ltd, ABN 23 693 026 112.

### The 8 Brands
Downscale Weight Loss (AHPRA+TGA) | DownscaleDerm (TGA) | TeleCheck | TeleScribe | NotRealSmart | Downscale Diary | Scent Sell | EndorseMe (AHPRA)

### The 10 Agent Departments
Content & Copy | SEO | Paid Ads | Strategy & Launch | Email Marketing | Partnerships & Growth | Brand Building | Competitor Intel | Website | Compliance (AHPRA/TGA)

## Architecture

See `docs/ARCHITECTURE.md` for full system diagrams, shader pipeline, styling guide, and file structure.

### Stack
- **Next.js 15.3.3** (NOT 16 — Vercel .rsc file bug with Turbopack)
- **React 19.2+**, **Tailwind CSS 4** (oklch colours only)
- **shadcn/ui v4** (base-ui, NOT Radix — use `render` prop, NOT `asChild`)
- **Supabase** (auth, PostgreSQL, RLS) — 3 clients: browser, server, admin
- **Vercel AI SDK v6** + **Vercel AI Gateway** (auto-injected, never configure manually)
- **Three.js** (WebGL water ripple hero — GLSL shaders extracted from vararohaperfumery.com)
- **zustand** (client state: activeBrandId, activeAgentType, activeConversationId)
- **IBM Plex Sans + Mono** (via next/font/google)

### Route Structure (flat — no route groups)
```
/                        → Landing page (hero only, water ripple + frosted glass panel)
/about                   → Coming Soon
/pricing                 → Coming Soon
/faq                     → Coming Soon
/login, /signup          → Auth pages (force-dynamic)
/forgot-password         → Password reset (force-dynamic)
/auth/callback           → OAuth callback
/agency/                 → Dashboard (auth guarded in layout RSC)
/agency/chat             → New conversation
/agency/chat/[id]        → Existing conversation
/agency/brands           → Brand management (force-dynamic)
/agency/brands/[slug]    → Brand editor
/agency/outputs          → Output library (force-dynamic)
/api/chat                → Streaming chat (POST, Claude via AI Gateway)
/api/conversations       → GET/POST
/api/brands              → GET/POST/PATCH
/api/outputs             → GET
```

### How Agents Work
Each agent = system prompt assembly + tool set, streamed via `streamText()`.

```
User → ChatInterface (useChat) → /api/chat → prompt-builder → AI Gateway → Claude → stream
                                     ↕
                              Supabase (brands, conversations, messages, outputs)
```

Prompt assembly (`lib/agents/prompt-builder.ts`): base rules + brand context + agent instructions + compliance layer (conditional on `brand.compliance_flags`).

### AI SDK v6 Patterns (CRITICAL — differs from v5)
- `import { useChat } from '@ai-sdk/react'` — NOT `ai/react`
- Transport: `new DefaultChatTransport({ api, body })` — NOT `api` option
- Messages: `UIMessage` with `parts[]` — NOT `content` string
- Response: `result.toUIMessageStreamResponse()` — NOT `toDataStreamResponse()`
- Message conversion: `await convertToModelMessages(messages)` — async
- Steps: `stopWhen: stepCountIs(5)` — NOT `maxSteps`
- Usage: `usage.inputTokens` / `usage.outputTokens` — NOT `promptTokens`
- Tool definitions: `inputSchema` — NOT `parameters`
- Zod: must use `zod/v3` for tool schemas (v4 types incompatible with `tool()`)
- Model: `gateway('anthropic/claude-sonnet-4')` from `@ai-sdk/gateway`

### Three Supabase Clients (don't mix)
- `lib/supabase/client.ts` — browser (AuthProvider, client components)
- `lib/supabase/server.ts` — server (RSC, API routes, reads cookies)
- `lib/supabase/admin.ts` — service role (Stripe webhook only, never expose)

### Water Ripple Hero
Three.js WebGL with two-pass GLSL shader pipeline:
- **Simulation**: wave equation (delta=1.4), boundary conditions, cursor pressure (radius 0.0275), gradients
- **Render**: UV distortion (0.3), 9-point blur, specular highlights via normal mapping
- Background loaded via canvas cover-fit. Mobile: static fallback (no WebGL).
- Dynamically imported via client wrapper (`WaterRippleHeroLoader.tsx`, `ssr: false`).
- Hero text sits in a frosted glass panel (`backdrop-blur(20px)`) over the canvas.

## Database

Supabase: `https://uyhtrwlotoriblicqqrl.supabase.co`

Key tables: `brands`, `conversations`, `messages`, `outputs`, `agent_configs`, `users`, `ai_usage`

Migrations in `supabase/migrations/` (001–004). RLS on all tables. Service role bypass for webhooks only.

## Critical Gotchas

- **Next.js 15, NOT 16** — 16 has .rsc file bug on Vercel regardless of bundler
- **No route groups** — flattened to avoid Vercel static generation ENOENT errors
- **`export const dynamic = 'force-dynamic'`** on all pages importing base-ui components (prerender crashes)
- **`render` prop**, NOT `asChild` for base-ui/shadcn composition
- **oklch colours only** in globals.css and inline styles
- **Australian English** throughout (colour, behaviour, organisation, analyse, licence/license, practise/practice)
- **IBM Plex** font family (not Geist)
- **Silver/chrome metallic** palette (oklch hue ~240), NOT warm brown/gold
- **error.tsx / not-found.tsx / global-error.tsx** must NOT import base-ui components
- **AI Gateway** auto-injected by Vercel — never manually set AI keys, use `vercel env pull` for local dev
- **No Microsoft Clarity** for healthcare websites (their terms prohibit it)
- **AHPRA/TGA compliance** — no testimonials, no drug names in consumer content, penalties $60K/$120K per offence
