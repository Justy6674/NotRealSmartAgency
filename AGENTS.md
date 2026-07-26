# AGENTS.md

<!-- gbrain:project:v1 BEGIN — managed by gbrain-integration plan; do not edit between markers -->
## gbrain — central compounding brain (MANDATORY)

Every session in this project uses gbrain as the central knowledge layer. Full rules: `~/.claude/CLAUDE.md` (Claude Code) and `~/.codex/AGENTS.md` (Codex), `~/AGENTS.md` (workspace-wide). Short version for this project:

- **Brain-first**: before any external API, web search, or "let me figure it out", run `gbrain search "<topic>"` or `gbrain query "<q>"`. The brain already knows things from prior sessions on this and other projects.
- **Capture is ambient**: significant decisions, learnings, and entity mentions auto-flow to `~/Obsidian/` via the `signal-detector` skill. Don't ask, let it run.
- **Cite from the brain**: any factual claim from the brain gets `(per ~/Obsidian/<path>:<line>)` or `(per gbrain slug:<slug>)`.
- **Skillify on the third repeat**: solved something twice + >20 LoC + a real trigger phrase? Run `gbrain skillify scaffold <name>` then `gbrain skillify check`.
- **No paid third-party AI APIs**: embeddings via local Ollama (`nomic-embed-text`). No Anthropic / OpenAI direct keys for new code.

**Commands**: `gbrain search`, `gbrain query`, `gbrain stats`, `gbrain doctor`, `gbrain skillify {scaffold,check}`, `gbrain extract links --source db`.
<!-- gbrain:project:v1 END -->


This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## MANDATORY: Read Before ANY Creative Studio Work

Before touching ANY Creative Studio code (Creator, Review, Schedule, Media, or related components), you MUST read:
- `~/Obsidian/Reference/nrs-creative-studio-definitive-architecture.md` — the complete architecture spec
- `~/NotRealSmartAgency/2026-04-08-post-creator-redesign.md` — the 10-card Creator spec
- `~/Obsidian/Reference/nrs-creative-studio-redesign-research.md` — competitor patterns

**Key architecture:** Creator is THE centre. Three entry points (Media→Creator, fresh Creator, Review→Creator). Director is the expert marketer who delegates to 13 agents. Any AI (Cowork, Codex Desktop) plugs into the Director via MCP. Build to spec, never patch.

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

## Session Start Checklist (every new Codex session)

