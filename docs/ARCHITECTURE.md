# Architecture & Styling Reference

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   NEXT.JS APP                        │
│              (notrealsmart.com.au)                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│   UI Layer (React 19 + shadcn/ui v4)                │
│   ├── Chat Interface (agent identity, brand context) │
│   ├── Meeting Room (multi-department collaboration)  │
│   ├── 10-Action Report Bar (save, email, todo, etc.) │
│   ├── Task Board (backlog → done)                    │
│   ├── Agent Dashboard (org chart, budgets)            │
│   ├── Approval Queue (human sign-off)                │
│   ├── Cost Dashboard (per-agent spend)               │
│   ├── Output Library (saved deliverables)            │
│   └── Landing Pages (water ripple, space hero)       │
│                                                       │
│   API Routes                                         │
│   ├── /api/chat (streamText streaming)               │
│   ├── /api/heartbeat (Vercel Cron, every 15 min)     │
│   ├── /api/email-report (Resend transactional email) │
│   ├── /api/extract-todos (LLM task extraction)       │
│   ├── /api/scan-github-quick (GitHub repo scanning)  │
│   ├── /api/agents, tasks, goals, approvals, audit    │
│   └── /api/brands, conversations, outputs, stripe    │
│                                                       │
│   Agent Layer (AI SDK v6)                            │
│   ├── streamText (per-request, NOT ToolLoopAgent)    │
│   ├── Intent Router (rule-based, multi-match)        │
│   ├── Director → delegate_to_agent (single dept)     │
│   ├── Director → convene_meeting (multi-dept)        │
│   ├── Budget enforcement (pre-flight check)          │
│   ├── Ruflo memory (per-brand per-dept namespaces)   │
│   └── Tool registry (per-agent tool sets)            │
│                                                       │
├─────────────────────────────────────────────────────┤
│   Vercel: AI Gateway + Fluid Compute + Cron          │
│   Models: claude-sonnet-4 → gpt-4.1 → gemini-2.5    │
├─────────────────────────────────────────────────────┤
│   Supabase: 15 tables + RLS + auth + realtime        │
├─────────────────────────────────────────────────────┤
│   Stripe: checkout + portal + webhooks               │
├─────────────────────────────────────────────────────┤
│   Resend: transactional email                        │
├─────────────────────────────────────────────────────┤
│   Ruflo: persistent agent memory                     │
└─────────────────────────────────────────────────────┘
```

## Request Flow

```
User message
    │
    ▼
Chat Route (/api/chat)
    │
    ├── Auth check (Supabase)
    ├── Brand fetch (RLS)
    ├── Agent config fetch
    ├── Budget check → 429 if exceeded
    ├── Ruflo memory search → inject into prompt
    │
    ▼
Intent Router (rule-based, free)
    │
    ├── Single match → "delegate to X department"
    ├── Multi match → "convene meeting with X, Y, Z"
    └── No match → Director handles directly
    │
    ▼
streamText (AI Gateway)
    │
    ├── Director uses delegate_to_agent → single dept via generateText
    ├── Director uses convene_meeting → N depts via Promise.allSettled
    └── Department uses its own tools (scan, write, etc.)
    │
    ▼
onFinish
    ├── Record spend → agent_registry
    ├── Log to ai_usage + audit_log
    ├── Extract memories → Ruflo
    └── Auto-save outputs → outputs table
```

## 13 Agents

| Department | Type | Role | Key Tools |
|---|---|---|---|
| NRS Director | overall | director | delegate_to_agent, convene_meeting, scan_*, web_search, browse_page, generate_image, send_email, read_gmail, generate_slides |
| Content & Copy | content | head | save_output, word_count, generate_image, generate_slides |
| SEO & GEO | seo | head | word_count, scan_website, browse_page, web_search |
| Paid Ads | paid_ads | head | word_count, generate_image |
| Strategy & Launch | strategy | head | save_output, browse_page, generate_slides |
| Email Marketing | email | head | word_count, send_email, read_gmail |
| Growth & Partnerships | growth | head | word_count, scan_website, send_email, browse_page, read_gmail |
| Brand | brand | head | save_output, generate_image |
| Market Intelligence | competitor | head | scan_website, browse_page, web_search |
| Web & CRO | website | head | word_count, scan_website, browse_page, generate_image |
| Compliance | compliance | head | scan_website, browse_page |
| Analytics & Reporting | analytics | head | scan_website, browse_page |
| Automation & AI | automation | head | scan_github, browse_page |

All agents also have: create_task, request_approval, handoff_to_department, save_output.

## Meeting Room

When the intent router detects 2+ departments are needed:
1. Director receives "CONVENE A MEETING" routing advisory
2. Calls `convene_meeting` tool with brief + department list
3. Each department gets: base prompt + brand context + meeting context + compliance rules
4. All departments run in parallel via `Promise.allSettled`
5. Results collected, each output auto-saved to library
6. Director writes synthesis summary

## Database Tables (15)

| Table | Purpose |
|---|---|
| agent_registry | Runtime org chart — role, department, reports_to, budget, status |
| agent_configs | Agent templates — system prompts, tool lists |
| agent_memories | Per-brand per-department persistent memory |
| tasks | Work board — backlog → assigned → in_progress → done |
| goals | Hierarchical objectives (objective → key_result → task) |
| audit_log | Immutable append-only action trail |
| approval_queue | Human sign-off gates |
| heartbeats | Cron execution log |
| brands | Brand profiles (tone, audience, compliance flags, GitHub URL) |
| conversations | Per-brand per-agent chat sessions |
| messages | Chat message history |
| outputs | Saved marketing deliverables (manual + auto-save) |
| project_scans | Website/GitHub/social scan results |
| ai_usage | Token tracking for billing |
| users | Auth + profile + work context |

## Styling

- **Colours:** oklch only. Silver/chrome (hue ~240). Gold accents (hue ~75).
- **Fonts:** IBM Plex Sans (body), IBM Plex Mono (code/terminal)
- **Components:** shadcn/ui v4 (base-ui) — `render` prop, NOT `asChild`
- **Dark mode default.** Variables in globals.css.
