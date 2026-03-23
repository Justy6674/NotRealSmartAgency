# NotRealSmart Agency

**Not(Artificial) Real(Intelligence) Smart** — an agentic AI marketing agency platform.

10 specialised AI agents produce finished marketing deliverables across 8 brands. Built by a clinician who runs 8 businesses and got sick of paying agencies.

## Stack

- Next.js 15 + React 19 + Tailwind 4
- Supabase (auth, PostgreSQL, RLS)
- Vercel AI SDK v6 + AI Gateway → Claude Sonnet 4
- Three.js (WebGL water ripple hero)
- shadcn/ui v4 (base-ui)

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Add Supabase keys to .env.local
npm run dev
```

For AI Gateway: `vercel env pull` (auto-injected on Vercel deployment).

## Agent Departments

| Agent | What It Does |
|-------|-------------|
| Content & Copy | Social posts, blogs, landing pages |
| SEO | Keywords, topic clusters, on-page |
| Paid Ads | Meta, Google, LinkedIn, TikTok |
| Strategy & Launch | Campaigns, GTM, playbooks |
| Email Marketing | Sequences, EDMs, newsletters |
| Growth | Referrals, PR, partnerships |
| Brand | Voice guides, pillars, positioning |
| Competitor Intel | Gaps, SWOT, pricing analysis |
| Website | Copy, UX, conversion |
| Compliance | AHPRA/TGA advertising checks |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system architecture, styling guide, and shader pipeline documentation.

---

Black Health Intelligence Pty Ltd | ABN 23 693 026 112