1. If the task touches Creator / Review / Schedule / Media → read the three specs in the MANDATORY block above **before** any code.
2. Confirm you are in `~/NotRealSmartAgency` (not `~/notrealsmart`).
3. Confirm Supabase CLI is linked to `uyhtrwlotoriblicqqrl` per the global SUPABASE CLI GATE.
4. Skim the Memory Index (`~/.Codex/projects/-Users-jb-downscale-NotRealSmartAgency/memory/MEMORY.md`) — the `feedback_*` and `#CRITICAL` entries override defaults.
5. Plan mode first if the task touches files; answer directly if it's a question.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — NOT Turbopack for Vercel compat)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9)
```

**Testing:** No test runner configured. Verification is manual: `npm run dev`, hit the feature in the browser, check the Supabase row, check the network tab. Before claiming a feature complete, also run `npm run build` and `npm run lint` — both must pass clean.

**Environment variables** (all in `.env.local`, never commit):
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **AI**: `ANTHROPIC_API_KEY` (AI Gateway auto-injected on Vercel, no config needed locally either)
- **Publishing**: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`, `AYRSHARE_API_KEY` (fallback)
- **Media/Video**: `CANVA_API_KEY`, `DEEPGRAM_API_KEY`, `OPENAI_API_KEY` (Whisper fallback)
- **Payments/Email**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`
- **MCP/OAuth**: `MCP_OAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`

Hybrid pattern: most third-party keys are checked in `user_integrations` first (power users), then fall back to the env var (so out-of-box users get everything).

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
Canva and Ayrshare tools check `user_integrations` first (power users), then fall back to env vars
(`CANVA_API_KEY`, `AYRSHARE_API_KEY`). Users get everything out of the box.

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

Before building or modifying agent execution, tool systems, memory, MCP integrations, or any agentic features in NotRealSmart, **load the Codex architecture skill first**:

```
/ai-agent-architecture
```

This provides production-proven patterns from Codex's source (2,200 files analysed) including:
- **Agent loop**: async generator pattern, state machine, error recovery
- **Tool system**: concurrency partitioning, streaming execution, fail-closed defaults
- **Sub-agents**: 5 agent types, context inheritance, coordinator mode
- **Permissions**: multi-layer security model
- **Context management**: 4 compaction strategies for long conversations
- **Memory**: auto-extraction, 4-type taxonomy, injection patterns

Full reference: `~/Obsidian/Reference/Codex-architecture.md`

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

- **NRS video stack**: Remotion (React) + cloud GPU (Modal/RunPod) for programmatic video
- **AI voiceover**: Qwen3-TTS voice cloning — free, runs on your GPU, brand voice matching
- **Image generation**: FLUX.2 for video scene frames — free on Modal's $30/mo starter
- **AI music**: ACE-Step royalty-free music generation
- **Commands**: `/video-setup`, `/video-video`, `/video-template`, `/video-brand`, `/video-generate-voiceover`
- **Python tools**: `~/.Codex/video-toolkit-tools/` (22 scripts: voiceover, image gen, music, upscale, face animation)
- **Templates**: Product demos, sprint reviews — extensible for marketing content

Integration points in NotRealSmart:
- `lib/video-toolkit/client.ts` — owned voiceover, image and music generation endpoints
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
6. Streams via `gateway('anthropic/Codex-sonnet-4')` with fallbacks
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
Users can paste (Cmd+V) or drag/drop images into chat. Images are sent as AI SDK v6 `FileUIPart` (base64 data URL) so Codex actually sees them. Video/audio still goes through the media upload pipeline.

### Post Signature Branding
Per-brand `post_signature` JSONB field on `brands` table. Three formats: plain text, `@mention`, or `#hashtag`. Injected into all agent system prompts as a mandatory attribution rule. Also appended by the cron publisher to scheduled posts before publishing via Mixpost/Ayrshare.

### Mixpost Integration
- **Client**: `lib/mixpost/client.ts` — fetches connected accounts, media, tags, creates posts
- **Brand mapping**: `lib/mixpost/brand-mapping.ts` — fuzzy matches Mixpost account names to NRS brands
- **Auto-greet**: ChatInterface checks Mixpost accounts and shows "Socials: Instagram, Facebook, LinkedIn (connected via Mixpost)" instead of "Still missing: social profiles"
- **API**: `/api/mixpost/accounts` — cached endpoint for brand-to-social mapping
- **Draft sync** (`lib/mixpost/sync-draft.ts`): `syncDraftToMixpost(admin, postId)` pushes every NRS draft into Mixpost on save — idempotent via `metadata.mixpost.post_uuid`. Fired `void`-style from `POST /api/scheduled-posts`. Bug fixed 2026-04-10: `ensureMediaInMixpost`'s media_items cache writeback was originally fire-and-forget (`void supabase.update(...)`) which silently dropped and caused repeat ~6-min video transcodes — now awaited.
- **Tag sync** (`lib/mixpost/sync-tags.ts`): `ensureBrandTagInMixpost` + `ensureHashtagGroupTagInMixpost` mirror NRS brand names and hashtag_group names into Mixpost tags. Auto-attached to every draft during `syncDraftToMixpost` so Mixpost's library filter works by brand. Cached via `brands.mixpost_tag_id` + `hashtag_groups.mixpost_tag_id` (migration 032).
- **Webhook receiver** (`/api/webhooks/mixpost/route.ts`): handles all 9 Mixpost Pro events — `post.created`, `post.updated`, `post.scheduled`, `post.published`, `post.publishing_failed`, `post.deleted`, `account.{added,updated,deleted}`. HMAC SHA-256 verification on `X-Signature` header. **Setup guide: `~/Obsidian/Reference/nrs-mixpost-webhook-setup.md`** — register the webhook once in Mixpost admin UI and paste the secret into `MIXPOST_WEBHOOK_SECRET`. **Event catalogue: `~/Obsidian/Reference/nrs-mixpost-webhooks.md`** — full list derived from Mixpost Pro Laravel source on the VPS.
- **Review iframe** (`components/agency/studio/ReviewRoom.tsx` + `review/DraftCard.tsx`): "Preview in Mixpost" button embeds the actual Mixpost edit screen as a 95vw×92vh iframe. Made possible by VPS nginx stripping `X-Frame-Options` and setting `frame-ancestors` CSP scoped to NRS hosts (configured 2026-04-10). DraftCard shows a "Syncing…" pill until `metadata.mixpost.post_uuid` is set, then becomes a clickable "Preview" pill.
- **Backfill scripts**: `scripts/backfill-drafts-to-mixpost.ts` and `scripts/backfill-tags-to-mixpost.ts` — one-shot catch-up for existing data. Idempotent.

