# Decisions (ADR-class intel)

Extracted from classifications typed `ADR`. Two source documents: `CLAUDE.md` (locked, precedence 0) and `AGENTS.md` (proposed, precedence 1).

`AGENTS.md` is a near-verbatim Codex-facing mirror of `CLAUDE.md`. Only decisions that are unique to `AGENTS.md`, or that differ in wording from `CLAUDE.md`, are given their own entries below. Where the two contradict, see `.planning/INGEST-CONFLICTS.md`.

---

## ADR-CLAUDE-01: Rule Zero — tomorrow's tech for marketing
- source: CLAUDE.md
- status: locked
- decision: "Use today's tech to get things done. Build for tomorrow's tech to get better. Leave yesterday's tech behind." NRS must ALWAYS be at the frontier of marketing technology — content creation, publishing, analytics, compliance enforcement, user interaction. Before building anything, ask: is this how marketing will work in 12 months? If not, research the frontier first, then build to it. "Medium term" = 2 weeks.
- scope: all product decisions, technology selection, roadmap sequencing

## ADR-CLAUDE-02: Build our own technology; third-party tools are temporary bridges
- source: CLAUDE.md
- status: locked
- decision: Build our own technology. Third-party tools are temporary bridges until we build our own. Never sell or position plug-ins as the product.
- scope: integrations, vendor selection, product positioning

## ADR-CLAUDE-03: Publishing via direct platform APIs
- source: CLAUDE.md
- status: locked
- decision: Publishing uses direct platform APIs (Meta Graph, YouTube Data, TikTok Content, LinkedIn). No middleware dependencies. CLI agentic pattern — agent calls platform API directly as a tool.
- scope: social publishing transport

## ADR-CLAUDE-04: Never show plumbing
- source: CLAUDE.md
- status: locked
- decision: Users don't know what Mixpost, Postiz, or OAuth are. They just talk. Infrastructure names must never surface in the UI.
- scope: UI copy, error messages, onboarding

## ADR-CLAUDE-05: First Principle — the user is a non-technical business owner
- source: CLAUDE.md
- status: locked
- decision: "The LLM drives tomorrow's complexity. The user just talks." Conversation-first, not form-first — if data is missing the agent asks for it in chat, never a blank form. Auto-fill everything possible (scan website, sync GitHub, guess social handles) without being asked. Plain language, not jargon. Minimum clicks to value. The agent should know what to do and suggest the next step. Every PR, feature and refactor must be evaluated against this.
- scope: every feature, screen and interaction

## ADR-CLAUDE-06: One screen — brands + chat; the Director is the only face
- source: CLAUDE.md
- status: locked
- decision: One screen: brands + chat. The sidebar shows brands and recent chats. Nothing else — no department buttons, no management links. 14 departments work behind the scenes; the user never sees or picks departments. The Director presents all work as its own.
- scope: navigation, sidebar, agent visibility

## ADR-CLAUDE-07: MCP allowlist — plug-in AIs are messengers, not orchestrators
- source: CLAUDE.md
- status: locked
- decision: NON-NEGOTIABLE. Plug-in AIs (Claude Desktop, Cowork, Claude Code, any external MCP client) hand user intent to `chat_with_director` and wait. They do NOT call multi-step orchestration tools directly, do NOT write marketing copy, do NOT bypass the Review queue. Enforced structurally in `src/lib/mcp/server.ts` via `HIDDEN_FROM_MCP: ReadonlySet<string>` passed to `adaptToolsForMCP(..., hiddenFromMcp)`; hidden tools are never registered on the MCP surface. Hidden: `process_media`, `write_blog`, `write_ads`, `write_email_campaign`, `repurpose_content`, `marketing_audit`, `deep_competitor_scan`, `fill_calendar`, `analyse_voice`, `analyse_content_gaps`, `create_video`, `multi_scene_video`, `generate_video_agent`, `translate_video`, `photo_avatar`, `text_to_speech`, `generate_slides`, `delegate_to_agent`, `convene_meeting`. Still exposed: `list_brands`, `chat_with_director`, `get_director_response`, `draft_post`, `query_media`, `query_calendar`, `query_outputs`, `query_analytics`, `query_social_analytics`, `publish_to_social` (gated by MANDATORY APPROVAL rule), `manage_posts`, `manage_tags`, `save_output`, `generate_image`, `scan_website`, `browse_page`.
- scope: MCP server tool surface, external AI client capability

