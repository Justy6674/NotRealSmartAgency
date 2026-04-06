# NotRealSmart Agency

**Your own AI marketing agency.** 1 Director + 13 specialist department agents run marketing autonomously across your brands — all through conversation.

> Not(Artificial) Real(Intelligence) Smart

Built by a clinician who runs 8 businesses and got sick of paying agencies.

## Design Principle

The LLM drives tomorrow's complexity. The user just talks. One screen: brands + chat. No forms, no department buttons. The Director handles everything.

- **Conversation-first, not form-first.** If data is missing, the agent asks for it in chat.
- **The Director is the only face.** 14 departments work behind the scenes. The user never sees departments.
- **Auto-fill everything possible.** Scan website, sync GitHub, guess social handles.
- **Minimum clicks to value.** "Make me a TikTok video" = script + generation in one flow.
- **The agent should know what to do.** Suggest, don't wait.
- **Each brand learns independently.** Memory compounds per brand over time.

## Stack

- **Next.js 15.3** + React 19 + Tailwind CSS 4 (oklch colours)
- **Supabase** (auth, PostgreSQL + pgvector, RLS, Storage)
- **Vercel AI SDK v6** `streamText` + AI Gateway (Claude Sonnet 4 with fallbacks)
- **Vercel Cron** (heartbeat every 15 min) + Fluid Compute (up to 5 min)
- **Stripe** (checkout, portal, webhooks)
- **Resend** (transactional email)
- **shadcn/ui v4** (base-ui) + IBM Plex Sans + Mono
- **Zustand** (client state) + GSAP + Motion (animations)

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

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (React 19)                         │
│                                                                    │
│  ┌─────────────┐  ┌──────────────────────┐  ┌─────────────────┐  │
│  │  Sidebar     │  │   Main Content Area   │  │  Chat Panel     │  │
│  │  - Brands    │  │                        │  │  - Director     │  │
│  │  - Chats     │  │  Director's Office     │  │  - Inline cards │  │
│  │  - Add Brand │  │  Creative Studio       │  │  - Slash cmds   │  │
│  │              │  │  Command Centre        │  │  - Actions bar  │  │
│  │  ┌────────┐  │  │                        │  │                 │  │
│  │  │Settings│  │  │  Studio Sub-tabs:      │  │  sendToDirector │  │
│  │  └────────┘  │  │  All Content | Calendar│  │  (DOM event)    │  │
│  │              │  │  Media | Create        │  │                 │  │
│  └─────────────┘  └──────────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                     POST /api/chat (streaming)
                              │
