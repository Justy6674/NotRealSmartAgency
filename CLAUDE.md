# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY: Read Before ANY Creative Studio Work

Before touching ANY Creative Studio code (Creator, Review, Schedule, Media, or related components), you MUST read:
- `~/Obsidian/Reference/nrs-creative-studio-definitive-architecture.md` — the complete architecture spec
- `~/NotRealSmartAgency/2026-04-08-post-creator-redesign.md` — the 10-card Creator spec
- `~/Obsidian/Reference/nrs-creative-studio-redesign-research.md` — competitor patterns

**Key architecture:** Creator is THE centre. Three entry points (Media→Creator, fresh Creator, Review→Creator). Director is the expert marketer who delegates to 13 agents. Any AI (Cowork, Claude Desktop) plugs into the Director via MCP. Build to spec, never patch.

## Rule Zero — Tomorrow's Tech for Marketing

> **Use today's tech to get things done. Build for tomorrow's tech to get better. Leave yesterday's tech behind.**

NRS must ALWAYS be at the frontier of marketing technology. Not just AI agents — everything: how content is created, how posts are published, how analytics work, how compliance is enforced, how users interact. Before building anything, ask: **is this how marketing will work in 12 months?** If not, research the frontier first, then build to it.

- **Build our own technology.** Third-party tools are temporary bridges until we build our own. Never sell or position plug-ins as the product.
- **Publishing:** Direct platform APIs (Meta Graph, YouTube Data, TikTok Content, LinkedIn). No middleware dependencies. CLI agentic pattern — agent calls platform API directly as a tool.
- **Never show plumbing.** Users don't know what Mixpost, Postiz, or OAuth are. They just talk.
- **Always evolving.** AI marketing tech moves every 2 weeks. When MCP servers, A2A protocols, or platform-native agent APIs ship — we adopt them. "Medium term" = 2 weeks.

## First Principle — Read This Before Every Build

**The user of this app is a non-technical business owner trying to be their own marketing agency.** They are not a developer. They do not know what "SEO & GEO" means. They cannot write JSON. They should never have to.

Every feature, every screen, every interaction must follow this rule:

> **The LLM drives tomorrow's complexity. The user just talks.**

- **Conversation-first, not form-first.** If data is missing, the agent asks for it in chat — never show a blank form and expect the user to fill it.
- **One screen: brands + chat.** The sidebar shows brands and recent chats. Nothing else. No department buttons, no management links. The Director handles everything.
- **The Director is the only face.** 14 departments work behind the scenes. The user never sees or picks departments. The Director presents all work as its own.
- **Auto-fill everything possible.** Scan the website, sync GitHub, guess social handles — without being asked.
- **Plain language, not jargon.** "Get more customers" not "Growth & Partnerships". "Make me a video" not "Generate video script output".
- **Minimum clicks to value.** If the user says "make me a TikTok video", the agent should write the script AND trigger generation — not make them navigate to Outputs and click a button.
- **The agent should know what to do.** Show what it already knows about the brand. Suggest what to do next. Don't wait to be asked.

