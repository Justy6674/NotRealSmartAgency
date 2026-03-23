# Architecture & Styling Reference

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LANDING PAGE                          │
│  Three.js WebGL Water Ripple Hero → Below-fold sections │
│  (dynamically imported, ssr: false)                     │
└─────────────────────┬───────────────────────────────────┘
                      │ /agency/chat
┌─────────────────────▼───────────────────────────────────┐
│                   AGENCY DASHBOARD                       │
│  ┌──────────┬─────────────┬───────────────────────────┐ │
│  │  Agent   │  Convo      │                           │ │
│  │  Sidebar │  List       │     Chat Interface        │ │
│  │  (10)    │  (per brand │     (useChat + stream)    │ │
│  │          │   + agent)  │                           │ │
│  └──────────┴─────────────┴───────────────────────────┘ │
│  Brand Selector (topbar)                                │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   /api/chat (POST)                       │
│  1. Auth check (Supabase server client)                 │
│  2. Fetch brand profile from DB                         │
│  3. Fetch agent config from DB                          │
│  4. Build system prompt:                                │
│     [Base rules] + [Brand context] + [Agent prompt]     │
│     + [Compliance rules if health brand]                │
│  5. Get tools for agent type                            │
│  6. streamText() via AI Gateway → Claude Sonnet 4       │
│  7. Stream UIMessage back to client                     │
│  8. onFinish: track token usage in ai_usage table       │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              SUPABASE (PostgreSQL + RLS)                  │
│                                                          │
│  brands ─── conversations ─── messages                   │
│     │                                                    │
│     └── outputs (saved deliverables)                     │
│                                                          │
│  agent_configs (10 agents, system prompts, tool lists)   │
│  users (auth, profile)                                   │
│  ai_usage (token tracking, cost)                         │
└──────────────────────────────────────────────────────────┘
```

## Agent Prompt Assembly

```
buildSystemPrompt(brand, agentConfig) →

  ┌─ Base Rules ──────────────────────────────────┐
  │ Australian English, markdown, date, format    │
  └───────────────────────────────────────────────┘
  ┌─ Brand Context ───────────────────────────────┐
  │ Name, tagline, niche, tone, audience,         │
  │ competitors, content pillars, extra context   │
  └───────────────────────────────────────────────┘
  ┌─ Agent Instructions ──────────────────────────┐
  │ From agent_configs.system_prompt              │
  │ (Content, SEO, Ads, Strategy, etc.)           │
  └───────────────────────────────────────────────┘
  ┌─ Compliance Layer (conditional) ──────────────┐
  │ Only if brand.compliance_flags.ahpra/tga      │
  │ AHPRA guidelines, TGA rules, safe language    │
  └───────────────────────────────────────────────┘
```

## Water Ripple Hero — Shader Pipeline

```
Per frame:
  1. Simulation pass (targetA → targetB):
     - Read pressure, velocity, gradients from targetA
     - Wave equation: neighbour averaging with delta=1.4
     - Inject pressure at cursor position (radius 0.0275)
     - Calculate gradients (gradX, gradY)
     - Output: vec4(pressure, velocity, gradX, gradY)

  2. Render pass (targetB → screen):
     - Read simulation data from targetB
     - Distort background UVs by 0.3 * gradients
     - If ripple intensity > 0.1: apply 9-point Gaussian blur
     - Calculate specular highlights from normal mapping
     - Composite: colour + highlight * specular

  3. Swap targetA ↔ targetB (ping-pong)
```

## Styling Guide

### Colour System (oklch)
All colours use oklch colour space. Never use hex or rgb.

**Industrial palette:**
| Token | Value | Usage |
|-------|-------|-------|
| Background | `oklch(0.08 0 0)` | Page/section backgrounds |
| Surface | `oklch(0.12 0 0)` | Cards, elevated surfaces |
| Border | `oklch(0.2 0 0)` | Default borders |
| Metal text | `oklch(0.6 0 0)` | Secondary text, icons |
| Light text | `oklch(0.92 0 0)` | Headings, primary text |
| Muted text | `oklch(0.5 0 0)` | Descriptions, captions |
| Rust accent | `oklch(0.55 0.08 55)` | Bracketed text, hover borders |
| CTA gold | `oklch(0.75 0.15 75)` | Buttons, highlights |
| CTA gradient | `oklch(0.65 0.12 65) → oklch(0.5 0.08 55)` | Button backgrounds |

**Metallic text gradient (hero):**
```css
background-image: linear-gradient(180deg, oklch(0.78 0.03 75), oklch(0.5 0.02 60));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Typography
- **Hero title**: Bold, uppercase, tracking-wider, `clamp(3rem, 10vw, 7.5rem)`
- **Bracketed meanings**: Font-light, italic, `clamp(1rem, 3vw, 2.2rem)`, rust colour
- **Sub heading**: Semibold, uppercase, tracking-[0.2em], gold colour
- **Body**: Font-light, muted grey
- **Font stack**: Geist Sans (variable) + Geist Mono

### Hero Layout
```
     NOTREAL  (Artificial)      ← line 1: big + small italic
       SMART  (Intelligence)    ← line 2: big + small italic

    AGENTIC MARKETING AGENCY    ← sub heading: gold, spaced
    In the fast-changing...     ← body: muted grey

    [Enter the Agency] [Log In] ← CTAs
```

### Component Patterns
- **base-ui composition**: Always use `render` prop, never `asChild`
- **Dynamic pages**: Export `const dynamic = 'force-dynamic'` on pages with base-ui
- **Three.js**: Dynamic import via client wrapper component (`ssr: false`)
- **State**: zustand store for `activeBrandId`, `activeAgentType`, `activeConversationId`

### File Structure
```
src/
├── app/
│   ├── page.tsx                    # Landing (water ripple hero)
│   ├── login/signup/forgot-password/ # Auth pages
│   ├── agency/                     # Dashboard (auth guarded)
│   │   ├── layout.tsx              # Sidebar + topbar + brand selector
│   │   ├── chat/                   # Chat interface
│   │   ├── brands/                 # Brand management
│   │   └── outputs/                # Output library
│   └── api/                        # Server routes
│       ├── chat/                   # Streaming chat endpoint
│       ├── conversations/          # CRUD
│       ├── brands/                 # CRUD
│       └── outputs/                # Read
├── components/
│   ├── agency/                     # Dashboard components
│   ├── landing/                    # Landing page components
│   │   ├── WaterRippleHero.tsx     # Three.js WebGL water effect
│   │   ├── WaterRippleHeroLoader.tsx # SSR-safe dynamic wrapper
│   │   ├── AgentShowcase.tsx       # 10 departments grid
│   │   ├── HowItWorks.tsx          # 3-step flow
│   │   └── AgencyFooter.tsx        # Footer
│   ├── ui/                         # shadcn/ui v4 components
│   └── auth/                       # Auth form components
├── lib/
│   ├── agents/                     # Agent engine
│   │   ├── prompt-builder.ts       # System prompt assembly
│   │   ├── compliance-rules.ts     # AHPRA/TGA rules
│   │   └── tools/                  # AI SDK tool definitions
│   ├── supabase/                   # 3 client variants
│   └── constants.ts                # Site config, disclaimers
├── stores/
│   └── agency-store.ts             # zustand: brand, agent, conversation
└── types/
    └── database.ts                 # All DB types + enums
```