### Platform Algorithm Intelligence
`lib/agents/knowledge/social-media-benchmarks.ts` includes deep platform-specific algorithm knowledge:
TikTok (watch time, completion rate, hook requirements), Instagram (saves/shares weighted, carousel re-engagement, Reels priority), LinkedIn (dwell time, polls, document posts), Facebook (group engagement vs dead page reach), X/Twitter (reply visibility, thread structure, pain-signal discovery), YouTube (CTR + watch time, thumbnail importance). Cross-platform growth tactics: content capsule model, repurposing chains, anti-AI detection, feedback loops.

### Canva Integration
`design_graphic` and `export_design` tools use Canva MCP (connected via `mcp__claude_ai_Canva__*`). Creative Studio's Create tab also provides direct Canva access. Brand agent and Director can generate designs, search templates, export to formats.

### MCP Server — CLI & AI Client Access (LIVE)
NRS is an MCP server. Users connect from Codex Desktop (includes Cowork), Codex Mobile, terminal Codex, or any MCP-compatible AI client.

**Endpoint:** `https://www.notrealsmart.com.au/api/mcp` (Streamable HTTP, stateless)

**Two auth methods:**
1. **Bearer token** — user creates API key in Settings, adds to config. Key prefix `nrs_sk_`, SHA-256 hashed in `api_keys` table.
2. **OAuth 2.0** — user clicks "Add custom connector" in Codex Desktop/Mobile, logs in via `/mcp-login`, token issued automatically. Full RFC 8414 + RFC 7591 + PKCE S256.

**Access token = nrs_sk_ API key.** Both auth methods produce the same key type. The MCP server's `resolveApiKey()` validates both. Zero duplication.

#### MCP ALLOWLIST — plug-in AIs don't orchestrate, the Director does (NON-NEGOTIABLE)
**Plug-in AIs are MESSENGERS.** Codex Desktop, Cowork, Codex, any external MCP client — they hand user intent to `chat_with_director` and wait. They do NOT call multi-step orchestration tools directly, do NOT write marketing copy, do NOT bypass the Review queue.

Enforced structurally in `src/lib/mcp/server.ts` via `HIDDEN_FROM_MCP: ReadonlySet<string>` passed to `adaptToolsForMCP(..., hiddenFromMcp)`. Hidden tools are **never registered** on the MCP surface — they exist only inside the Director's internal AI SDK tool loop.

**Currently hidden from MCP (MUST call chat_with_director instead):**
- Media orchestration: `process_media`
- Content writing: `write_blog`, `write_ads`, `write_email_campaign`, `repurpose_content`
- Multi-step analysis/planning: `marketing_audit`, `deep_competitor_scan`, `fill_calendar`, `analyse_voice`, `analyse_content_gaps`
- Media generation: `create_video`, `multi_scene_video`, `generate_video_agent`, `translate_video`, `photo_avatar`, `text_to_speech`, `generate_slides`
- Director-internal primitives: `delegate_to_agent`, `convene_meeting`

**Still exposed on MCP (safe for direct plug-in access):**
- Conversational entry points: `list_brands`, `chat_with_director`, `get_director_response`, `draft_post`
- Read-only queries: `query_media`, `query_calendar`, `query_outputs`, `query_analytics`, `query_social_analytics`
- Bounded single-shot actions: `publish_to_social` (gated by MANDATORY APPROVAL rule), `manage_posts`, `manage_tags`, `save_output`, `generate_image`, `scan_website`, `browse_page`

