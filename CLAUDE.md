# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (default port 3000)
npm run build        # Production build (Turbopack)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9, next/core-web-vitals + next/typescript)
```

## What This App Is

**NotRealSmart Agency** — an agentic AI marketing agency platform. Claude-style dashboard where 10 specialised AI agents produce finished marketing deliverables across 8 brands.

**This is NOT SaaS.** Internal tool for the founder's businesses first. Agency offering later if it proves out. No Stripe billing for MVP.

**Name:** Not(Artificial) Real(Intelligence) Smart — tongue-in-cheek. The product IS the agency platform.

**Owner:** Justin Black (NP), Black Health Intelligence Pty Ltd, ABN 23 693 026 112.

### The 8 Brands
1. **Downscale Weight Loss** — telehealth weight loss ($45/consult), AHPRA+TGA
2. **DownscaleDerm** — telehealth tretinoin prescribing, TGA
3. **TeleCheck** — Medicare telehealth eligibility SaaS
4. **TeleScribe** — AI clinical documentation tool
5. **NotRealSmart** — this platform
6. **Downscale Diary** — agentic AI health diary via messenger
7. **Scent Sell** — second-hand fragrance marketplace
8. **EndorseMe** — NP endorsement pathway app

### The 10 Agent Departments
Content & Copy | SEO | Paid Ads | Strategy & Launch | Email Marketing | Partnerships & Growth | Brand Building | Competitor Intel | Website | Compliance (AHPRA/TGA)

## Architecture

### How Agents Work
Each agent = **system prompt assembly** + **tool set**, streamed via Vercel AI SDK v6's `streamText()`. No separate services, no MCP.

```
User → ChatInterface (useChat) → /api/chat → prompt-builder → Vercel AI Gateway → Claude → stream back
                                     ↕
                              Supabase (brands, conversations, messages, outputs)
```

**Prompt assembly** (server-side, `lib/agents/prompt-builder.ts`):
1. Base agency rules (Australian English, markdown, deliverable formatting)
2. Brand context from `brands` table (tone, audience, competitors, pillars)
3. Agent instructions from `agent_configs` table
4. Compliance layer (AHPRA/TGA) — only injected if `brand.compliance_flags.ahpra` or `.tga` is true

### Route Structure
- `(auth)/` — login, signup, forgot-password. Centred form layout.
- `(dashboard)/` — auth guarded at layout RSC level. Wraps agency routes.
- `(dashboard)/agency/` — the main app. Three-column: AgentSidebar | ConversationList | Chat.
- `api/chat/` — streaming chat endpoint (POST).
- `api/conversations/` — CRUD for conversations.
- `api/brands/` — CRUD for brands.
- `api/outputs/` — saved deliverables.

### Three Supabase Clients (don't mix them)
- **`lib/supabase/client.ts`** — browser. Used in AuthProvider and client components.
- **`lib/supabase/server.ts`** — server (RSC + API routes). Reads cookies via `next/headers`.
- **`lib/supabase/admin.ts`** — service role. Webhooks only. Never expose.

### AI SDK v6 Patterns (CRITICAL)
This project uses AI SDK v6 (`ai@6.x`). These patterns differ from v5:

- **useChat**: `import { useChat } from '@ai-sdk/react'` — NOT `ai/react`
- **Transport**: `new DefaultChatTransport({ api, body })` — NOT `api` option directly
- **Messages**: `UIMessage` type with `parts` array — NOT `content` string
- **Chat API response**: `result.toUIMessageStreamResponse()` — NOT `toDataStreamResponse()`
- **Message conversion**: `await convertToModelMessages(uiMessages)` (async)
- **Step control**: `stopWhen: stepCountIs(5)` — NOT `maxSteps: 5`
- **Usage tracking**: `usage.inputTokens` / `usage.outputTokens`
- **Tool definitions**: Use `inputSchema` — NOT `parameters`
- **Zod for tools**: Must use `zod/v3` (v4 types incompatible with `tool()`)
- **AI Gateway**: `gateway('anthropic/claude-sonnet-4')` from `@ai-sdk/gateway` — NOT direct Anthropic

### Vercel AI Gateway
AI Gateway is attached to all Vercel projects. `AI_GATEWAY_API_KEY` is auto-injected on deployment. For local dev, use `vercel env pull`. Never manually configure AI keys.

### Middleware
`src/middleware.ts` → calls `updateSession()` from `lib/supabase/middleware.ts`. Refreshes auth session on every request. Unauthenticated `/agency/*` access redirects to login.

### State Management
Zustand store at `src/stores/agency-store.ts`:
- `activeBrandId` — currently selected brand
- `activeAgentType` — currently selected agent department
- `activeConversationId` — current chat thread
- Persisted to localStorage via `zustand/persist`

## Database

Supabase (Seoul, ap-northeast-2): `https://uyhtrwlotoriblicqqrl.supabase.co`

Migrations in `supabase/migrations/`:
- `001_initial_schema.sql` — base tables (users, phases, tools, regulations, etc.)
- `002_seed_phases.sql` — legacy phase data
- `003_agency_schema.sql` — agency tables (brands, conversations, messages, outputs, agent_configs)
- `004_seed_brands_and_agents.sql` — 8 brands + 10 agent configs with full system prompts

**Key agency tables:** `brands`, `conversations`, `messages`, `outputs`, `agent_configs`
**RLS on all tables** — own rows only, agent_configs public read, service role bypass for webhooks.

## Critical Gotchas

### shadcn/ui v4 uses base-ui, NOT Radix
Use `render` prop for composition, NOT `asChild`:
```tsx
// CORRECT
<Button render={<Link href="/foo" />}>Click me</Button>

// WRONG — will not compile
<Button asChild><Link href="/foo">Click me</Link></Button>
```

### base-ui prerendering issue
`error.tsx` and `not-found.tsx` must NOT import base-ui components — they render outside providers. Use plain HTML elements. Handled via `experimental.staticGenerationRetryCount: 0` in next.config.ts.

### CSS colours use oklch
All theme colours in `globals.css` use oklch colour space. New colours must use oklch format.

## Key Conventions

- **Australian English** throughout: colour, behaviour, organisation, optimisation, analyse, licence (noun), license (verb), practise (verb), practice (noun)
- **ABN:** 23 693 026 112. **Company:** Black Health Intelligence Pty Ltd
- **Disclaimers required on:** AI output, compliance checks, site footer
- **RLS on all tables** — service role bypass for webhooks only
- **No patient data stored** — only brand profiles and marketing content
- **AHPRA/TGA compliance** — no testimonials, no prescription drug names in consumer content, no guaranteed outcomes
- **No Microsoft Clarity** — banned for healthcare websites
- **AHPRA uses AI to proactively scan websites** (not complaint-driven, from Sep 2025)
- **AI-generated content carries same legal accountability** as manual (from Sep 2025)
- **Penalties:** $60K individual, $120K body corporate per offence
