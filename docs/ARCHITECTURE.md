# Architecture & Styling Reference

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   NEXT.JS APP                        │
│              (notrealsmart.com.au)                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│   UI Layer (React + shadcn/ui v4)                    │
│   ├── Chat Interface (agent identity, brand context) │
│   ├── Task Board (backlog → done)                    │
│   ├── Agent Dashboard (org chart, budgets)            │
│   ├── Approval Queue (human sign-off)                │
│   ├── Cost Dashboard (per-agent spend)               │
│   └── Landing Pages (water ripple, space hero)       │
│                                                       │
│   API Routes                                         │
│   ├── /api/chat (ToolLoopAgent streaming)            │
│   ├── /api/heartbeat (Vercel Cron, every 15 min)     │
│   ├── /api/agents, tasks, goals, approvals, audit    │
│   └── /api/brands, conversations, outputs, stripe    │
│                                                       │
│   Agent Layer (AI SDK 6)                             │
│   ├── ToolLoopAgent (per-request, dynamic config)    │
│   ├── Director → subagent delegation                 │
│   ├── Budget enforcement (prepareStep)               │
│   ├── Memory injection (prompt enrichment)           │
│   └── Tool registry (per-agent tool sets)            │
│                                                       │
├─────────────────────────────────────────────────────┤
│   Vercel: AI Gateway + Fluid Compute + Cron          │
├─────────────────────────────────────────────────────┤
│   Supabase: 15 tables + RLS + auth + realtime        │
└─────────────────────────────────────────────────────┘
```

## 13 Agents

| Department | Type | Role | Key Tools |
|---|---|---|---|
| NRS Director | overall | director | delegate, scan_*, marketing_audit |
| Content & Copy | content | head | save_output, word_count |
| SEO & GEO | seo | head | word_count, scan_website |
| Paid Ads | paid_ads | head | word_count |
| Strategy & Launch | strategy | head | save_output |
| Email Marketing | email | head | word_count |
| Growth & Partnerships | growth | head | word_count, scan_website |
| Brand | brand | head | save_output |
| Market Intelligence | competitor | head | scan_website |
| Web & CRO | website | head | word_count, scan_website |
| Compliance | compliance | head | scan_website |
| Analytics & Reporting | analytics | head | scan_website |
| Automation & AI | automation | head | scan_github |

All agents also have: create_task, request_approval, save_output.

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
| brands | Brand profiles (tone, audience, compliance flags) |
| conversations | Per-brand per-agent chat sessions |
| messages | Chat message history |
| outputs | Saved marketing deliverables |
| project_scans | Website/GitHub/social scan results |
| ai_usage | Token tracking for billing |
| users | Auth + profile |

## Styling

- **Colours:** oklch only. Silver/chrome (hue ~240). Gold accents (hue ~75).
- **Fonts:** IBM Plex Sans (body), IBM Plex Mono (code/terminal)
- **Components:** shadcn/ui v4 (base-ui) — `render` prop, NOT `asChild`
- **Dark mode default.** Variables in globals.css.