## ADR-CLAUDE-08: New-tool exposure decision procedure
- source: CLAUDE.md
- status: locked
- decision: When adding a new tool — (1) query-only or bounded single-shot → leave it alone, auto-exposed via `adaptToolsForMCP`; (2) multi-step, writes marketing copy, needs Director reasoning → add to `HIDDEN_FROM_MCP` in `src/lib/mcp/server.ts` AND update the `quick_start` MCP prompt with a before/after example.
- scope: MCP tool registration process

## ADR-CLAUDE-09: MCP auth — Bearer API key and OAuth 2.0 produce the same key type
- source: CLAUDE.md
- status: locked
- decision: NRS is an MCP server at `https://www.notrealsmart.com.au/api/mcp` (Streamable HTTP, stateless). Two auth methods: Bearer token (`nrs_sk_` prefix, SHA-256 hashed in `api_keys`) and OAuth 2.0 (RFC 8414 + RFC 7591 + PKCE S256). Access token = `nrs_sk_` API key; `resolveApiKey()` validates both. Zero duplication.
- scope: MCP authentication

## ADR-CLAUDE-10: Agent execution uses streamText, never ToolLoopAgent
- source: CLAUDE.md
- status: locked
- decision: Director chat (`/api/chat/route.ts`) uses `streamText()` (NOT ToolLoopAgent). `stopWhen: stepCountIs(5)` — max 5 tool-use steps per turn. Streams via `gateway('anthropic/claude-sonnet-4')` with fallbacks. "streamText works, ToolLoopAgent breaks — never switch to ToolLoopAgent for chat."
- scope: chat execution path, AI SDK v6 usage

## ADR-CLAUDE-11: True multi-agent AgentWorker system
- source: CLAUDE.md
- status: locked
- decision: Each department is a genuinely independent agent via `lib/agents/worker.ts` — own model (from `agent_registry.model`), own memory namespace, own tools (`getToolsForAgent()`), own budget, own audit trail, `stopWhen: stepCountIs(3)`, max 4 concurrent workers via `runParallelAgents()`. `delegate_to_agent` spawns an AgentWorker (supports `parallel`); `convene_meeting` spawns N workers via `Promise.allSettled()`; `/api/heartbeat` uses `runAgentWorker` for consistent execution.
- scope: delegation, meetings, heartbeat execution

## ADR-CLAUDE-12: 14 agents — 1 Director plus 13 departments
- source: CLAUDE.md
- status: locked
- decision: Agent types: `overall` (NRS Director), `content`, `seo`, `paid_ads`, `strategy`, `email`, `growth`, `brand`, `competitor`, `website`, `compliance`, `analytics`, `automation`, `video`. `martech` is archived for backward compatibility and not shown in UI. All agents get `read_proforma` + `query_outputs` for cross-agent learning, plus shared management tools `create_task`, `request_approval`, `handoff_to_department`. Departments are INVISIBLE to the user.
- scope: agent roster, tool assignment

## ADR-CLAUDE-13: Rule-based intent router, not an LLM call
- source: CLAUDE.md
- status: locked
- decision: `lib/agents/intent-router.ts` performs rule-based keyword classification returning `{ suggestedAgent, confidence, shouldDelegate }`, injected into the Director's system prompt as routing hints — fast and free (no LLM call). When 2+ departments are detected the Director uses `convene_meeting` instead of `delegate_to_agent`.
- scope: routing, delegation triggers

## ADR-CLAUDE-14: Mixpost self-hosted publisher replaces Ayrshare
- source: CLAUDE.md
- status: locked
- decision: Mixpost Pro on BinaryLane VPS (`https://mixpost.notrealsmart.com.au/mixpost`), Docker at `/opt/mixpost/docker-compose.yml`. Cron publisher uses Mixpost first, Ayrshare as fallback. Replaces Ayrshare ($299/mo) with $0/month self-hosted publishing. Connected: Facebook Pages, Instagram Business, LinkedIn; TikTok pending review. Webhook receiver handles all 9 Mixpost Pro events with HMAC SHA-256 verification on `X-Signature`. Every NRS draft is pushed to Mixpost on save, idempotent via `metadata.mixpost.post_uuid`.
- scope: publishing infrastructure, draft sync, tag sync, webhooks