This is the founding design principle. Every PR, every feature, every refactor must be evaluated against it.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — NOT Turbopack for Vercel compat)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9)
```

## What This App Is

**NotRealSmart Agency** — a self-owned agentic AI marketing agency platform. 1 Director + 13 department heads run marketing autonomously across 8 brands.

**Name:** Not Real (Artificial) Smart (Intelligence) = Artificial Intelligence. The name IS "AI" hidden in plain English. **Owner:** Black Health Intelligence Pty Ltd, ABN 23 693 026 112. Runs 10 Australian businesses — health clinics, telehealth, skincare, fragrance. Built NRS because we needed it ourselves. Australian-built, Australian-owned, specialising in healthcare, works for all.

**Repo:** `~/NotRealSmartAgency` (NOT `~/notrealsmart` — that's the old repo, superseded).

### The 8 Brands
Downscale Weight Loss (AHPRA+TGA) | DownscaleDerm (TGA) | TeleCheck | TeleScribe | NotRealSmart | Downscale Diary | Scent Sell | EndorseMe (AHPRA)

### 14 Agents (1 Director + 13 Departments)

| Department | Agent Type | Key Tools (all also get create_task, request_approval, handoff_to_department, query_outputs) |
|---|---|---|
| NRS Director | `overall` | delegate_to_agent, convene_meeting, save_output, scan_website, scan_github, scan_social, marketing_audit, browse_page, generate_image, send_email, read_gmail, generate_slides, web_search, process_media, repurpose_content, fill_calendar, write_blog, write_ads, write_email_campaign, deep_competitor_scan, manage_posts, manage_tags, analyse_voice, analyse_content_gaps, design_graphic, export_design, create_video, multi_scene_video, save_brand_info, read_proforma, update_proforma, query_calendar, query_analytics, query_outputs, query_media, query_social_analytics, text_to_speech, translate_video, photo_avatar, register_webhook, browse_mixpost_media, brand_glossary |
| Content & Copy | `content` | save_output, word_count, generate_image, generate_slides, repurpose_content, write_blog, analyse_voice, analyse_content_gaps, manage_tags |
| SEO & GEO | `seo` | save_output, word_count, scan_website, browse_page, web_search, write_blog |
| Paid Ads | `paid_ads` | save_output, word_count, generate_image, write_ads |
| Strategy & Launch | `strategy` | save_output, browse_page, generate_slides, fill_calendar, manage_posts, manage_tags, query_calendar |
| Email Marketing | `email` | save_output, word_count, send_email, read_gmail, write_email_campaign |
| Growth & Partnerships | `growth` | save_output, word_count, scan_website, send_email, browse_page, read_gmail |
| Brand | `brand` | save_output, generate_image, design_graphic, export_design, analyse_voice, brand_glossary, inspiration |
| Market Intelligence | `competitor` | save_output, scan_website, browse_page, web_search, deep_competitor_scan, query_social_analytics |
| Web & CRO | `website` | save_output, word_count, scan_website, browse_page, generate_image |
| Compliance | `compliance` | save_output, scan_website, browse_page |
| Analytics & Reporting | `analytics` | save_output, scan_website, browse_page, query_analytics |
| Automation & AI | `automation` | save_output, scan_github, browse_page |
| Video & Scripting | `video` | save_output, word_count, process_media, repurpose_content, create_video, multi_scene_video, query_media, text_to_speech, translate_video, photo_avatar, voice_locales, talking_photo, video_agent |

> `martech` exists as an archived agent type for backward compat with old conversations — not shown in UI.
> All agents get `read_proforma` + `query_outputs` for cross-agent learning.
> Departments are INVISIBLE to the user — Director delegates behind the scenes.

### Master Marketing Proforma
Each brand has a 21-section structured living document stored in `brand_proforma_sections`:
executive_snapshot, client_profile, brand_fundamentals, audience, market_context, compliance_profile,
business_goals, funnel_map, channel_website, channel_seo, channel_social, channel_paid, channel_email,
content_creative, competitors, kpi_dashboard, gaps_opportunities, wins_losses, risk_register, decision_log,
thirty_sixty_ninety. Each has RAG status, review cadence, staleness tracking. Auto-populated from brand data.

### Slash Commands (65+)
Type `/` in chat input → Discord-style autocomplete dropdown. All commands just send natural language
to the Director. Defined in `src/lib/slash-commands.ts`. Key commands: /post, /blog, /fill, /audit,
/design, /video, /adcopy, /deepscan, /proforma, /calendar, /analytics, /help.

### Inline Rich Cards
Chat messages can contain `json:card` code blocks that render as visual cards: PostPreviewCard,
CalendarWeekCard, AnalyticsSummaryCard, BrandSavedCard. Parser: `src/components/agency/inline/parseInlineCards.ts`.

### Hybrid API Keys
Canva, HeyGen, Ayrshare tools check `user_integrations` first (power users), fall back to env vars
(CANVA_API_KEY, HEYGEN_API_KEY, AYRSHARE_API_KEY). Users get everything out of the box.

### Brand Ecosystem
When chatting about one brand, the Director sees all sibling brands owned by the same user.
Enables cross-promotion suggestions between related products (TeleScribe + Tele360 + TeleCheck).

### Mixpost Self-Hosted Publisher (LIVE)
Mixpost Pro installed on BinaryLane VPS (`https://mixpost.notrealsmart.com.au/mixpost`).
Docker at `/opt/mixpost/docker-compose.yml`. Connected: Facebook Pages, Instagram Business, LinkedIn.
TikTok pending review. Cron publisher uses Mixpost first, Ayrshare as fallback.
Env vars: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN` (in .env.local + Vercel).
Supports video publishing to TikTok, YouTube, Instagram Reels, Facebook Reels.
Replaces Ayrshare ($299/mo) with $0/month self-hosted publishing.

## Required Reference: AI Agent Architecture

Before building or modifying agent execution, tool systems, memory, MCP integrations, or any agentic features in NotRealSmart, **load the Claude Code architecture skill first**:

```
/ai-agent-architecture
```

This provides production-proven patterns from Claude Code's source (2,200 files analysed) including:
- **Agent loop**: async generator pattern, state machine, error recovery
- **Tool system**: concurrency partitioning, streaming execution, fail-closed defaults
- **Sub-agents**: 5 agent types, context inheritance, coordinator mode
- **Permissions**: multi-layer security model
- **Context management**: 4 compaction strategies for long conversations
- **Memory**: auto-extraction, 4-type taxonomy, injection patterns

Full reference: `~/Obsidian/Reference/claude-code-architecture.md`

### Superpowers Development Workflow (MANDATORY)

The Superpowers skills are installed globally and **must be used** for all NotRealSmart development:

- **Before building**: Use `brainstorming` skill — spec first, then plan, then code
- **Before coding**: Use `writing-plans` skill — bite-sized tasks with file mappings
- **During coding**: Use `test-driven-development` — RED-GREEN-REFACTOR, no code without failing test
- **For parallel work**: Use `dispatching-parallel-agents` — one agent per independent domain
- **For multi-task execution**: Use `subagent-driven-development` — fresh subagent per task with two-stage review
- **When debugging**: Use `systematic-debugging` — root cause investigation before fixes
- **Before completing**: Use `verification-before-completion` — evidence before claims
- **For code review**: Use `requesting-code-review` + `receiving-code-review`
- **For branches**: Use `finishing-a-development-branch` — verify tests, present options, clean up

### Video Toolkit (Available for Video Agent)

The `openclaw-video-toolkit` skill is installed globally. Use it when building or improving the Video & Scripting department:

- **Open-source alternative to HeyGen**: Remotion (React) + cloud GPU (Modal/RunPod) for programmatic video
- **AI voiceover**: Qwen3-TTS voice cloning — free, runs on your GPU, brand voice matching
- **Image generation**: FLUX.2 for video scene frames — free on Modal's $30/mo starter
- **AI music**: ACE-Step royalty-free music generation
- **Commands**: `/video-setup`, `/video-video`, `/video-template`, `/video-brand`, `/video-generate-voiceover`
- **Python tools**: `~/.claude/video-toolkit-tools/` (22 scripts: voiceover, image gen, music, upscale, face animation)
- **Templates**: Product demos, sprint reviews — extensible for marketing content

Integration points in NotRealSmart:
- `lib/agents/tools/create-video.ts` — can be extended to use toolkit alongside HeyGen
- `lib/agents/tools/process-media.ts` — toolkit's FFmpeg tools for post-processing
- Video agent personality (`video` type) — add toolkit awareness to system prompt
- Cron publisher (`/api/cron/publish-posts`) — rendered MP4s can be published via Mixpost

Apply these patterns when working on: Director chat, AgentWorker system, tool implementations, memory system (mem0 replacement), heartbeat execution, intent router, delegation, meetings.

## Architecture

### Middleware & Auth
`src/middleware.ts` runs Supabase session refresh on every request (except static assets/images). Uses `lib/supabase/middleware.ts` `updateSession()`. All `/agency/*` routes require auth.

### Next.js Config
`next.config.ts`: `transpilePackages: ['three']`. Allowed remote image domains: `uyhtrwlotoriblicqqrl.supabase.co` (Supabase storage), `www.google.com` (favicons), `**.com.au`. Security headers: X-Frame-Options SAMEORIGIN, nosniff, HSTS.

### ESLint
No project-level `eslint.config.*` — uses Next.js v9 flat config defaults. Run `npm run lint`.

### Agent Execution — True Multi-Agent (AI SDK v6)
**Director chat** (`/api/chat/route.ts`) uses `streamText()` (NOT ToolLoopAgent). Each request:
1. Validates request (brandId, agentType, conversationId)
2. Fetches brand (RLS-protected) + agent config from Supabase
3. Gets/creates agent registry entry, checks budget (`429` if exceeded)
4. Builds system prompt with independent memory retrieval per agent namespace
5. For Director: runs intent router, appends routing hints to system prompt
6. Streams via `gateway('anthropic/claude-sonnet-4')` with fallbacks
7. `stopWhen: stepCountIs(5)` — max 5 tool-use steps per turn
8. `onFinish`: records spend, logs to `ai_usage` + `audit_log`, extracts memories

**AgentWorker system** (`lib/agents/worker.ts`) — each department is a genuinely independent agent:
- **Own model** — reads from `agent_registry.model` per department (configurable)
- **Own memory** — `buildSystemPromptWithMemory()` searches the agent's own namespace + cross-department brand memories
- **Own tools** — assembled per agent type via `getToolsForAgent()`
- **Own budget** — checked and tracked independently, status set to `working`/`idle`
- **Own audit trail** — model, tokens, cost, duration logged per execution
- **Step limits** — `stopWhen: stepCountIs(3)` prevents runaway tool loops
- **Concurrency** — max 4 workers simultaneously via `runParallelAgents()`

**Delegation**: `delegate_to_agent` spawns an AgentWorker. Supports `parallel` field to run multiple departments simultaneously.
**Meetings**: `convene_meeting` spawns N AgentWorkers in parallel via `Promise.allSettled()`.
**Heartbeat**: `/api/heartbeat` also uses `runAgentWorker` for consistent execution.

### 14 Agent Personalities (agency-agents pattern)
Each agent has a deep specialist definition (5,000-6,400 chars) with:
- Identity & Memory, Core Mission, Critical Rules, Decision Framework
- Deliverable Templates, Quality Checklist, Success Metrics, Handoff Protocol

| Agent Type | Personality | Specialisation |
|---|---|---|
| `overall` | The Orchestrator | Invisible delegation, single point of contact |
| `content` | The Storyteller | Platform algorithms, voice matching, repurposing |
| `seo` | The Search Scientist | Topic clusters, GEO/AI search, E-E-A-T |
| `paid_ads` | The Performance Marketer | ROI-obsessed, platform ad policies |
| `strategy` | The Strategist | 90-day plans, launch playbooks |
| `email` | The Relationship Builder | Sequence architecture, Spam Act compliance |
| `growth` | The Growth Hacker | Growth loops, partnerships, experiments |
| `brand` | The Brand Guardian | Voice guides, visual identity, consistency |
| `competitor` | The Intelligence Analyst | Evidence-based profiles, SWOT, gap analysis |
| `website` | The Conversion Architect | CRO, Core Web Vitals, WCAG 2.1 AA |
| `compliance` | The Regulatory Shield | AHPRA/TGA expert, risk severity ratings |
| `analytics` | The Data Translator | Metrics with context, attribution |
| `automation` | The Systems Architect | Workflow design, integration architecture |
| `video` | The Visual Director | Platform-native scripts, AI video generation |

Agent personalities are visible in chat during delegation/meetings (coloured badges, tree-structured progress).

### Intent Router (`lib/agents/intent-router.ts`)
Rule-based keyword classification that analyses the user's message and suggests which department should handle it. Returns `{ suggestedAgent, confidence, shouldDelegate }`. Injected into Director's system prompt as routing hints — fast and free (no LLM call).

### Heartbeat (Vercel Cron)
`/api/heartbeat` runs every 15 min via Vercel Cron. Processes assigned tasks autonomously. Budget enforcement with auto-pause. Monthly reset on 1st. Uses Fluid Compute (`maxDuration=300`).

### Memory System (Ruflo — pending replacement with mem0)
- **Client:** `lib/ruflo/client.ts` — search + store via Supabase `agent_memories` table
- **Namespaces:** `lib/ruflo/namespaces.ts` — `nrs-{brandSlug}-{agentType}` per brand per department, `nrs-agency` for global
- **Extraction:** `lib/ruflo/memory-extractor.ts` — regex-based extraction of preferences, decisions, metrics from responses
- **Prompt integration:** `lib/agents/prompt-builder.ts` — `buildSystemPromptWithMemory()` searches memories before each chat, injects up to 15 (10 local + 5 global)
- **Known limitations:** Keyword search only (no semantic), regex extraction misses ~40-60% of insights, no deduplication, no importance scoring, no memory decay
- **Planned replacement:** mem0 self-hosted on Supabase pgvector — LLM-based fact extraction, semantic vector search, memory consolidation, graph relationships. See `project_memory_architecture.md` in memory files.

### Team Members & Invitations
`team_members` table with roles (`owner`, `admin`, `viewer`) and optional per-brand access (`brand_ids UUID[]`, NULL = all brands). Invite flow via Resend email with token link. Auto-accept on signup via updated `handle_new_user()` trigger.
- **RLS**: 3 helper functions (`is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand`) replace all 16 table policies
- **UI**: `/agency/team` page, `InviteTeamDialog`, `/invite/[token]` public landing page
- **API**: `/api/team` (GET list + POST invite), `/api/team/[id]` (PATCH + DELETE), `/api/team/accept`

### Chat Image/Screenshot Support
Users can paste (Cmd+V) or drag/drop images into chat. Images are sent as AI SDK v6 `FileUIPart` (base64 data URL) so Claude actually sees them. Video/audio still goes through the media upload pipeline.

### Post Signature Branding
Per-brand `post_signature` JSONB field on `brands` table. Three formats: plain text, `@mention`, or `#hashtag`. Injected into all agent system prompts as a mandatory attribution rule. Also appended by the cron publisher to scheduled posts before publishing via Mixpost/Ayrshare.

### Mixpost Integration
- **Client**: `lib/mixpost/client.ts` — fetches connected accounts from Mixpost API
- **Brand mapping**: `lib/mixpost/brand-mapping.ts` — fuzzy matches Mixpost account names to NRS brands
- **Auto-greet**: ChatInterface checks Mixpost accounts and shows "Socials: Instagram, Facebook, LinkedIn (connected via Mixpost)" instead of "Still missing: social profiles"
- **API**: `/api/mixpost/accounts` — cached endpoint for brand-to-social mapping

### Platform Algorithm Intelligence
`lib/agents/knowledge/social-media-benchmarks.ts` includes deep platform-specific algorithm knowledge:
TikTok (watch time, completion rate, hook requirements), Instagram (saves/shares weighted, carousel re-engagement, Reels priority), LinkedIn (dwell time, polls, document posts), Facebook (group engagement vs dead page reach), X/Twitter (reply visibility, thread structure, pain-signal discovery), YouTube (CTR + watch time, thumbnail importance). Cross-platform growth tactics: content capsule model, repurposing chains, anti-AI detection, feedback loops.

### Canva Integration
`design_graphic` and `export_design` tools use Canva MCP (connected via `mcp__claude_ai_Canva__*`). Creative Studio's Create tab also provides direct Canva access. Brand agent and Director can generate designs, search templates, export to formats.

### MCP Server — CLI & AI Client Access (LIVE)
NRS is an MCP server. Users connect from Claude Desktop, Claude Mobile, Claude Code, Cowork (VS Code), or any MCP-compatible AI client.

**Endpoint:** `https://www.notrealsmart.com.au/api/mcp` (Streamable HTTP, stateless)

**Two auth methods:**
1. **Bearer token** — user creates API key in Settings, adds to config. Key prefix `nrs_sk_`, SHA-256 hashed in `api_keys` table.
2. **OAuth 2.0** — user clicks "Add custom connector" in Claude Desktop/Mobile, logs in via `/mcp-login`, token issued automatically. Full RFC 8414 + RFC 7591 + PKCE S256.

**Access token = nrs_sk_ API key.** Both auth methods produce the same key type. The MCP server's `resolveApiKey()` validates both. Zero duplication.

**12 MVP tools:** `chat_with_director` (flagship — full Director with delegation), `publish_to_social`, `write_blog`, `write_ads`, `write_email_campaign`, `manage_posts`, `query_calendar`, `query_outputs`, `save_output`, `generate_image`, `scan_website`, `query_analytics`.

**Resources:** `brands://list` — all user's brands.

**Key files:**
- `src/app/api/mcp/route.ts` — MCP HTTP handler
- `src/lib/mcp/server.ts` — McpServer factory (tool registration)
- `src/lib/mcp/director-chat.ts` — chat_with_director tool (generateText, not streamText)
- `src/lib/mcp/tool-adapter.ts` — wraps AI SDK tools as MCP tools
- `src/lib/auth/api-key.ts` — key generation + validation
- `src/app/api/mcp/authorize/route.ts` — OAuth authorize
- `src/app/api/mcp/token/route.ts` — OAuth token exchange
- `src/app/mcp-login/page.tsx` — branded OAuth login page

**Adding more tools:** Add tool name to `MVP_TOOLS` set in `src/lib/mcp/server.ts`. No other changes.

**Team invite emails** include step-by-step setup for web, Claude Desktop/Mobile (OAuth), and Claude Code/Cowork (API key + "tell Claude to connect").

### Planned Major Builds
1. **mem0 memory system** — replace Ruflo with semantic search, LLM extraction, graph memory
2. **Self-updating knowledge** — daily research cron, agents stay current with AI/marketing trends

### Meeting Room (Multi-Department Collaboration)
When the intent router detects 2+ departments needed, the Director uses `convene_meeting` instead of `delegate_to_agent`. All departments run as independent AgentWorkers in parallel. Each gets meeting context + department-specific brief. Results returned as structured meeting output with agent personality attribution. Auto-saved to output library with `[Meeting]` prefix.

Compound triggers: comprehensive audit, launch plan, campaign, rebrand, growth strategy, content strategy, competitive analysis, video campaign, review my brand.

### 10-Action Report Bar (`components/agency/MessageActions.tsx`)
Every substantial assistant message (>100 chars) gets action buttons: Save, Email Me, Send to..., Baseline, Re-analyse, Todo, Copy, Remember, Full View, PDF. APIs: `POST /api/outputs`, `POST /api/email-report`, `POST /api/extract-todos`.

### GitHub Repo Scanning
Add Brand dialog has a scan button. `GET /api/scan-github-quick?url=...` fetches README + package.json + repo metadata. Auto-fills brand name, description, niche, extra_context.

### Video Generation Pipeline
Video agent writes platform-specific scripts (Reels, TikTok, YouTube, LinkedIn). Scripts saved as `video_script` output type with AHPRA/TGA compliance check. OutputCard has "Generate Video (HeyGen)" button → calls `/api/video/generate` → creates `video` output with player. Status polling via `/api/video/status`. Provider API keys managed in Brand Settings → Video tab via `/api/integrations`.

### "Review My Brand" Flow
Brand cards have "Review Brand" button → `POST /api/brands/{brandId}/review` runs website + GitHub + social scans in parallel → builds structured message → stores in Zustand `pendingReviewMessage` → redirects to Director chat → ChatInterface auto-sends → triggers 6-department meeting (competitor, SEO, content, analytics, compliance, website).

### Compliance Filter
`lib/agents/compliance-filter.ts` — uses Claude Haiku to evaluate content against AHPRA/TGA rules before saving outputs. Returns `{ isValid, flags, warnings }`. Runs automatically in `save_output` tool.

### Social Media Knowledge
`lib/agents/knowledge/social-media-benchmarks.ts` — platform benchmarks (engagement rates, CTR, CPC, video specs, posting times). Injected into agent prompts filtered by agent type (video gets video specs, analytics gets all formulas, etc.).

### Cross-Agent Learning
`query_outputs` tool (all agents) — search past outputs from any department. Memory extractor captures social metrics. Cross-department memories stored to `nrs-agency` global namespace.

### Client State (Zustand)
Single store `src/stores/agency-store.ts` — `useAgencyStore` persisted to localStorage key `nrs-agency`. Manages: `activeBrandId`, `activeAgentType`, `activeConversationId`, `activeView`, `sidebarOpen`, `pendingReviewMessage` (transient). Changing brand resets agent to `overall` and clears conversation.

### Stack
- **Next.js 15.3** (NOT 16), **React 19**, **Tailwind CSS 4** (oklch only)
- **shadcn/ui v4** (base-ui — use `render` prop, NOT `asChild`)
- **Supabase** (3 clients: browser, server, admin)
- **Vercel AI SDK v6** `streamText` + AI Gateway (auto-injected via `@ai-sdk/gateway`)
- **Stripe** — checkout, portal, webhooks (`lib/stripe/`)
- **Resend** — transactional email
- **GSAP** + **Motion** (Framer Motion) — animations (landing page, about page)
- **IBM Plex Sans + Mono**, **lucide-react** icons
- **zustand** (client state), **Zod v4** (`zod/v3` import for AI SDK tool schemas)

### Room-Based Navigation (`lib/room-config.ts`)
Agency UI is organised into 3 rooms (tabs in header):
1. **Director's Office** (`/agency/chat`) — primary chat interface, conversations
2. **Creative Studio** (`/agency/studio`) — professional social media builder with sub-tabs: All Content (dashboard), Calendar, Media, Create, Grid Planner
3. **Command Centre** (`/agency/tasks`) — operational dashboards with sub-tabs: Tasks, Agents, Approvals, Costs, Analytics, Activity

Config: `src/lib/room-config.ts`. Components: `RoomTabs.tsx` (embedded in `AgencyHeader.tsx`), `RoomSubTabs.tsx`.

### Creative Studio — Intelligent Agency Dashboard
`StudioDashboard.tsx` — live feeds from all integrations. Chat panel auto-opens on Studio pages.

**Dashboard sections** (in order): Director's Brief, Social Connections (Mixpost), Week-at-a-Glance, Drafts Awaiting Action, Strategy & Pillars, Canva Designs, Videos (HeyGen), Competitor Intel, Agent Activity Ticker, Recent Content Feed.

**Data flow**: `useStudioData()` hook fetches from `GET /api/studio/overview?brandId=X` + `GET /api/canva/designs?brandId=X` in parallel.

**CreateHub** (`Create` tab): 6 intent cards — each one-click opens chat. Quick Post form is a collapsible power-user section.

### Creative Studio v2 — Component Library
Phone-frame platform mockups (`preview/`): PhoneFrame, InstagramMockup, FacebookMockup, LinkedInMockup, XMockup, TikTokMockup, YouTubeMockup, MultiPlatformPreview, PlatformMockupPreview.
Image editor (`editor/`): ImageEditorModal wrapping react-filerobot-image-editor with CropPresets (13 platform aspect ratios).
DnD (`dnd/`): SortableItem, SortableImageGrid using @dnd-kit.
Hashtag groups (`hashtags/`): HashtagGroupPicker with saved tag sets per brand. API: `/api/hashtag-groups`.
Post templates (`templates/`): PostTemplatePicker with {variable} support. API: `/api/post-templates`.
Instagram grid planner (`grid/`): InstagramGridPlanner showing 3-column feed preview with drag-to-reorder.
Approval workflow (`approval/`): ApprovalActions (approve/reject with reason), CommentThread.
Composer layout (`post/`): ComposerLayout (split-pane), ComposerActionBar (sticky bottom), PlatformVersionEditor (per-platform caption overrides).
Post versions: `src/lib/post-versions.ts` — PostVersions type, PLATFORM_CHAR_LIMITS, createVersionsFromMaster, customisePlatform.
Template variables: `src/lib/template-variables.ts` — 8 built-in variables ({brand}, {date}, {product}, etc.), resolveTemplate(), extractVariables().

### Guided Onboarding
First-time users get a conversational onboarding flow. Instead of showing missing fields, the Director proactively guides the user: "Tell me about your business" → auto-populates brand fields. Built into `ChatInterface.tsx` auto-greet logic.

### Brand DNA & Inspiration Library
- **Brand DNA**: structured personality constraints (voice, tone, audience, values) stored on brand. Displayed as Marketing DNA Bar in chat. Director can update via conversation.
- **Inspiration Library**: cross-industry marketing examples the brand can draw from. Agent tools (`save_output`) check against Brand DNA constraints.
- **Emulation Wishlist**: brands/campaigns the user admires — feeds agent creative direction.
- **Guardian Agent**: validates all outputs against Brand DNA + AHPRA/TGA rules.

### Route Structure (flat — no route groups)
```
/                              → Landing page (water ripple hero — DO NOT TOUCH)
/about                         → Space hero + terminal FAQ
/pricing                       → Coming Soon
/faq                           → FAQ page
/privacy, /terms               → Legal pages
/login, /signup, /forgot-password → Auth pages
/agency                        → Agency dashboard redirect
/agency/chat                   → Director's Office (new conversation)
/agency/chat/[conversationId]  → Existing conversation
/agency/studio                 → Creative Studio (outputs, calendar, media, create)
/agency/tasks                  → Command Centre → Tasks
/agency/agents                 → Command Centre → Org chart + budgets
/agency/approvals              → Command Centre → Approval queue
/agency/costs                  → Command Centre → Cost dashboard
/agency/brands                 → Brand list
/agency/brands/[brandSlug]     → Brand profile editor
/agency/outputs                → Output library (legacy — folded into Studio)
/agency/media                  → Media library (legacy — folded into Studio)
/agency/activity               → Command Centre → Activity feed
/agency/team                   → Team member management
/invite/[token]                → Public invite acceptance page
/api/chat                      → streamText streaming endpoint
/api/heartbeat                 → Cron endpoint
/api/agents, tasks, goals, approvals, audit, conversations, outputs, brands → CRUD routes
/api/brands/[brandId]/review         → One-click brand audit (scans + Director chat)
/api/video/generate                  → Submit video generation job (HeyGen)
/api/video/status                    → Poll video generation status
/api/integrations                    → GET/POST provider API keys
/api/github/sync                     → Sync GitHub context to brand
/api/media/upload                    → Upload video/audio to Supabase Storage
/api/media/transcribe                → Deepgram/Whisper transcription
/api/media/[mediaItemId]/generate    → AI generates 6 platform captions
/api/media                           → GET/DELETE media items
/api/cron/publish-posts              → Cron: publish via Mixpost (self-hosted) or Ayrshare fallback
/api/cron/daily-intel                → Cron: daily intelligence research
/api/scheduled-posts                 → Scheduled posts CRUD
/api/analytics                       → Analytics data endpoint
/api/profile                         → User profile GET/PATCH
/api/team                            → Team members GET list + POST invite
/api/team/[id]                       → Team member PATCH role + DELETE
/api/team/accept                     → Accept invitation by token
/api/mixpost/accounts                → Mixpost connected accounts + brand mapping
/api/studio/overview                 → Aggregated dashboard data (analytics, posts, outputs, videos, accounts, activity)
/api/canva/designs                   → Canva designs proxy (thumbnails, edit URLs)
/api/stripe/checkout, portal, webhook → Stripe integration
/api/calendar/feed                       → iCal feed for Google/Apple Calendar sync (auth via ?key=nrs_sk_...)
/api/mcp                             → MCP server (Streamable HTTP, Bearer token auth)
/api/mcp/authorize                   → OAuth 2.0 authorization endpoint
/api/mcp/token                       → OAuth 2.0 token exchange (PKCE)
/api/mcp/register                    → OAuth 2.0 dynamic client registration (RFC 7591)
/api/mcp/code                        → Generate auth code after login
/api/keys                            → API key CRUD (create, list, revoke)
/api/webhooks                        → Webhook endpoints
/api/video-toolkit                   → Video toolkit integration
/api/heygen                          → HeyGen proxy endpoints
/api/memories                        → Memory CRUD endpoints
/api/email-report                    → Email report to user
/api/extract-todos                   → Extract action items from messages
/agency/settings                     → Agency settings (work context, preferences)
/agency/analytics                    → Analytics dashboard
/mcp-login                           → OAuth login page ("Connect your agency")
/.well-known/oauth-authorization-server → RFC 8414 discovery (rewrite → /api/well-known/)
/.well-known/oauth-protected-resource   → RFC 9728 resource metadata
```

### Content Automation Machine (CAM)
Upload → Transcribe → Generate → Schedule → Publish pipeline:
- `/agency/media` page with drag & drop batch upload to Supabase Storage `media` bucket
- 2-layer ASR: Deepgram nova-2 → OpenAI Whisper fallback (`lib/transcription/transcribe.ts`)
- AI generates 6 platform-specific captions per video (YouTube, TikTok, Instagram, Facebook, LinkedIn, X)
- `scheduled_posts` table tracks draft → scheduled → publishing → published flow
- Cron publisher (`/api/cron/publish-posts`, every 5 min) via Mixpost API (self-hosted on VPS) with Ayrshare fallback
- Provider settings: Deepgram in Brand Settings → Video tab
- Social publishing: Mixpost handles FB, IG, LinkedIn, TikTok, YouTube — connected via OAuth on the VPS

### Department-Specific Quick Actions
`QuickActions.tsx` shows contextual buttons per department (not generic). 14 sets of 4-6 buttons with conditional AHPRA/TGA compliance prompts, website scan prompts, and GitHub scan prompts based on brand config.

### Database Tables
```
users, brands, conversations, messages, outputs, agent_configs,
agent_registry, agent_memories, goals, tasks, audit_log,
approval_queue, heartbeats, project_scans, ai_usage,
media_items, scheduled_posts, brand_proforma_sections,
user_integrations, team_members, brand_conversation_log,
api_keys
```

### Three Supabase Clients (don't mix)
- `lib/supabase/client.ts` — browser
- `lib/supabase/server.ts` — server (RSC, API routes)
- `lib/supabase/admin.ts` — service role (webhooks, heartbeat)

### Tool Implementation Pattern
All tools in `lib/agents/tools/`. Factory functions take context (supabase, userId, brandId) and return AI SDK tool objects with Zod schemas. Tool index (`tools/index.ts`) assembles per-agent tool sets. Management tools (`create_task`, `request_approval`, `handoff_to_department`) are shared across all agents.

## Critical Gotchas

- **NEVER touch the homepage** (`src/app/page.tsx`, WaterRippleHero)
- **NEVER use Three.js** for new features — use CSS/SVG/Canvas 2D only (Three.js exists only for the landing/about heroes)
- **Test locally before pushing** (`npm run dev` + check in browser)
- **Correct repo is `~/NotRealSmartAgency`** — NOT `~/notrealsmart`
- **No route groups** — flat routes only
- **`force-dynamic`** on pages with base-ui components
- **`render` prop** not `asChild` for base-ui composition
- **oklch colours only** (silver/chrome palette, hue ~240)
- **Australian English** throughout (colour, behaviour, organisation)
- **AI Gateway** auto-injected — never configure manually
- **AHPRA/TGA compliance** — $60K/$120K penalties per offence
- **Trigger function is `update_updated_at()`** not `update_updated_at_column()`
- **Supabase creds in `.env.local`** — never ask for them, just use them
- **DB password** is in `.env.local` — never hardcode or commit it
- **streamText works, ToolLoopAgent breaks** — never switch to ToolLoopAgent for chat

## Key Conventions

- **Budget in cents** (integer, no floating point)
- **Audit log is append-only** — no UPDATE/DELETE policies
- **Agent configs = templates** (system prompts, tool lists, stored in `agent_configs` table)
- **Agent registry = runtime state** (status, budget, model, org chart — per user, stored in `agent_registry` table)
- **Zod v3** import path for AI SDK tool schemas (`import { z } from 'zod/v3'`)
- **IBM Plex** font, **silver/chrome** palette
- **Default model:** `anthropic/claude-sonnet-4` (overridable per agent in registry)
- **Cost calculation:** `(inputTokens * 0.3 + outputTokens * 1.5) / 100` → cents
- **Types:** all in `src/types/database.ts` — `AgentType`, `Brand`, `AgentConfig`, `Task`, `Goal`, etc.
