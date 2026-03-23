# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — NOT Turbopack, due to Vercel .rsc compat)
npm run start        # Start production server
npm run lint         # ESLint
```

## What This App Is

**NotRealSmart Agency** — an agentic AI marketing agency platform. Internal tool for the founder's 8 brands, with plans to sell as an agency service.

**Not SaaS.** No Stripe billing for now. One authenticated user. Claude-style chat dashboard where 10 specialised AI agents produce finished marketing deliverables.

**Name:** Not(Artificial) Real(Intelligence) Smart — tongue-in-cheek. The product IS the agency.

**Owner:** Justin Black (NP), Black Health Intelligence Pty Ltd, ABN 23 693 026 112.

### The 8 Brands
1. **Downscale Weight Loss** — telehealth ($45/consult), AHPRA+TGA
2. **DownscaleDerm** — tretinoin prescribing, TGA
3. **TeleCheck** — Medicare telehealth eligibility SaaS
4. **TeleScribe** — AI clinical scribe
5. **NotRealSmart** — this platform
6. **Downscale Diary** — AI health diary via messenger
7. **Scent Sell** — fragrance marketplace
8. **EndorseMe** — NP endorsement app

### The 10 Agent Departments
Content & Copy | SEO | Paid Ads | Strategy & Launch | Email Marketing | Partnerships & Growth | Brand Building | Competitor Intel | Website | Compliance (AHPRA/TGA)

## Architecture

See `docs/ARCHITECTURE.md` for full details.

### Stack
- **Next.js 15.3.3** (NOT 16 — Vercel .rsc file bug)
- **React 19.2+**
- **Tailwind CSS 4** + oklch colours
- **shadcn/ui v4** (base-ui, NOT Radix — use `render` prop, NOT `asChild`)
- **Supabase** (auth, DB, RLS)
- **Vercel AI SDK v6** + Vercel AI Gateway
- **Three.js** (WebGL water ripple hero)
- **zustand** (client state)

### Route Structure (flat — no route groups)
```
/                      → Landing page (water ripple hero)
/login                 → Login
/signup                → Sign up
/forgot-password       → Password reset
/auth/callback         → OAuth callback
/agency/               → Dashboard (auth guarded in layout)
/agency/chat           → New conversation
/agency/chat/[id]      → Existing conversation
/agency/brands         → Brand management
/agency/brands/[slug]  → Brand editor
/agency/outputs        → Output library
/api/chat              → Streaming chat (Claude via AI Gateway)
/api/conversations     → CRUD
/api/brands            → CRUD
/api/outputs           → Read
```

### How Agents Work
Each agent = system prompt assembly + tool set, streamed via `streamText()`.

```
User → ChatInterface (useChat) → /api/chat → prompt-builder → AI Gateway → Claude → stream
                                     ↕
                              Supabase (brands, conversations, messages, outputs)
```

### AI SDK v6 Patterns (CRITICAL)
- `import { useChat } from '@ai-sdk/react'`
- Transport: `new DefaultChatTransport({ api, body })`
- Messages: `UIMessage` with `parts[]`, not `content` string
- Response: `result.toUIMessageStreamResponse()`
- Messages conversion: `await convertToModelMessages(messages)`
- Steps: `stopWhen: stepCountIs(5)`, not `maxSteps`
- Usage: `usage.inputTokens` / `usage.outputTokens`
- Tool definitions: `inputSchema`, not `parameters`
- Zod: must use `zod/v3` for tool schemas (v4 types incompatible)
- Model: `gateway('anthropic/claude-sonnet-4')` from `@ai-sdk/gateway`

### Vercel AI Gateway
Auto-injected on deployment. For local dev: `vercel env pull`. Never manually configure AI keys.

### Three Supabase Clients (don't mix)
- `lib/supabase/client.ts` — browser
- `lib/supabase/server.ts` — RSC + API routes
- `lib/supabase/admin.ts` — service role (webhooks only)

### Water Ripple Hero
Three.js WebGL with two-pass GLSL shader pipeline extracted from vararohaperfumery.com:
- **Simulation shader**: wave equation (delta=1.4), boundary conditions, cursor pressure injection, gradient calculation
- **Render shader**: UV distortion (0.3), 9-point blur, specular highlights via normal mapping
- Background loaded via canvas cover-fit
- Mobile: static fallback (no WebGL)

## Database

Supabase: `https://uyhtrwlotoriblicqqrl.supabase.co`

Key tables: `brands`, `conversations`, `messages`, `outputs`, `agent_configs`, `users`, `ai_usage`

RLS on all tables. Service role bypass for webhooks only.

## Critical Gotchas

- **Next.js 15, NOT 16** — 16 has .rsc file bug on Vercel
- **No route groups** — flattened to avoid Vercel static generation issues
- **`force-dynamic`** on all pages using base-ui components (prerender fails)
- **`render` prop**, NOT `asChild` for base-ui composition
- **oklch colours only** in globals.css
- **Australian English** throughout
- **error.tsx / not-found.tsx / global-error.tsx** must NOT import base-ui
- **No Microsoft Clarity** for healthcare sites
- **AHPRA/TGA compliance** — no testimonials, no drug names in consumer content, penalties $60K/$120K