## ADR-CLAUDE-15: Media processing pipeline is a single source of truth
- source: CLAUDE.md
- status: locked
- decision: `src/lib/media/process-pipeline.ts` — `runMediaProcessingPipeline({supabase, mediaItemId, runStages?})` is the ONE canonical function owning all `media_items` mutations touching thumbnails, transcription, AI tagging and the per-stage processing report. Both `/api/media/process` and the Director's `process_media` tool delegate to it. No other pipeline exists. Stages: thumbnail (ffmpeg fast-seek, 30s kill timeout), transcription (Deepgram nova-2 → Whisper fallback, <100MB), AI (Claude vision or transcript analysis). Per-stage report at `metadata.processing`; failures never cascade.
- scope: media ingestion, transcription, tagging

## ADR-CLAUDE-16: media_items has no `status` column — #CRITICAL schema gotcha
- source: CLAUDE.md
- status: locked
- decision: `media_items` has `transcription_status` but NO `status` column. Any update including `status: ...` is rejected entirely by PostgREST (PGRST204) and silently drops the rest of the update with it. Check `src/types/database.ts:MediaItem` before adding any update.
- scope: media_items writes

## ADR-CLAUDE-17: Never ask the user to open DevTools — build self-reporting diagnostics
- source: CLAUDE.md
- status: locked
- decision: #CRITICAL. Never ask the user to open Chrome DevTools, Network tab or console — it violates the non-technical-user First Principle. Instrument the CLIENT to POST breadcrumbs to a server endpoint and query them from the terminal with the admin client. Pattern in place: `MediaUploader.tsx` → `/api/debug/upload-log` → `audit_log` (`action='upload_debug'`) → `node scripts/read-upload-trace.mjs`. Extend this pattern for new classes of client-side bug.
- scope: debugging workflow, client instrumentation

## ADR-CLAUDE-18: Compliance filter runs automatically before saving outputs
- source: CLAUDE.md
- status: locked
- decision: `lib/agents/compliance-filter.ts` uses Claude Haiku to evaluate content against AHPRA/TGA rules before saving outputs, returning `{ isValid, flags, warnings }`. Runs automatically in the `save_output` tool. AHPRA/TGA penalties are $60K/$120K per offence.
- scope: output persistence, healthcare compliance

## ADR-CLAUDE-19: Memory system is Ruflo, with mem0 as the planned replacement
- source: CLAUDE.md
- status: locked
- decision: Current: `lib/ruflo/client.ts` search + store via Supabase `agent_memories`; namespaces `nrs-{brandSlug}-{agentType}` per brand per department plus `nrs-agency` global; regex extraction; `buildSystemPromptWithMemory()` injects up to 15 memories (10 local + 5 global). Known limitations: keyword search only (no semantic), regex extraction misses ~40-60% of insights, no deduplication, no importance scoring, no memory decay. Planned replacement: mem0 self-hosted on Supabase pgvector — LLM-based fact extraction, semantic vector search, memory consolidation, graph relationships.
- scope: agent memory, prompt construction

## ADR-CLAUDE-20: Planned major builds
- source: CLAUDE.md
- status: locked
- decision: (1) mem0 memory system — replace Ruflo with semantic search, LLM extraction, graph memory. (2) Self-updating knowledge — daily research cron so agents stay current with AI/marketing trends.
- scope: roadmap