┌──────────────────────────────────────────────────────────────────┐
│                     SERVER (Next.js API Routes)                    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    NRS Director (overall)                    │  │
│  │  streamText + gateway('anthropic/claude-sonnet-4')          │  │
│  │  Intent Router → Routing Hints in System Prompt             │  │
│  │  stepCountIs(5) max tool loops                              │  │
│  │                                                              │  │
│  │  Tools: delegate_to_agent, convene_meeting, save_output,    │  │
│  │  scan_website, generate_image, design_graphic, create_video,│  │
│  │  fill_calendar, manage_posts, web_search + 50 more          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │ delegation                            │
│  ┌───────────────────────▼──────────────────────────────────┐  │
│  │              AgentWorker (per department)                   │  │
│  │  13 independent workers, each with:                         │  │
│  │  - Own model (configurable per agent in registry)           │  │
│  │  - Own memory namespace (nrs-{brand}-{dept})                │  │
│  │  - Own tools (assembled per agent type)                     │  │
│  │  - Own budget (checked + tracked independently)             │  │
│  │  - Concurrent execution (max 4 parallel)                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────── Memory System v2 ─────────────────────────┐  │
│  │                                                              │  │
│  │  onFinish (after every chat response):                       │  │
│  │  1. Regex extraction (fast, common patterns)                 │  │
│  │  2. LLM extraction (Haiku — structured facts)                │  │
│  │  3. Session memory (Haiku — compounds per brand)             │  │
│  │                                                              │  │
│  │  Storage: Supabase agent_memories + pgvector embeddings      │  │
│  │  Search: semantic (cosine similarity) + keyword fallback     │  │
│  │  Dedup: >0.85 similarity = update, not insert                │  │
│  │  Types: preference, brand_rule, decision, observation, metric│  │
│  │  Session: 7-section markdown record that compounds over time │  │
│  │                                                              │  │
│  │  Prompt injection:                                           │  │
│  │  - Individual memories (ranked by type priority)             │  │
│  │  - Session memory ("Brand Learning" section)                 │  │
│  │  - Cross-department memories (global namespace)              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────── Publishing Pipeline ──────────────────────┐  │
│  │                                                              │  │
│  │  /api/cron/publish-posts (every 5 min)                       │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │ Mixpost (self-hosted on VPS, $0/month)               │    │  │
│  │  │ Facebook Pages | Instagram | LinkedIn | YouTube      │    │  │
│  │  │ TikTok (sandbox, pending app review)                 │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  │  Fallback: Ayrshare API                                      │  │
│  │  Webhooks: HeyGen + Mixpost → real-time status updates       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────── Integrations ─────────────────────────────┐  │
│  │  HeyGen: 18 tools (video agent, translation, templates,     │  │
│  │          photo avatar, TTS, talking photo, assets, webhooks) │  │
│  │  Canva:  29 tools (generate, edit, resize, comment, folder, │  │
│  │          upload, export, brand kits, structured generation)  │  │
│  │  Mixpost: 9 tools (analytics, posts, tags, media, templates)│  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────────┐
│                     DATABASE (Supabase)                             │
│                                                                    │
│  users, brands, conversations, messages, outputs, agent_configs,   │
│  agent_registry, agent_memories (+ pgvector), goals, tasks,        │
│  audit_log, approval_queue, heartbeats, project_scans, ai_usage,   │
│  media_items, scheduled_posts, brand_proforma_sections,            │
│  user_integrations, team_members, brand_conversation_log           │
│                                                                    │
│  RLS: 3 helper functions replace all 16 table policies             │
│  Triggers: update_updated_at(), handle_new_user()                  │
│  Extensions: pgvector (semantic memory search)                     │
└──────────────────────────────────────────────────────────────────┘
```

## Agent Organisation (1 Director + 13 Departments)

```
                    NRS Director (orchestrator)
                         |
    ┌────────┬───────┬───┴───┬───────┬────────┐
 Content   SEO &   Paid   Strategy  Email   Growth &
 & Copy    GEO     Ads    & Launch  Mktg    Partners
    |        |       |       |       |        |
  Brand   Market   Web &  Comply  Analytics  Auto
         Intel     CRO            & Report   & AI
                                      |
                                    Video &
                                   Scripting