**Adding a new tool — decide exposure:**
1. Query-only or bounded single-shot? → leave it alone, auto-exposed via `adaptToolsForMCP`.
2. Multi-step, writes marketing copy, needs Director reasoning? → add to `HIDDEN_FROM_MCP` in `src/lib/mcp/server.ts` AND update the `quick_start` MCP prompt with a before/after example.

**Resources:** `brands://list` — all user's brands.

**Key files:**
- `src/app/api/mcp/route.ts` — MCP HTTP handler
- `src/lib/mcp/server.ts` — McpServer factory + `HIDDEN_FROM_MCP` allowlist + `quick_start` prompt
- `src/lib/mcp/tool-adapter.ts` — `adaptToolsForMCP(..., hiddenFromMcp)` filter
- `src/lib/mcp/director-chat.ts` — chat_with_director (sync entry, kicks async job)
- `src/lib/mcp/director-job.ts` — the async Director run
- `src/lib/mcp/director-job-tool.ts` — get_director_response (poll)
- `src/lib/mcp/draft-post-tool.ts` — draft_post (sync Content & Copy shortcut)
- `src/lib/auth/api-key.ts` — key generation + validation
- `src/app/api/mcp/authorize/route.ts` — OAuth authorize
- `src/app/api/mcp/token/route.ts` — OAuth token exchange
- `src/app/mcp-login/page.tsx` — branded OAuth login page

**Team invite emails** include step-by-step setup for web, Codex Desktop/Mobile (OAuth), and Codex (API key + "tell Codex to connect").

Full reference: `~/Obsidian/Reference/nrs-mcp-architecture.md`.

### Media Processing Pipeline — single source of truth
**File:** `src/lib/media/process-pipeline.ts` — `runMediaProcessingPipeline({supabase, mediaItemId, runStages?})`.

ONE canonical function owns all media_items row mutations that touch thumbnails, transcription, AI tagging, or the per-stage processing report. Both the HTTP route `/api/media/process` (browser uploads) AND the Director's `process_media` tool delegate to it. No other pipeline exists.

**Stages:**
1. **Thumbnail** (videos only) — `extractFirstFrameFromUrl()` runs `ffmpeg -ss 1 -i <https-url> -frames:v 1`. Fast-seek before input streams only the bytes needed for frame 1. Memory-safe for 500 MB files on Vercel serverless. Hard 30s kill timeout. Thumb uploaded to `{path}_thumb.jpg` in the media bucket.
2. **Transcription** (video/audio < 100MB) — `transcribeFile()` → Deepgram nova-2 URL mode → Whisper fallback. Persists to `transcription`, `transcription_model`, `transcription_status`, `duration_seconds`.
3. **AI** — Codex vision (images) or transcript analysis (video/audio). Persists to `ai_description` + extends `tags`.

