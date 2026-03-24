# NotRealSmart Agency

**Not(Artificial) Real(Intelligence) Smart** — a self-owned agentic AI marketing agency platform.

1 Director + 12 department heads run your marketing autonomously across 8 brands. Built by a clinician who runs 8 businesses and got sick of paying agencies.

## Stack

- Next.js 15 + React 19 + Tailwind 4 (oklch colours)
- Supabase (auth, PostgreSQL, RLS, Sydney ap-southeast-2)
- Vercel AI SDK v6 ToolLoopAgent + AI Gateway → Claude Sonnet 4
- Vercel Cron (heartbeat every 15 min) + Fluid Compute (up to 5 min)
- shadcn/ui v4 (base-ui)
- IBM Plex Sans + Mono

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Add Supabase keys + CRON_SECRET to .env.local
npm run dev
```

## Agent Organisation (13 Agents)

```
                    NRS Director
                         |
    ┌────────┬───────┬───┴───┬───────┬────────┐
 Content   SEO &   Paid   Strategy  Email   Growth &
 & Copy    GEO     Ads    & Launch  Mktg    Partners
    │        │       │       │       │        │
  Brand   Market   Web &  Comply  Analytics  Auto
         Intel     CRO            & Report   & AI
```

| Department | What It Does |
|---|---|
| NRS Director | Oversees all, delegates, audits, routes tasks |
| Content & Copy | Social posts, blogs, landing pages |
| SEO & GEO | Keywords, topic clusters, AI search optimisation |
| Paid Ads | Meta, Google, LinkedIn, TikTok |
| Strategy & Launch | Campaigns, GTM, playbooks |
| Email Marketing | Sequences, EDMs, newsletters |
| Growth & Partnerships | Referrals, PR, partnerships |
| Brand | Voice guides, pillars, positioning |
| Market Intelligence | SWOT, gaps, pricing analysis |
| Web & CRO | Copy, UX, conversion optimisation |
| Compliance | AHPRA/TGA advertising checks |
| Analytics & Reporting | Attribution, dashboards, performance |
| Automation & AI | Workflows, prompt engineering, agent builds |

## Agentic Features

- **ToolLoopAgent** — AI SDK 6 agent loop with tool calling
- **Director delegation** — Director spawns subagents per department
- **Per-agent budgets** — monthly cost caps with auto-pause
- **Task board** — agents create and track work (backlog → done)
- **Approval gates** — human sign-off before significant actions
- **Immutable audit log** — every agent action traced
- **Persistent memory** — per-brand per-department context across sessions
- **Heartbeat cron** — autonomous task execution every 15 minutes
- **AHPRA/TGA compliance** — baked into every output for health brands

## Dashboard Pages

| Page | URL | Purpose |
|---|---|---|
| Chat | `/agency/chat` | Talk to any agent |
| Tasks | `/agency/tasks` | Work board with status filters |
| Agents | `/agency/agents` | Org chart, budgets, pause/resume |
| Approvals | `/agency/approvals` | Pending human sign-offs |
| Costs | `/agency/costs` | Per-agent spend dashboard |
| Brands | `/agency/brands` | Brand profile management |
| Outputs | `/agency/outputs` | Saved marketing deliverables |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system architecture.

---

Black Health Intelligence Pty Ltd | ABN 23 693 026 112