```

Each department is a genuinely independent agent with its own model, memory namespace, tools, budget, and audit trail. The Director delegates behind the scenes — users never see or pick departments.

## Room-Based Navigation

| Room | URL | Purpose |
|------|-----|---------|
| **Director's Office** | `/agency/chat` | Primary chat — talk to the Director |
| **Creative Studio** | `/agency/studio` | Dashboard, calendar, media, content creation |
| **Command Centre** | `/agency/tasks` | Tasks, agents, approvals, costs, analytics, activity |

### Creative Studio Sub-tabs

| Tab | What It Shows |
|-----|---------------|
| **All Content** | Director's brief, social connections, week at a glance, drafts, strategy, Canva designs, videos, competitors, agent activity, analytics |
| **Calendar** | FullCalendar month view with drag-and-drop rescheduling |
| **Media** | Smart media library with upload, search, tags, bulk actions, archive |
| **Create** | 6 conversation-first intent cards (video, design, post, campaign, repurpose, calendar) |

### Create Tab — Conversation-First

Intent cards send context-rich messages to the Director instead of opening forms:
- **Create a Video** — Director suggests video types based on strategy, generates via HeyGen
- **Design in Canva** — Director suggests concepts, generates via Canva MCP
- **Write a Post** — Director identifies the underserved platform, writes, shows preview
- **Run a Campaign** — Director plans multi-platform campaign step by step
- **Repurpose Content** — Director creates platform-specific variants
- **Fill My Calendar** — Director builds 2-week content plan

Advanced form-based rooms available for power users.

## Memory & Learning System (v2)

Three-layer memory architecture following Anthropic's Claude Code patterns:

### Layer 1: Individual Memories (Semantic Search)
- **Extraction:** Claude Haiku extracts structured facts from every conversation
- **Types:** preference, brand_rule, decision, observation, metric
- **Storage:** Supabase + pgvector embeddings (1536-dim text-embedding-3-small)
- **Dedup:** >0.85 cosine similarity = update existing memory, not insert duplicate
- **Search:** Semantic vector search via `match_memories()` Postgres function
- **Fallback:** Keyword relevance + recency scoring if embeddings unavailable

### Layer 2: Session Memory (Compounding Record)
- **Pattern:** Background Haiku subagent updates a structured 7-section markdown record per brand
- **Sections:** Current State, User Preferences, Brand Rules, Decisions Made, Content Performance, Corrections & Feedback, Campaign History
- **Compounds:** Each extraction UPDATES sections, doesn't replace — knowledge grows over time
- **Thresholds:** 3 turns before first extraction, 3 turns between updates (not every message)

### Layer 3: Cross-Department Learning
- **Global namespace:** Director sees what all departments learned
- **Brand namespace:** Sub-agents see cross-department brand context
- **Memory injection:** Up to 15 individual memories + session record injected per prompt

### Production Features
- `GET /api/memories?brandId=X` — list memories for a brand
- `GET /api/memories/export` — download all memories as JSON (GDPR export)
- `DELETE /api/memories?scope=all` — delete all user memories (GDPR deletion)
- Memory browser UI in Brand Settings → Memory tab
- Weekly consolidation cron (dedup + prune old conversation summaries)

### Multi-Tenant Isolation
- `user_id` column on all memories with RLS policies
- Owner: full CRUD on own memories
- Team admin: read + write on brand memories
- Team viewer: read-only on brand memories
- Service role: full access for cron operations

## Integrations

### HeyGen (18 tools, 11 API routes, 1 webhook)
Video Agent (one prompt = full video), multi-scene, translation (175 languages), templates, photo avatar, TTS, talking photo, assets, brand glossary, voice locales, webhook receiver.

### Canva (29 tools, OAuth 2.0 + PKCE)
Generate, edit (start/perform/commit/cancel transactions), resize, upload assets, import designs, comments, folders, export, brand kits, structured generation, design content reading.

### Mixpost (9 tools, 12 API routes, 1 webhook)
Self-hosted on BinaryLane VPS (`mixpost.notrealsmart.com.au`). Analytics/reports, post management (create/update/delete/queue/approve), tags, media library, templates, webhook receiver.

### Connected Platforms (via Mixpost)

| Platform | Status |
|----------|--------|
| Facebook Pages | Live |
| Instagram | Live |
| LinkedIn | Live |
| YouTube | Connected (Google OAuth, YouTube Data API v3) |
| TikTok | Sandbox (pending app review) |

## Key Features

- **65+ slash commands** — type `/` for Discord-style autocomplete
- **Multi-agent meetings** — Director convenes 2-6 departments in parallel
- **Content Automation Machine** — upload video, transcribe, generate captions, schedule, auto-publish
- **Self-hosted publishing** — Mixpost on VPS at $0/month
- **Video generation** — HeyGen with AHPRA/TGA compliance check
- **Brand ecosystem** — cross-promotion across sibling brands
- **Inline rich cards** — post previews, calendar views, analytics, video previews in chat
- **10-action report bar** — save, email, send, baseline, re-analyse, todo, copy, remember, full view, PDF
- **Master Marketing Proforma** — 21-section living document per brand
- **Team members** — invite collaborators with role-based + per-brand access
- **Chat images** — paste/drag screenshots directly into chat
- **Intent router** — keyword classification routes to the right department(s), free
- **Autonomous heartbeat** — Vercel Cron every 15 min, agents execute queued tasks
- **Post signatures** — per-brand attribution (text, @mention, or #hashtag) on all published content
- **Brand watermark** — logo + "Created with NotRealSmart" on agent-generated content

## Brands

Downscale Weight Loss, DownscaleDerm, TeleCheck, TeleScribe, NotRealSmart, Downscale Diary, Scent Sell, EndorseMe

## Compliance

Healthcare brands subject to **AHPRA and TGA** advertising regulations. Compliance filter (Claude Haiku) checks all outputs before saving. $60K/$120K penalty awareness built in.

## Development

Developer knowledge base: `~/Obsidian` (Obsidian vault — decisions, sessions, strategy, reference docs).

For AI-assisted development guidance, see [CLAUDE.md](./CLAUDE.md).

---

Black Health Intelligence Pty Ltd · ABN 23 693 026 112
