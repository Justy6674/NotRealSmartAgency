# NotRealSmart Agency

**Your own AI marketing agency.** 1 Director + 13 specialist department agents run marketing autonomously across your brands — all through conversation.

> Not(Artificial) Real(Intelligence) Smart

Built by a clinician who runs 8 businesses and got sick of paying agencies.

## Design Principle

The LLM drives tomorrow's complexity. The user just talks. One screen: brands + chat. No forms, no department buttons. The Director handles everything.

## Stack

- Next.js 15.3 + React 19 + Tailwind CSS 4 (oklch colours)
- Supabase (auth, PostgreSQL, RLS, Storage)
- Vercel AI SDK v6 `streamText` + AI Gateway (Claude Sonnet 4, with fallbacks)
- Vercel Cron (heartbeat every 15 min) + Fluid Compute (up to 5 min)
- Stripe (checkout, portal, webhooks)
- Resend (transactional email)
- shadcn/ui v4 (base-ui) + IBM Plex Sans + Mono
- Zustand (client state) + GSAP + Motion (animations)

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Add Supabase, Stripe, Resend, AI Gateway keys to .env.local
npm run dev    # http://localhost:3000
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with Turbopack (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint (flat config v9) |

## Agent Organisation (1 Director + 13 Departments)

```
                    NRS Director
                         |
    ┌────────┬───────┬───┴───┬───────┬────────┐
 Content   SEO &   Paid   Strategy  Email   Growth &
 & Copy    GEO     Ads    & Launch  Mktg    Partners
    │        │       │       │       │        │
  Brand   Market   Web &  Comply  Analytics  Auto
         Intel     CRO            & Report   & AI
                                      │
                                    Video &
                                   Scripting
```

Each department is a genuinely independent agent with its own model, memory, tools, budget, and audit trail. The Director delegates behind the scenes — users never see or pick departments.

## Key Features

- **65+ slash commands** — type `/` for Discord-style autocomplete (`/post`, `/blog`, `/audit`, `/video`, `/deepscan`)
- **Multi-agent meetings** — Director convenes 2–6 departments in parallel for comprehensive audits, launch plans, campaigns
- **Content Automation Machine** — upload video → transcribe → generate 6 platform captions → schedule → auto-publish
- **Self-hosted publishing** — Mixpost on VPS (Facebook, Instagram, LinkedIn, TikTok, YouTube) at $0/month
- **Video generation** — HeyGen integration with AHPRA/TGA compliance check
- **Brand ecosystem** — cross-promotion suggestions across sibling brands
- **Inline rich cards** — post previews, calendar views, analytics summaries rendered in chat
- **10-action report bar** — save, email, send, baseline, re-analyse, todo, copy, remember, full view, PDF
- **Master Marketing Proforma** — 21-section living document per brand with RAG status and staleness tracking
- **Team members** — invite collaborators with role-based and per-brand access
- **Chat images** — paste or drag/drop screenshots directly into chat
- **Intent router** — rule-based keyword classification routes messages to the right department(s), free (no LLM call)
- **Autonomous heartbeat** — Vercel Cron fires every 15 min, agents execute queued tasks with budget enforcement

## Brands

Downscale Weight Loss · DownscaleDerm · TeleCheck · TeleScribe · NotRealSmart · Downscale Diary · Scent Sell · EndorseMe

## Compliance

Healthcare brands are subject to **AHPRA and TGA** advertising regulations. A compliance filter checks all outputs before saving. $60K/$120K penalty awareness built in.

## Dashboard Pages

| Page | URL | Purpose |
|---|---|---|
| Chat | `/agency/chat` | Talk to the Director |
| Tasks | `/agency/tasks` | Work board with status filters |
| Agents | `/agency/agents` | Org chart, budgets, pause/resume |
| Approvals | `/agency/approvals` | Pending human sign-offs |
| Costs | `/agency/costs` | Per-agent spend dashboard |
| Brands | `/agency/brands` | Brand profiles + GitHub scanning |
| Outputs | `/agency/outputs` | Saved marketing deliverables |
| Media | `/agency/media` | Upload, transcribe, generate captions |
| Activity | `/agency/activity` | Activity feed |
| Team | `/agency/team` | Team member management |

---

For AI-assisted development, see [CLAUDE.md](./CLAUDE.md).

Black Health Intelligence Pty Ltd · ABN 23 693 026 112
