# NotRealSmart Agency

**Not(Artificial) Real(Intelligence) Smart** — a self-owned agentic AI marketing agency platform.

1 Director + 12 department heads run your marketing autonomously across 8 brands. Built by a clinician who runs 8 businesses and got sick of paying agencies.

## Stack

- Next.js 15.3 + React 19 + Tailwind 4 (oklch colours)
- Supabase (auth, PostgreSQL, RLS, Sydney ap-southeast-2)
- Vercel AI SDK v6 `streamText` + AI Gateway (Claude Sonnet 4, with GPT-4.1 + Gemini 2.5 Flash fallbacks)
- Vercel Cron (heartbeat every 15 min) + Fluid Compute (up to 5 min)
- Stripe (checkout, portal, webhooks)
- Resend (transactional email)
- Ruflo (persistent agent memory)
- shadcn/ui v4 (base-ui) + IBM Plex Sans + Mono

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Add Supabase keys, CRON_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY to .env.local
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
| NRS Director | Oversees all, delegates, convenes meetings, routes tasks |
| Content & Copy | Social posts, blogs, landing pages, image generation |
| SEO & GEO | Keywords, topic clusters, AI search optimisation, web search |
| Paid Ads | Meta, Google, LinkedIn, TikTok ad campaigns |
| Strategy & Launch | Campaigns, GTM, playbooks, presentations |
| Email Marketing | Sequences, EDMs, newsletters via Resend |
| Growth & Partnerships | Referrals, PR, partnerships, outreach |
| Brand | Voice guides, pillars, positioning, image generation |
| Market Intelligence | SWOT, gaps, pricing analysis, web search |
| Web & CRO | Copy, UX, conversion optimisation, page scanning |
| Compliance | AHPRA/TGA advertising checks, regulation scanning |
| Analytics & Reporting | Attribution, dashboards, performance |
| Automation & AI | Workflows, prompt engineering, GitHub scanning |

## Key Features

### Meeting Room (Multi-Department Collaboration)
When a brief touches multiple areas (e.g., "run a comprehensive marketing audit"), the Director automatically convenes a meeting. 2-6 departments work **in parallel**, each producing an expert document. The Director synthesises a summary. All outputs saved to the library.

Compound triggers: comprehensive audit, launch plan, campaign, rebrand, growth strategy, content strategy, competitive analysis.

### Intent Router
Rule-based keyword classification analyses every message and routes it to the right department(s). Multi-match detection triggers meetings. Fast and free (no LLM call).

### 10-Action Report Bar
Every substantial agent response includes action buttons:

| Button | Action |
|---|---|
| Save | Save to output library |
| Email Me | Send report to your inbox |
| Send to... | Email to anyone with optional note |
| Baseline | Save snapshot for before/after comparison |
| Re-analyse | Regenerate the response |
| Todo | LLM extracts action items → creates tasks |
| Copy | Copy markdown to clipboard |
| Remember | Save insights to agent memory |
| Full View | Full-screen report modal |
| PDF | Print-ready export |

### GitHub Repo Scanning
Add Brand dialog includes a GitHub scan button. Paste a repo URL → auto-fills brand name, description, niche, and tech stack. Agents use this context for better marketing.

### Persistent Memory (Ruflo)
Per-brand, per-department memory namespaces. Agents remember past conversations, outputs, and brand context across sessions. Director also searches a global agency namespace.

### Autonomous Heartbeat
Vercel Cron fires every 15 minutes. Agents check their task queues and execute assigned work autonomously. Budget enforcement with auto-pause. Monthly reset on the 1st.

### AHPRA/TGA Compliance
Every output for health brands passes through compliance rules. Checks for prohibited claims, testimonial usage, and TGA advertising restrictions. $60K/$120K penalty awareness built in.

## Dashboard Pages

| Page | URL | Purpose |
|---|---|---|
| Chat | `/agency/chat` | Talk to any agent, meeting room |
| Tasks | `/agency/tasks` | Work board with status filters |
| Agents | `/agency/agents` | Org chart, budgets, pause/resume |
| Approvals | `/agency/approvals` | Pending human sign-offs |
| Costs | `/agency/costs` | Per-agent spend dashboard |
| Brands | `/agency/brands` | Brand profiles + GitHub scanning |
| Outputs | `/agency/outputs` | Saved marketing deliverables |
| Activity | `/agency/activity` | Activity feed |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system architecture.

---

Black Health Intelligence Pty Ltd | ABN 23 693 026 112