## ADR-CLAUDE-21: Stack selection
- source: CLAUDE.md
- status: locked
- decision: Next.js 15.3 (NOT 16), React 19, Tailwind CSS 4 (oklch only), shadcn/ui v4 (base-ui — use `render` prop, NOT `asChild`), Supabase (3 clients: browser, server, admin — don't mix), Vercel AI SDK v6 `streamText` + AI Gateway (auto-injected via `@ai-sdk/gateway`, never configure manually), Stripe, Resend, GSAP + Motion, IBM Plex Sans + Mono, lucide-react, zustand, Zod v4 with `zod/v3` import path for AI SDK tool schemas.
- scope: framework and library selection

## ADR-CLAUDE-22: Room-based navigation — three rooms
- source: CLAUDE.md
- status: locked
- decision: The agency UI is organised into 3 rooms (tabs in header): Director's Office (`/agency/chat`), Creative Studio (`/agency/studio`) with sub-tabs All Content (dashboard), Calendar, Media, Create, Grid Planner; and Command Centre (`/agency/tasks`) with sub-tabs Tasks, Agents, Approvals, Costs, Analytics, Activity. Config in `src/lib/room-config.ts`.
- scope: top-level navigation, Creative Studio sub-tabs

## ADR-CLAUDE-23: Flat route structure, no route groups
- source: CLAUDE.md
- status: locked
- decision: No route groups — flat routes only. `force-dynamic` on pages with base-ui components.
- scope: Next.js app router structure

## ADR-CLAUDE-24: Homepage and Three.js are off-limits
- source: CLAUDE.md
- status: locked
- decision: NEVER touch the homepage (`src/app/page.tsx`, WaterRippleHero). NEVER use Three.js for new features — use CSS/SVG/Canvas 2D only; Three.js exists only for the landing/about heroes.
- scope: landing page, animation technology

## ADR-CLAUDE-25: Australian English and oklch silver/chrome palette
- source: CLAUDE.md
- status: locked
- decision: Australian English throughout (colour, behaviour, organisation). oklch colours only, silver/chrome palette, hue ~240. IBM Plex font.
- scope: copy, styling

## ADR-CLAUDE-26: Key conventions — budget, audit, registry, cost, types
- source: CLAUDE.md
- status: locked
- decision: Budget in cents (integer, no floating point). Audit log is append-only — no UPDATE/DELETE policies. Agent configs = templates in `agent_configs`; agent registry = runtime state in `agent_registry` (per user). Default model `anthropic/claude-sonnet-4`, overridable per agent in registry. Cost calculation `(inputTokens * 0.3 + outputTokens * 1.5) / 100` → cents. Trigger function is `update_updated_at()` not `update_updated_at_column()`. Types all in `src/types/database.ts`.
- scope: billing, auditing, data model conventions

## ADR-CLAUDE-27: Correct repository and credential handling
- source: CLAUDE.md
- status: locked
- decision: The correct repo is `~/NotRealSmartAgency`, NOT `~/notrealsmart` (old repo, superseded). Supabase creds and the DB password are in `.env.local` — never ask for them, never hardcode, never commit. Test locally before pushing (`npm run dev` + check in browser); `npm run build` and `npm run lint` must both pass clean before claiming a feature complete.
- scope: repository location, secrets, verification

## ADR-CLAUDE-28: gbrain brain-first is mandatory; no paid third-party AI APIs
- source: CLAUDE.md
- status: locked
- decision: Before any external API, web search, or figuring something out from scratch, run `gbrain search "<topic>"` or `gbrain query "<q>"`. Capture is ambient to `~/Obsidian/`. Cite brain-derived claims as `(per ~/Obsidian/<path>:<line>)` or `(per gbrain slug:<slug>)`. Skillify on the third repeat. No paid third-party AI APIs: embeddings via local Ollama (`nomic-embed-text`); no Anthropic / OpenAI direct keys for new code.
- scope: research workflow, embeddings provider, knowledge capture

## ADR-CLAUDE-29: Read the Creative Studio specs before any Creative Studio work
- source: CLAUDE.md
- status: locked
- decision: MANDATORY before touching any Creative Studio code (Creator, Review, Schedule, Media): read `~/Obsidian/Reference/nrs-creative-studio-definitive-architecture.md`, `~/NotRealSmartAgency/2026-04-08-post-creator-redesign.md`, and `~/Obsidian/Reference/nrs-creative-studio-redesign-research.md`. Key architecture: Creator is THE centre; three entry points (Media→Creator, fresh Creator, Review→Creator); Director is the expert marketer who delegates to 13 agents; any AI plugs into the Director via MCP. Build to spec, never patch.
- scope: Creative Studio development process

## ADR-CLAUDE-30: Superpowers development workflow is mandatory
- source: CLAUDE.md
- status: locked
- decision: Use `brainstorming` before building, `writing-plans` before coding, `test-driven-development` during coding (RED-GREEN-REFACTOR, no code without a failing test), `dispatching-parallel-agents` for parallel work, `subagent-driven-development` for multi-task execution, `systematic-debugging` when debugging, `verification-before-completion` before completing, `requesting-code-review` + `receiving-code-review` for review, `finishing-a-development-branch` for branches.
- scope: development process

## ADR-CLAUDE-31: Team access model and RLS helper functions
- source: CLAUDE.md
- status: locked
- decision: `team_members` table with roles (`owner`, `admin`, `viewer`) and optional per-brand access (`brand_ids UUID[]`, NULL = all brands). Invite flow via Resend email with token link; auto-accept on signup via updated `handle_new_user()` trigger. Three RLS helper functions (`is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand`) replace all 16 table policies.
- scope: multi-user access, RLS

## ADR-CLAUDE-32: Hybrid API-key resolution
- source: CLAUDE.md
- status: locked
- decision: Most third-party keys are checked in `user_integrations` first (power users), then fall back to the env var so out-of-box users get everything. Applies to Canva and Ayrshare tools (`CANVA_API_KEY`, `AYRSHARE_API_KEY`).
- scope: integration credentials

## ADR-CLAUDE-33: Master Marketing Proforma — 21 sections per brand
- source: CLAUDE.md
- status: locked
- decision: Each brand has a 21-section structured living document in `brand_proforma_sections`: executive_snapshot, client_profile, brand_fundamentals, audience, market_context, compliance_profile, business_goals, funnel_map, channel_website, channel_seo, channel_social, channel_paid, channel_email, content_creative, competitors, kpi_dashboard, gaps_opportunities, wins_losses, risk_register, decision_log, thirty_sixty_ninety. Each has RAG status, review cadence, staleness tracking. Auto-populated from brand data.
- scope: brand knowledge model

## ADR-AGENTS-01: Always call list_brands first and trust the tools
- source: AGENTS.md
- status: proposed
- decision: ALWAYS call `list_brands` first to get brand IDs before using any NRS tool. Trust the tools — don't validate Mixpost accounts or social connections yourself, the tools handle matching internally. If a tool fails, read the error message and report it; don't guess why it failed. Use `chat_with_director` for complex/multi-step requests and individual tools for simple single-task requests. Never tell the user accounts aren't connected unless the tool specifically returns that error.
- scope: MCP client tool usage

## ADR-AGENTS-02: Never cross-post between brands
- source: AGENTS.md
- status: proposed
- decision: Each brand has its own identity. NEVER cross-post between brands. Always confirm which brand the user means before publishing.
- scope: publishing, brand separation

## ADR-AGENTS-03: Health-brand content restrictions
- source: AGENTS.md
- status: proposed
- decision: Health brands (Downscale, TeleScribe, DownscaleDerm, EndorseMe) are AHPRA/TGA regulated — $60K fines per offence. Health content: no testimonials, no before/after, no guaranteed outcomes, no naming specific medications. Scent Sell and NRS are NOT health brands — no compliance restrictions.
- scope: content compliance per brand

## ADR-AGENTS-04: Audience targeting per brand
- source: AGENTS.md
- status: proposed
- decision: TeleScribe targets clinicians (GPs, NPs, allied health), NOT patients. Downscale targets patients, NOT clinicians. Check the brand's tone and voice before writing — each brand has its own personality.
- scope: audience, voice

## ADR-AGENTS-05: Show the content, wait for approval, then publish
- source: AGENTS.md
- status: proposed
- decision: Never schedule posts without telling the user what's being posted and when. Always include the post caption in the response so the user can review before publishing. One action at a time — don't batch-publish 5 posts without approval. Show the content, wait for approval, then publish. When in doubt, ask the user rather than guess.
- scope: publishing approval workflow

## ADR-AGENTS-06: Calendar duplicate avoidance
- source: AGENTS.md
- status: proposed
- decision: Scheduled posts auto-appear in Google Calendar via the iCal feed. `query_calendar` shows upcoming posts — use it when the user asks "what's planned". Don't create duplicate posts; check the calendar first.
- scope: scheduling, calendar

## ADR-AGENTS-07: Connected social accounts per brand (as recorded)
- source: AGENTS.md
- status: proposed
- decision: Downscale — Facebook, Instagram, LinkedIn. TeleScribe — Facebook (x2), Instagram, YouTube, TikTok. Scent Sell — Facebook, Instagram (x2), YouTube. DownscaleDerm — Facebook, Instagram. Man Clinic — Facebook. EndorseMe — Facebook. Justin Black — LinkedIn (personal).
- scope: Mixpost account inventory
