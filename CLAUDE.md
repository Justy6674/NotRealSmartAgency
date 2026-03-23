# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY — Read at Session Start

**Before doing ANYTHING, read these files:**
1. `memory/user.md` — current project state, what works, what's broken
2. `memory/preferences.md` — how the user wants to work, non-negotiable rules
3. `memory/decisions.csv` — past decisions and their reasoning
4. `memory/people.md` — who the user is, what they value

**At session end, update these files** with any new decisions, preferences, or context learned.

## ENFORCEMENT — Non-Negotiable Rules

### Before ANY git push:
1. Run `npm run dev` and verify the change works in a real browser
2. For 3D/WebGL changes: use Playwright headed mode to screenshot localhost
3. If it looks wrong locally, DO NOT PUSH — fix it first or revert to Coming Soon

### Before writing Three.js code:
1. READ the relevant installed skill from `~/.claude/skills/threejs-*`
2. For GLTF models: load first, traverse meshes, log positions, THEN position elements
3. Never build 3D environments from box primitives — use proper models

### When the user says "PLAN":
1. Stop coding immediately
2. Enter plan mode
3. Ask clarifying questions
4. Get approval before proceeding

### When the user is frustrated:
1. Stop patching
2. Acknowledge the failure honestly
3. Save context to memory files
4. Either fix properly or revert

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — NOT Turbopack for Vercel compat)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9)
```

## Decision Logging

Log every significant decision to `memory/decisions.csv` with:
- date, decision, reasoning, expected_outcome, review_date, status

Review decisions older than 30 days when the user asks about past choices.

## What This App Is

**NotRealSmart Agency** — an agentic AI marketing agency platform. Internal tool for the founder's 8 brands, agency service later.

**Name:** Not(Artificial) Real(Intelligence) Smart. **Owner:** Black Health Intelligence Pty Ltd, ABN 23 693 026 112.

### The 8 Brands
Downscale Weight Loss (AHPRA+TGA) | DownscaleDerm (TGA) | TeleCheck | TeleScribe | NotRealSmart | Downscale Diary | Scent Sell | EndorseMe (AHPRA)

### The 10 Agent Departments
Content & Copy | SEO | Paid Ads | Strategy & Launch | Email Marketing | Partnerships & Growth | Brand Building | Competitor Intel | Website | Compliance (AHPRA/TGA)

## Architecture

See `docs/ARCHITECTURE.md` for full system diagrams, shader pipeline, styling guide, and file structure.

### Stack
- **Next.js 15.3.3** (NOT 16 — Vercel .rsc file bug)
- **React 19.2+**, **Tailwind CSS 4** (oklch colours only)
- **shadcn/ui v4** (base-ui, NOT Radix — use `render` prop, NOT `asChild`)
- **Supabase** (auth, PostgreSQL, RLS) — 3 clients: browser, server, admin
- **Vercel AI SDK v6** + **Vercel AI Gateway** (auto-injected, never configure manually)
- **Three.js + R3F + GSAP + Motion** (3D scenes, animations, effects)
- **zustand** (client state)
- **IBM Plex Sans + Mono**

### Installed Three.js Skills (USE THEM)
```
~/.claude/skills/threejs-fundamentals    — scene, camera, renderer
~/.claude/skills/threejs-geometry        — shapes, BufferGeometry, instancing
~/.claude/skills/threejs-materials       — PBR, shader materials
~/.claude/skills/threejs-lighting        — lights, shadows, IBL
~/.claude/skills/threejs-textures        — UV mapping, env maps, render targets
~/.claude/skills/threejs-animation       — keyframes, skeletal, morph targets
~/.claude/skills/threejs-loaders         — GLTF, textures, async patterns
~/.claude/skills/threejs-shaders         — GLSL, ShaderMaterial, uniforms
~/.claude/skills/threejs-postprocessing  — bloom, DOF, screen effects
~/.claude/skills/threejs-interaction     — raycasting, controls, input
~/.claude/skills/threejs-r3f-nextjs      — React Three Fiber + Next.js patterns
```

### Route Structure (flat — no route groups)
```
/                        → Landing page (water ripple hero — WORKS)
/about                   → 3D desk scene (IN PROGRESS — needs GLTF + local testing)
/faq                     → Racing track (IN PROGRESS — needs camera fix + local testing)
/pricing                 → Coming Soon
/login, /signup          → Auth pages
/forgot-password         → Password reset
/agency/                 → Dashboard (auth guarded)
/agency/chat             → Chat interface
/agency/brands           → Brand management
/agency/outputs          → Output library
/api/chat                → Streaming chat (Claude via AI Gateway)
```

### AI SDK v6 Patterns (CRITICAL)
- `import { useChat } from '@ai-sdk/react'`
- Transport: `new DefaultChatTransport({ api, body })`
- Messages: `UIMessage` with `parts[]`
- Response: `result.toUIMessageStreamResponse()`
- Tool definitions: `inputSchema` not `parameters`
- Zod: must use `zod/v3` for tool schemas
- Model: `gateway('anthropic/claude-sonnet-4')` from `@ai-sdk/gateway`

### Three Supabase Clients (don't mix)
- `lib/supabase/client.ts` — browser
- `lib/supabase/server.ts` — server (RSC, API routes)
- `lib/supabase/admin.ts` — service role (webhooks only)

## Database

Supabase: `https://uyhtrwlotoriblicqqrl.supabase.co`

Key tables: `brands`, `conversations`, `messages`, `outputs`, `agent_configs`, `users`, `ai_usage`

## Critical Gotchas

- **Test locally before pushing** — this is rule #1
- **Next.js 15, NOT 16**
- **No route groups** — flat routes only
- **`force-dynamic`** on pages with base-ui components
- **`render` prop** not `asChild`
- **oklch colours only**
- **Australian English** throughout
- **IBM Plex** font, **silver/chrome** palette (hue ~240)
- **AI Gateway** auto-injected — never configure manually
- **AHPRA/TGA compliance** — $60K/$120K penalties