**Per-stage report** at `metadata.processing` with `{status, error?, duration_ms?}` per stage. Merges prior reports (doesn't clobber). Failures never cascade.

**Schema gotcha — #CRITICAL:** `media_items` has `transcription_status` but **NO `status` column**. Any update that includes `status: ...` is rejected entirely by PostgREST (PGRST204) and silently drops the rest of the update with it. This exact bug cost a full session — the Director's `process_media` tool was transcribing successfully but losing the result to a `status: 'transcribed'` write. Check `src/types/database.ts:MediaItem` before adding any update.

**Related files:**
- `src/lib/video/ffmpeg-thumbnail.ts` — `extractFirstFrame(buffer)` + `extractFirstFrameFromUrl(url)`
- `src/lib/transcription/transcribe.ts` — 2-layer Deepgram/Whisper
- `src/lib/media/auto-tagger.ts` — deterministic + AI tags
- `scripts/run-pipeline.ts` — invoke against any row (`npx tsx scripts/run-pipeline.ts <uuid>`)
- `scripts/verify-media-state.mjs` — dump full row state
- `scripts/backfill-media-processing.mjs` — system-ffmpeg backfill for legacy rows

Full reference: `~/Obsidian/Reference/nrs-media-processing-pipeline.md`.

### Upload diagnostics without DevTools — #CRITICAL
**Never ask the user to open Chrome DevTools, Network tab, or console.** That violates the non-tech-user First Principle at the top of this file. Justin is not a developer; he uses the Codex app (which contains Cowork) and the terminal Codex CLI — nothing else.

When a client-side flow (upload, chat, preview) hangs and needs diagnosis, instrument the CLIENT to POST breadcrumbs to a server endpoint and query them from the terminal with the admin client. Build-time pattern in place for media uploads:

- Client: `src/components/agency/MediaUploader.tsx` calls `log(traceId, step, data)` which both `console.log`s AND fires `fetch('/api/debug/upload-log', { keepalive: true })` for each breadcrumb. Each log includes the `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` so stale-cache bundles are obvious.
- Server: `src/app/api/debug/upload-log/route.ts` persists to `audit_log` with `action='upload_debug'`, `entity_type='media_upload_trace'`, `entity_id=<trace_id>`.
- Terminal: `node scripts/read-upload-trace.mjs` — prints all breadcrumbs grouped by trace_id with millisecond timings.

When a new class of client-side bug appears, extend this pattern rather than asking the user to paste logs. See feedback memory `feedback_no_devtools_for_user.md` for the full rationale.

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
Video agent writes platform-specific scripts, shot lists, captions and production briefs (Reels, TikTok, YouTube, LinkedIn). Scripts are saved as `video_script` outputs with AHPRA/TGA compliance checking. Owned video-toolkit endpoints provide optional voiceover, image and music assets; an approved external renderer can be added later behind an explicit capability contract.

### "Review My Brand" Flow
Brand cards have "Review Brand" button → `POST /api/brands/{brandId}/review` runs website + GitHub + social scans in parallel → builds structured message → stores in Zustand `pendingReviewMessage` → redirects to Director chat → ChatInterface auto-sends → triggers 6-department meeting (competitor, SEO, content, analytics, compliance, website).

### Compliance Filter
`lib/agents/compliance-filter.ts` — uses Codex Haiku to evaluate content against AHPRA/TGA rules before saving outputs. Returns `{ isValid, flags, warnings }`. Runs automatically in `save_output` tool.

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

**Dashboard sections** (in order): Director's Brief, Social Connections (Mixpost), Week-at-a-Glance, Drafts Awaiting Action, Strategy & Pillars, Canva Designs, Video Plans, Competitor Intel, Agent Activity Ticker, Recent Content Feed.

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
- **Default model:** `anthropic/Codex-sonnet-4` (overridable per agent in registry)
- **Cost calculation:** `(inputTokens * 0.3 + outputTokens * 1.5) / 100` → cents
- **Types:** all in `src/types/database.ts` — `AgentType`, `Brand`, `AgentConfig`, `Task`, `Goal`, etc.

## Imported Claude Cowork project instructions

## NotRealSmart Agency — Project Rules

  ### Tool Usage
  - ALWAYS call list_brands first to get brand IDs before using any NRS tool
  - Trust the tools. Don't validate Mixpost accounts or social connections yourself — the tools handle matching internally
  - If a tool fails, read the error message and report it. Don't guess why it failed
  - Use chat_with_director for complex/multi-step requests. Use individual tools for simple single-task requests
  - Never tell the user accounts aren't connected unless the tool specifically returns that error

  ### Connected Social Accounts (Mixpost)
  - Downscale: Facebook, Instagram, LinkedIn
  - TeleScribe: Facebook (x2), Instagram, YouTube, TikTok
  - Scent Sell: Facebook, Instagram (x2), YouTube
  - DownscaleDerm: Facebook, Instagram
  - Man Clinic: Facebook
  - EndorseMe: Facebook
  - Justin Black: LinkedIn (personal)

  ### Brand Rules
  - Each brand has its own identity. NEVER cross-post between brands
  - Health brands (Downscale, TeleScribe, DownscaleDerm, EndorseMe) are AHPRA/TGA regulated — $60K fines per offence
  - Health content: no testimonials, no before/after, no guaranteed outcomes, no naming specific medications
  - Scent Sell and NRS are NOT health brands — no compliance restrictions
  - Always confirm which brand the user means before publishing

  ### Content Rules
  - Australian English throughout (colour, behaviour, organisation)
  - Check the brand's tone and voice before writing — each brand has its own personality
  - TeleScribe targets clinicians (GPs, NPs, allied health). NOT patients
  - Downscale targets patients. NOT clinicians
  - Never schedule posts without telling the user what's being posted and when
  - Always include the post caption in your response so the user can review before publishing

  ### Calendar
  - Scheduled posts auto-appear in Google Calendar via iCal feed
  - query_calendar shows upcoming posts. Use it when the user asks "what's planned"
  - Don't create duplicate posts — check the calendar first

  ### When in Doubt
  - Ask the user rather than guess
  - One action at a time — don't batch-publish 5 posts without approval
  - Show the content, wait for approval, then publish

<!-- gbrain:fragrance:v1 BEGIN — fragrance-specific gbrain mandate; managed by gbrain-integration plan -->
## gbrain — fragrance compounding (MANDATORY for sniffopotamus, scent-australia, ScentSell, NRS-fragrance work)

The fragrance projects are the highest-signal compounders in the brain. Every blind-buy verdict, every wear-log insight, every catalogue refresh, every supplier note, every layering combo, every customer DM that mentions a fragrance MUST flow to `~/Obsidian/` so the next session inherits it. This is non-negotiable.

**Where fragrance knowledge lives in the vault (search these first via `gbrain search`):**
- `~/Obsidian/Strategy/*sniffbot*`, `*sniffopotamus*`, `*scentsell*` — business cases, gap analyses, launch plans
- `~/Obsidian/Reference/*sniffbot*`, `*sniffopotamus*`, `*scentsell*`, `*fragrantica*`, `*parfumo*` — architecture, supplier integrations, AU retailer mappings, ReasoningBank designs
- `~/Obsidian/Sessions/*sniff*`, `*scent*` — past R&D sessions, what was tried, what worked, what broke
- `~/Obsidian/Decisions/` filter by fragrance keywords — pricing, hallucination-prevention, blind-buy gates

**MANDATORY before any fragrance-project work:**
1. `gbrain search "<fragrance name>"` AND `gbrain search "<problem>"` BEFORE writing new code or research. Past Sniffbot R&D ran for weeks and burned $700 of API; the answers to most "have we tried this?" questions are already in the brain.
2. After any non-trivial fragrance discovery (new supplier, new layering combo, new accuracy rule, new ReasoningBank pattern), write a note to `~/Obsidian/Reference/<topic>.md` OR `~/Obsidian/Decisions/<YYYY-MM-DD>-<topic>.md`. Don't keep it in chat.
3. When a fragrance-related solution surfaces 2-3 times across sniffopotamus / scent-australia / ScentSell, run `gbrain skillify scaffold <name>` so the next session uses it as a skill instead of re-solving.
4. **Cross-project mandate**: a Sniffbot insight applies to ScentSell oracle, to scent-australia marketplace, to Sniffopotamus.com consumer app. Save it ONCE in `~/Obsidian/` and reference from all three projects.

**Sniffbot production layers** (do not conflate):
- User-facing Sniffbot: Vercel MCP at `mcp.scentsell.com.au` + Supabase Edge Functions (`sniffbot-oracle`, `sniffbot-memory-maintenance`, `sniffbot-distill-trajectory`, `sniffbot-job-worker`). Real paying users. Stays where it is.
- Local R&D: Python agents in `~/sniffopotamus/agents/layer1/*.py` (fragrance_enrichment, description, oracle, discovery, image, notes, brand-country, scent-family, perfumer). Replace Vercel AI Gateway → Ollama Cloud Gemma 4 or local Ollama when reusing, never re-add `ANTHROPIC_API_KEY` direct.

**Compounding triggers** (any of these → MUST search brain first, MUST capture result):
- "blind buy", "should I buy", "is X worth it", "is X authentic", "decant vs full bottle"
- "layering", "combo", "what wears well with X"
- "perfumer", "house style", "discontinued", "reformulation"
- "supplier", "AU stock", "MECCA", "Libertine", "Adore", "Chemist Warehouse"
- "Parfumo", "Basenotes", "Fragrantica" (with NEVER scraping Fragrantica — ToS issue)
- "couples scent", "what does my partner wear", "gift fragrance"
<!-- gbrain:fragrance:v1 END -->
