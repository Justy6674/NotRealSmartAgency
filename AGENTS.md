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


This file provides guidance to Claude Code (claude.ai/code) and to any other coding agent working in this repository.

> ## Repair note — read this before you trust a string in here
>
> **This document was damaged by a global find/replace of "Claude" → "Codex".** It
> rewrote prose, file paths and model identifiers indiscriminately, producing
> artefacts such as `anthropic/Codex-sonnet-4`, `~/.Codex/projects/`,
> `~/Obsidian/Reference/Codex-architecture.md` and "Codex Desktop". None of those
> were ever real. Repaired **2026-08-17** against the live source tree, the live
> Gateway catalogue and the live Supabase schema.
>
> Two things to carry forward:
>
> 1. **If you find another `Codex`-shaped artefact anywhere in this repo, it is
>    almost certainly this same find/replace, not a deliberate choice.** Fix it,
>    and say so.
> 2. **Reversing the replacement is not sufficient.** Several of those strings
>    were already wrong before the corruption — `anthropic/claude-sonnet-4` was
>    never the model this app runs. Every model id, count and path below has been
>    re-derived from source in the same pass; where a number could not be
>    verified it says so rather than guessing.
>
> The same repair pass corrected claims that had simply gone stale: an "Ayrshare
> fallback" that no longer exists, "no test runner configured" against 181 test
> files, a `HIDDEN_FROM_MCP` denylist that was inverted into an allowlist, and
> eleven agent tools that were removed or never built.
>
> ### Second pass, same day — the repair itself introduced errors
>
> A fact-check against source and live Supabase on **2026-08-17** found eight
> false claims in this file. Fixed:
>
> | Was claimed | Actually |
> |---|---|
> | "Every publishing path goes through `dispatcher.ts`" | Only the cron does. See Publishing → Migration status |
> | `publish-now` uses "(same dispatcher)" | It calls `createMixpostPost` directly and cannot reach Zernio |
> | `web_search` "is never handed to an agent" | It is — `chat/route.ts:468` and `worker.ts:257` |
> | 78 slash commands | 77 |
> | Transcription gated at "< 100MB" | The gate was deliberately deleted; do not re-add it |
> | The 14 brand rows "include Man Clinic and a personal LinkedIn brand" | Neither is a brand; both are Mixpost accounts |
> | Regulated brands are "Downscale, TeleScribe, DownscaleDerm, EndorseMe" | TeleScribe is unflagged; BHI and TeleCheck Clinic were missing |
> | "$60K/$120K penalties" | $60,000; the $120K figure was unsourced and is removed |
>
> A same-day re-count of every other number in this file then corrected six more:
> the `TIER_BY_AGENT` map (five entries, not four — `automation` was missing), the
> report bar (eleven actions, not ten), the phone mockups (eleven platforms, not
> six), the agent personality character range, the `QuickActions` set list, and
> the media pipeline's stage count (four — `delivery` was undocumented).
>
> **A confidently-worded correction is not evidence.** The `web_search` error
> above survived a whole repair pass *because* it was phrased as the fix to an
> earlier mistake, which reads as though it has already been checked. If this
> file says "an earlier version wrongly said X", that sentence needs the same
> verification as any other — check the source, not the tone.
>
> **A number without a method is a guess.** Where a count appears below it now
> carries the command that produced it. Re-run the command; do not trust the
> number.
>
> **Verify before you cite.** Versions live in `package.json`, models in
> `src/lib/ai/model-routing.ts`, the live catalogue at
> `curl -s https://ai-gateway.vercel.sh/v1/models`, behaviour in the source.

## MANDATORY: Read Before ANY Creative Studio Work

Before touching ANY Creative Studio code (Creator, Review, Schedule, Media, or related components), you MUST read:
- `~/Obsidian/Reference/nrs-creative-studio-definitive-architecture.md` — the complete architecture spec
- `~/NotRealSmartAgency/2026-04-08-post-creator-redesign.md` — the 10-card Creator spec
- `~/Obsidian/Reference/nrs-creative-studio-redesign-research.md` — competitor patterns

**Key architecture:** Creator is THE centre. Three entry points (Media→Creator, fresh Creator, Review→Creator). Director is the expert marketer who delegates to 14 departments. Any AI (Cowork, Claude Desktop) plugs into the Director via MCP. Build to spec, never patch.

## Rule Zero — Tomorrow's Tech for Marketing

> **Use today's tech to get things done. Build for tomorrow's tech to get better. Leave yesterday's tech behind.**

NRS must ALWAYS be at the frontier of marketing technology. Not just AI agents — everything: how content is created, how posts are published, how analytics work, how compliance is enforced, how users interact. Before building anything, ask: **is this how marketing will work in 12 months?** If not, research the frontier first, then build to it.

- **Build our own technology.** Third-party tools are temporary bridges until we build our own. Never sell or position plug-ins as the product.
- **Publishing:** one door of our own — `src/lib/publishers/dispatcher.ts` — with transports behind it (Zernio for subscribers, self-hosted Mixpost for our own brands, native platform APIs where they are wired). **That is the design, not yet the state: two callers still bypass the door** — see Publishing → Migration status. The distinction that matters is **where the abstraction sits**: NRS owns brand intelligence, the AHPRA/TGA gate, the composer, scheduling and memory; a transport is swappable without touching product logic. Wiring a vendor's API shapes through the application would sell the spine. See the Publishing section below and `~/Obsidian/Decisions/2026-08-17-nrs-zernio-for-subscribers-mixpost-as-fallback.md`.
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

## Session Start Checklist (every new session)

1. If the task touches Creator / Review / Schedule / Media → read the three specs in the MANDATORY block above **before** any code.
2. Confirm you are in `~/NotRealSmartAgency` (not `~/notrealsmart`).
3. Confirm Supabase CLI is linked to `uyhtrwlotoriblicqqrl` per the global SUPABASE CLI GATE.
4. Skim the Memory Index (`~/.claude/projects/-Users-jb-downscale-NotRealSmartAgency/memory/MEMORY.md`) — the `feedback_*` and `#CRITICAL` entries override defaults.
5. Plan mode first if the task touches files; answer directly if it's a question.

## Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build (Webpack — NOT Turbopack for Vercel compat)
npm run start        # Start production server
npm run lint         # ESLint (flat config v9 — eslint.config.mjs at repo root)
npm test             # node:test via tsx over every src/**/*.test.ts
```

**Testing — there IS a test runner, and several tests are architectural guardrails.**
`package.json` defines `npm test` as `tsx --test $(find src -name '*.test.ts' -print)`,
and **182 test files** exist. Run a single file directly for the fast loop:

```bash
npx tsx --test src/lib/agents/publish-gate.test.ts
npx tsx --test src/lib/zernio/account-scoping.test.ts
```

Some of these read the source tree and fail on a *rule* violation, not a logic bug —
treat a red one as "you broke an invariant", not "fix the assertion":

| Test | Invariant it pins |
|---|---|
| `src/lib/errors/no-raw-errors.test.ts` | no tool returns a raw error string to the owner |
| `src/lib/agents/publish-gate.test.ts` | every publishing path passes the AHPRA/TGA gate |
| `src/lib/agents/save-gate.test.ts` | failed content never enters the outputs library |
| `src/lib/agents/regulatory-invariants.test.ts` | the regulatory chokepoints stay chokepoints |
| `src/lib/zernio/account-scoping.test.ts` | Zernio account isolation is filtered in OUR code (see Publishing) |
| `src/lib/security/execution-scope.test.ts`, `project-access.test.ts`, `marketing-data-boundary.test.ts`, `project-scope-migration.test.ts`, `github-app-connector-migration.test.ts` | project-scope and connector isolation |
| `src/lib/video/binary-shipped.test.ts`, `src/lib/agents/heygen-removal.test.ts` | dependency invariants |

Before claiming a feature complete: `npm test`, `npm run lint` and `npm run build` all
pass, then `graphify update .`.

**Environment variables** (all in `.env.local`, never commit). This list was
re-derived from `process.env.*` references in `src/` on 2026-08-17 — the previous
version named keys the code no longer reads:

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **AI**: nothing. AI Gateway credentials are auto-injected on Vercel and `src/` reads no `ANTHROPIC_API_KEY`. `NRS_EMBEDDING_MODEL` optionally overrides the memory embedding model.
- **Publishing — Zernio (subscribers)**: `ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET`
- **Publishing — Mixpost (self-hosted fallback)**: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`, `MIXPOST_WORKSPACE_UUID`, `MIXPOST_WEBHOOK_SECRET`, `MIXPOST_WEB_URL`
- **Publishing — native platform OAuth**: `META_APP_ID`/`SECRET`, `LINKEDIN_CLIENT_ID`/`SECRET`, `TIKTOK_CLIENT_KEY`/`SECRET`, `TWITTER_CLIENT_ID`/`SECRET`, `YOUTUBE_CLIENT_ID`/`SECRET` (+ their `*_OAUTH_REDIRECT_URI`), and `USE_NATIVE_PUBLISHER_{PLATFORM}=true` to switch a platform onto the native publisher
- **Media/Video**: `CANVA_CLIENT_ID`/`CANVA_CLIENT_SECRET`/`CANVA_API_KEY`, `DEEPGRAM_API_KEY`, `OPENAI_API_KEY` (Whisper fallback), `FFMPEG_BIN`, the `MODAL_*` toolkit endpoints
- **Payments/Email**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_*_PRICE_ID`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- **App/Cron**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`

There is **no `AYRSHARE_API_KEY`** — Ayrshare is gone (see Publishing, below).

Hybrid pattern: most third-party keys are checked in `user_integrations` first (power users), then fall back to the env var (so out-of-box users get everything).

## What This App Is

**NotRealSmart Agency** — a self-owned agentic AI marketing agency platform. 1 Director + 14 department heads run marketing autonomously across the owner's brands.

**Name:** Not Real (Artificial) Smart (Intelligence) = Artificial Intelligence. The name IS "AI" hidden in plain English. **Owner:** Black Health Intelligence Pty Ltd, ABN 23 693 026 112. Runs 10 Australian businesses — health clinics, telehealth, skincare, fragrance. Built NRS because we needed it ourselves. Australian-built, Australian-owned, specialising in healthcare, works for all.

**Repo:** `~/NotRealSmartAgency` (NOT `~/notrealsmart` — that's the old repo, superseded).

### The brands

Product-facing shorthand is "8 brands": Downscale Weight Loss (AHPRA+TGA) | DownscaleDerm (AHPRA+TGA) | TeleCheck | TeleScribe | NotRealSmart | Downscale Diary | Scent Sell | EndorseMe (AHPRA).

**The live `brands` table holds 14 rows, 11 of them active** (`select name, is_active from
brands`, run 2026-08-17). In alphabetical order: Black Health Intelligence, Do Today,
Downscale Diary*, Downscale Weight Loss, DownscaleDerm*, EndorseMe, NotRealSmart, Scent Sell,
Sniffopotamus, Tele360*, TeleCheck, TeleCheck Clinic, TeleScribe, Underground Parfums
(* = `is_active = false`).

Do not use "8" as a query expectation; it is a marketing figure, not a row count. The six rows
the shorthand does not name are Black Health Intelligence, Do Today, Sniffopotamus, Tele360,
TeleCheck Clinic and Underground Parfums.

> An earlier version of this line said the 14 rows "include Man Clinic and a personal LinkedIn
> brand" and cited the Cowork account list at the bottom of this file as evidence. Neither is a
> brand row — that list is of Mixpost *connected accounts*, which is a different thing. Do not
> read connected accounts as brands.

### 15 Agents (1 Director + 14 Departments)

Authoritative source: `ACTIVE_AGENT_TYPES` in `src/types/database.ts` and `getToolsForAgent()`
in `src/lib/agents/tools/index.ts`. Both were re-read on 2026-08-17. **The previous version
of this table listed a 14th agent as the total, omitted `help` entirely, and named eleven
tools that do not exist** — `create_video`, `multi_scene_video`, `text_to_speech`,
`translate_video`, `photo_avatar`, `voice_locales`, `talking_photo`, `video_agent`,
`register_webhook`, `brand_glossary` and `inspiration`. None of those is a registered tool.

**`web_search` is real, and is not assembled by `getToolsForAgent()`** — which is why it does
not appear in `tools/index.ts` and why an earlier repair pass wrongly deleted it as fictional.
It is attached at the two execution entry points instead, so read those, not the tool index:

- `src/app/api/chat/route.ts:468-474` — attached to `overall`, `seo` and `competitor` (skipped
  when `deskContext` is set)
- `src/lib/agents/worker.ts:42-43, 257-268` — `WEB_SEARCH_AGENTS = new Set(['seo','competitor'])`,
  merged into the department tool set unless `allowedToolNames` excludes it, or forced on via
  the `withWebSearch` option

Both use `gateway.tools.perplexitySearch({ maxResults: 5, ... })`. It is listed in the tables
below with a **(+)** so it is obvious it comes from the entry point rather than the tool index.

**Every agent also gets nine shared management tools** — `create_task`, `request_approval`,
`handoff_to_department`, `query_outputs`, `read_proforma`, `get_brand_kit`, `project_brief`,
`goal_interview`, `sync_brand_to_canva`. Note `save_output` is **not** among them; it is
added per-agent. Tool counts below are explicit keys **plus** those nine. A **(+)** marks a
tool attached at the entry point (chat route or worker), not by `getToolsForAgent()`.

| Department | Agent Type | Tools |
|---|---|---|
| NRS Director | `overall` | ~100 total. 87 explicit keys plus the 9 management tools, `generate_image` + 3 `blotato_*` visual tools, and `use_abe_ai` on regulated brands. `delegate_to_agent`, `convene_meeting` and **(+)** `web_search` are added separately in the chat route. Highlights: `zernio_reply`, `zernio_ads`, `zernio_analytics`, `search_brain`, `publish_to_social`, `propose_post_from_media`, `create_carousel_proposal`, `caption_video`, `tighten_video`, `review_content`, `research_industry`, `extract_brand_kit`, `marketing_audit`, `deep_competitor_scan`, `fill_calendar`, `manage_posts`, `manage_tags`, `approve_proposal`, `set_active_goal`, `update_goal_progress`, `inspect_project_marketing_backend`, `use_pico_search`, the full Canva surface and 8 `blotato_*` tools |
| Content & Copy | `content` | 39 explicit + management. `search_brain`, `approve_proposal`, `caption_video`, `tighten_video`, `save_output`, `create_collage`, `verify_product`, `word_count`, `query_media`, `propose_post_from_media`, `generate_slides`, `repurpose_content`, `write_blog`, `analyse_voice`, the Canva design surface, `browse_mixpost_media`, `list_mixpost_templates`, `create_mixpost_template`, `upload_media`, `manage_collections`, `manage_media_tags`, `blotato_extract_content`, `blotato_source_status` |
| SEO & GEO | `seo` | `save_output`, `word_count`, `scan_website`, `browse_page`, `write_blog`, **(+)** `web_search` |
| Paid Ads | `paid_ads` | `save_output`, `word_count`, `generate_image`, `write_ads`, plus the Canva template/export surface |
| Strategy & Launch | `strategy` | `save_output`, `browse_page`, `generate_slides`, `fill_calendar`, `query_calendar`, `manage_posts`, `search_inspiration`, `query_social_analytics`, `manage_tags`, `request_outline_review`, `import_design_from_url`, `get_presenter_notes`, `list_mixpost_templates`, `create_mixpost_template`, `analyse_content_gaps`, `publish_to_social`, `manage_collections`, `manage_media_tags`, `research_industry` |
| Email Marketing | `email` | `save_output`, `word_count`, `send_email`, `read_gmail`, `write_email_campaign` |
| Growth & Partnerships | `growth` | `save_output`, `word_count`, `scan_website`, `send_email`, `browse_page`, `read_gmail` |
| Brand | `brand` | 32 explicit + management, dominated by the Canva surface: `save_output`, `create_collage`, `generate_image`, `design_graphic`, `export_design`, `search_designs`, `search_folders`, `list_folder_items`, `list_brand_templates`, `create_canva_template_copy`, `get_brand_template_dataset`, `get_design*`, `resize_design`, `upload_asset_from_url`, `design_from_candidate`, `import_design_from_url`, `comment_on_design`, `list_comments`, `list_replies`, `reply_to_comment`, `create_folder`, `move_item_to_folder`, `resolve_shortlink`, `generate_design_structured`, `import_canva_design_to_media`, `create_carousel_proposal`, `analyse_voice`, `upload_media`, `manage_collections`, `manage_media_tags` |
| Market Intelligence | `competitor` | `save_output`, `scan_website`, `browse_page`, `deep_competitor_scan`, `research_industry`, **(+)** `web_search` |
| Web & CRO | `website` | `save_output`, `word_count`, `scan_website`, `browse_page`, `generate_image` |
| Compliance | `compliance` | `save_output`, `scan_website`, `browse_page`, `get_design_content`, `get_design_pages`, `comment_on_design`, `list_comments`, `reply_to_comment`, `review_content`, and `use_abe_ai` on regulated brands |
| Analytics & Reporting | `analytics` | `search_brain`, `approve_proposal`, `save_output`, `scan_website`, `browse_page`, `query_analytics`, `query_site_traffic`, `query_social_analytics`, `analyse_content_gaps`, `inspect_project_marketing_backend` |
| Automation & AI | `automation` | `save_output`, `scan_github`, `browse_page`, `inspect_project_marketing_backend` |
| Video & Scripting | `video` | `save_output`, `verify_product`, `word_count`, `process_media`, `repurpose_content`, `query_media`, `propose_post_from_media`, `upload_asset_from_url`, `browse_mixpost_media`, `publish_to_social`, `upload_media` |
| Get Help | `help` | `save_output`, `browse_page` |

> `martech` exists as an archived agent type for backward compat with old conversations — not shown in UI. It is the one set that does **not** receive the management tools: `save_output` and `scan_github` only.
> A brand marked template-locked gets **no** image or visual generator at all — `generatedImageTools`/`visualGenerationTools` resolve to `{}`. The capability is absent at the tool boundary because prompt prose cannot stop a model inventing type or layout.
> All agents get `read_proforma` + `query_outputs` for cross-agent learning.
> Departments are INVISIBLE to the user — Director delegates behind the scenes.

### Capability contract — a department must return evidence, not a claim

`src/lib/agents/task-capability-plan.ts` maps a request to a required capability
(`canva_asset`, `video_evidence`, `website_evidence`, `competitor_research`,
`current_research`, `caption_hashtag_analysis`, `product_identity`, `compliance_review`),
an accountable department, and the tools that must actually have run this turn. A
prose-only answer is not evidence. The same capability also feeds
`TIER_BY_TASK_CAPABILITY` in `model-routing.ts` and can override the department's model
tier. Full rules: `~/Obsidian/Reference/nrs-director-capability-contract.md`.

### Master Marketing Proforma
Each brand has a 21-section structured living document stored in `brand_proforma_sections`:
executive_snapshot, client_profile, brand_fundamentals, audience, market_context, compliance_profile,
business_goals, funnel_map, channel_website, channel_seo, channel_social, channel_paid, channel_email,
content_creative, competitors, kpi_dashboard, gaps_opportunities, wins_losses, risk_register, decision_log,
thirty_sixty_ninety. Each has RAG status, review cadence, staleness tracking. Auto-populated from brand data.

### Slash Commands (77 defined)
Type `/` in chat input → Discord-style autocomplete dropdown. All commands just send natural language
to the Director. Defined in `src/lib/slash-commands.ts` — 77 `command:` entries, re-counted
2026-08-17 with `grep -c "command: '" src/lib/slash-commands.ts`. (An earlier version of this
file said 78, in two places, with a counting date; README.md:560 has always said 77.)
Key commands: /post, /blog, /fill, /audit, /design, /video, /adcopy, /deepscan, /proforma, /calendar,
/analytics, /help.

### Inline Rich Cards
Chat messages can contain `json:card` code blocks that render as visual cards: PostPreviewCard,
CalendarWeekCard, AnalyticsSummaryCard, BrandSavedCard. Parser: `src/components/agency/inline/parseInlineCards.ts`.

### Hybrid API Keys
Third-party tools (Canva, Blotato, Deepgram and friends) check `user_integrations` first
(power users bring their own key), then fall back to the env var, so out-of-box users get
everything. **There is no Ayrshare key and no Ayrshare tool** — that integration was removed.

### Brand Ecosystem
When chatting about one brand, the Director sees all sibling brands owned by the same user.
Enables cross-promotion suggestions between related products (TeleScribe + Tele360 + TeleCheck).

### Publishing — one intended door, three backends (decided 2026-08-17, migration incomplete)

**`src/lib/publishers/dispatcher.ts` is the door to a live account** — `publishToPlatform()`
is the rule every publishing path is being moved behind. It is **not yet the only door**; read
the migration status below before assuming a code path reaches it. Three backends, considered
in this order:

1. **Zernio** — the brand has a `zernio_profile_id` **and** Zernio has an account for that
   platform. This is the path for **subscribers**.
2. **native** — `USE_NATIVE_PUBLISHER_{PLATFORM}=true` (only LinkedIn is wired today).
3. **Mixpost** — self-hosted fallback, and what **Justin's own brands** stay on, so it is
   exercised daily and is a genuine fallback rather than a dusty one.

Selection is per brand, from `brands.social_urls.zernio_profile_id`. Linked so far:
**Scent Sell** and **EndorseMe** (2 of 14 brand rows, checked live 2026-08-17). Every attempt
is logged to `publisher_runs`; failures queue in `publisher_retry_queue`.

#### Migration status, checked 2026-08-17 — the door is not yet the ONLY door

An earlier version of this section claimed "every publishing path goes through it". That was
false, and it is the most expensive kind of doc error here: it reports as closed the exact
fault the dispatcher was built to close. Only the 5-minute cron
(`/api/cron/publish-posts`) calls `publishToPlatform`. Two older callers still talk to the
Mixpost client directly and therefore **cannot reach Zernio at all**:

- `src/app/api/scheduled-posts/publish-now/route.ts` — imports `createMixpostPost` from
  `@/lib/mixpost/client` and calls it directly
- `src/lib/agents/tools/publish-to-social.ts` — the `publish_to_social` agent tool, which
  builds its own Mixpost base URL from `MIXPOST_API_URL` / `MIXPOST_WORKSPACE_UUID` and
  fetches accounts itself, so it never sees the confirmed `social_urls.mixpost_account_ids`
  overrides. (`fetchMixpostAccounts` is used by `publish-now`, the other caller above.)

Re-check it yourself rather than trusting this line:

```bash
grep -rln "publishToPlatform" src
```

Three files as of 2026-08-17: the cron route, `dispatcher.ts`, and
`src/lib/agents/regulatory-invariants.test.ts`. When `publish-now/route.ts` and
`publish-to-social.ts` appear in that list, the migration is done and this subsection can go.
(Both still run the AHPRA/TGA check — `publish-now/route.ts:74` calls `checkPublishAllowed`
from `publish-gate.ts`, and `publish-to-social.ts:88-115` calls `runComplianceFilter` inline
and refuses to publish if the check did not complete. So the regulatory gate is not the thing
that is open — the *transport choice* is.)

**The live consequence while it stays open.** Scent Sell and EndorseMe are the two brands
linked to Zernio profiles, so on their rows a *scheduled* post reaches Zernio via the cron
while pressing *Publish now* reaches Mixpost. Same `scheduled_posts` row, two buttons, two
destinations. README.md:51-59 states this the same way and names the same grep.

**Why this does not break Build-First.** NRS keeps owning the product — brand intelligence,
the AHPRA/TGA gate, the composer, scheduling, memory. Zernio is a *transport behind our own
interface*, swappable without touching product logic. Wiring Zernio's API shapes through the
application would have sold the spine; putting it behind `dispatcher.ts` does not.
Full reasoning: `~/Obsidian/Decisions/2026-08-17-nrs-zernio-for-subscribers-mixpost-as-fallback.md`.

**THE FAULT that forced it — and it is still half-live.** The choice lived in two places
that disagreed: the 5-minute cron had an inline Zernio-first fork, while
`/api/scheduled-posts/publish-now` had no Zernio code at all. The cron half is fixed (it now
delegates to the dispatcher); the `publish-now` half is not. A brand connected to one
transport but not the other publishes cleanly on one button and is written back as `failed`
on the other. Once failed, the cron will never retry it, because it only selects
`status='scheduled'`.

#### CRITICAL AND COUNTERINTUITIVE — Zernio does NOT enforce customer isolation

Zernio's own multi-tenant guide states it plainly:

> "Posts validate `accountId` against your whole team, not against a profile … keep the
> account-to-customer mapping in your database and only pass a customer their own account IDs."

A Zernio profile is an **organisational** boundary, not a security one. Every boundary
between subscribers is NRS code.

**MEASURED against the live account on 2026-08-17:** `listAccounts({ profileId })` accepts
the filter and **ignores** it — 10 accounts returned with it, the same 10 without. A source
comment had asserted the opposite, and an ownership check built on it permitted every account
in the team. Each account *does* carry its own correct `profileId`, so filtering is exact but
must happen our side: `fetchZernioAccounts` (`src/lib/zernio/client.ts`) filters **after**
`normaliseAccount`, because the raw field is sometimes a populated `{_id, name}` object rather
than a string. Pinned by `src/lib/zernio/account-scoping.test.ts`.

Related trap: disconnected accounts **migrate to another profile rather than being deleted**,
so one social account can appear under two profiles — an unfiltered publisher matching on
platform alone can match twice and post identical content twice to one page.

Full pattern, rate limits, the shared-fate `402 PAYMENT_REQUIRED` risk, `customContent` for
per-platform captions, and what NRS still lacks before selling subscriptions:
`~/Obsidian/Reference/nrs-zernio-multi-tenant-integration.md`.

**Zernio surface in this repo:** `@zernio/node` `^0.2.580` (package.json); `src/lib/zernio/client.ts`;
routes `src/app/api/zernio/{accounts,ads,analytics,connect,callback}`; webhook
`src/app/api/webhooks/zernio/route.ts` (handles `message.received` / `comment.received` only —
`account.connected`, `post.published`, `post.failed` and `account.disconnected` are still
unheard, so publish status is discovered by polling); agent tools `zernio_reply`, `zernio_ads`,
`zernio_analytics`.

### Mixpost Self-Hosted Publisher (LIVE — the fallback transport)
Mixpost Pro installed on BinaryLane VPS (`https://mixpost.notrealsmart.com.au/mixpost`).
Docker at `/opt/mixpost/docker-compose.yml`. Connected accounts (Facebook Pages, Instagram
Business, LinkedIn) — **not re-verified in the 2026-08-17 pass**; it needs the live VPS.
Check `GET /api/mixpost/accounts` before relying on the connected set.
Env vars: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`, `MIXPOST_WORKSPACE_UUID` (in .env.local + Vercel).
Mixpost Pro v6 requires the workspace UUID in every API path (`/api/{workspace_uuid}/…`).
Supports video publishing to TikTok, YouTube, Instagram Reels, Facebook Reels.
$0/month self-hosted publishing — it replaced Ayrshare, which is fully removed: no client,
no tool, no key, no fallback. The only surviving `ayrshare` strings in `src/` are a historical
comment in the cron and a type/test reference.

## Required Reference: AI Agent Architecture

Before building or modifying agent execution, tool systems, memory, MCP integrations, or any agentic features in NotRealSmart, **load the Claude Code architecture skill first**:

```
/ai-agent-architecture
```

> **Availability caveat (checked 2026-08-17):** this skill is not present at
> `~/.claude/skills/ai-agent-architecture`. It is listed as available to some agent
> harnesses but is not installed on disk in the usual place. If the invocation does
> nothing, read the Obsidian reference below instead of assuming the guidance is optional.

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

- **NRS video stack**: Remotion (React) + cloud GPU (Modal/RunPod) for programmatic video
- **AI voiceover**: Qwen3-TTS voice cloning — free, runs on your GPU, brand voice matching
- **Image generation**: FLUX.2 for video scene frames — free on Modal's $30/mo starter
- **AI music**: ACE-Step royalty-free music generation
- **Commands**: `/video-setup`, `/video-video`, `/video-template`, `/video-brand`, `/video-generate-voiceover`
- **Python tools**: `~/.claude/video-toolkit-tools/` (22 `.py` scripts: voiceover, image gen, music, upscale, face animation — count verified 2026-08-17)
- **Templates**: Product demos, sprint reviews — extensible for marketing content

Integration points in NotRealSmart:
- `lib/video-toolkit/client.ts` — owned voiceover, image and music generation endpoints
- `lib/agents/tools/process-media.ts` — toolkit's FFmpeg tools for post-processing
- Video agent personality (`video` type) — add toolkit awareness to system prompt
- Cron publisher (`/api/cron/publish-posts`) — rendered MP4s can be published via Mixpost

Apply these patterns when working on: Director chat, AgentWorker system, tool implementations, the memory system, heartbeat execution, intent router, delegation, meetings.

## Architecture

### Middleware & Auth
`src/middleware.ts` runs Supabase session refresh on every request (except static assets/images). Uses `lib/supabase/middleware.ts` `updateSession()`. All `/agency/*` routes require auth.

### Next.js Config
`next.config.ts`: `transpilePackages: ['three']`. Allowed remote image domains: `uyhtrwlotoriblicqqrl.supabase.co` (Supabase storage), `www.google.com` (favicons), `**.com.au`. Security headers: X-Frame-Options SAMEORIGIN, nosniff, HSTS.

### ESLint
`eslint.config.mjs` **does** exist at the repo root (flat config v9, `next/core-web-vitals`).
Run `npm run lint`.

### Agent Execution — True Multi-Agent (AI SDK v6)
**Director chat** (`/api/chat/route.ts`) uses `streamText()` (NOT ToolLoopAgent). Each request:
1. Validates request (brandId, agentType, conversationId)
2. Fetches brand (RLS-protected) + agent config from Supabase
3. Gets/creates agent registry entry, checks budget (`429` if exceeded)
4. Builds system prompt with independent memory retrieval per agent namespace
5. For Director: runs intent router, appends routing hints to system prompt
6. Streams via `gateway(modelRoute.model)` — the id is **resolved at request time** by `src/lib/ai/model-routing.ts`, never written literally. The default (`agency`) tier is `anthropic/claude-sonnet-5`. See Model Routing below.
7. `stopWhen: stepCountIs(8)` — max 8 tool-use steps per turn (`src/app/api/chat/route.ts:498`)
8. `onFinish`: records spend via `estimateGatewayCost`, logs to `ai_usage` + `audit_log`, extracts memories

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

### Model Routing — one source of truth

`src/lib/ai/model-routing.ts` owns **every** model choice. Four tiers with explicit fallback
chains. These ids were read from `GET https://ai-gateway.vercel.sh/v1/models` on 2026-08-09
and re-confirmed present in the live catalogue on 2026-08-17 — **never write a model id from
memory.**

| Tier | Primary | Fallbacks |
|---|---|---|
| `fast` | `anthropic/claude-haiku-4.5` | `google/gemini-3-flash`, `openai/gpt-5.6-luna` |
| `agency` (default) | `anthropic/claude-sonnet-5` | `openai/gpt-5.6-terra`, `google/gemini-3-flash` |
| `frontier` | `anthropic/claude-opus-5` | `anthropic/claude-sonnet-5`, `openai/gpt-5.6-terra` |
| `code` | `openai/gpt-5.3-codex` | `anthropic/claude-sonnet-5`, `openai/gpt-5.6-terra` |

Departments map to a tier only where there is a real reason. `TIER_BY_AGENT`
(`src/lib/ai/model-routing.ts:95-101`) has **five** entries and no more — everything else falls
through to `agency`:

| Department | Tier | Resolves to |
|---|---|---|
| `compliance` | `frontier` | `anthropic/claude-opus-5` |
| `competitor` | `fast` | `anthropic/claude-haiku-4.5` |
| `website` | `fast` | `anthropic/claude-haiku-4.5` |
| `analytics` | `fast` | `anthropic/claude-haiku-4.5` |
| `automation` | `code` | `openai/gpt-5.3-codex` |

`automation` is the one an earlier version of this file omitted, and it is the one a spend
audit would most want to see — it reasons about integrations, payloads and failures, which is
engineering work. It is a list of exceptions, not a config file to fill in.
`TIER_BY_TASK_CAPABILITY` can override the department tier for a specific workflow.

> **`anthropic/claude-sonnet-4` still exists in the Gateway catalogue but is not a configured
> tier primary or fallback.** It survives only in `LEGACY_MODEL_IDS`
> (`src/lib/ai/model-routing.ts:167`) as an id to migrate off, so a grep does find the string.
> Earlier versions of this document and of `README.md` named it as the default. It never was.

### 15 Agent Personalities (agency-agents pattern)
Each agent has a deep specialist definition in `agent_configs.system_prompt`. Measured live
2026-08-17 (`select agent_type, length(system_prompt) from agent_configs`), not estimated —
the doc previously said "5,000-6,400 chars", which is true of none of the extremes:

- The **13 specialist departments** run **4,949** (`strategy`) to **6,504** (`video`) chars
- **`overall`** is much longer at **9,704** — it carries the orchestration rules as well
- **`help`** is **2,793**, and the archived **`martech`** is **1,308** — both are deliberately thin

Each contains:
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
| `help` | Get Help | Onboarding and "how do I…" questions — `save_output`, `browse_page` |

Agent personalities are visible in chat during delegation/meetings (coloured badges, tree-structured progress).

### Intent Router (`lib/agents/intent-router.ts`)
Rule-based keyword classification that analyses the user's message and suggests which department should handle it. Returns `{ suggestedAgent, confidence, shouldDelegate }`. Injected into Director's system prompt as routing hints — fast and free (no LLM call).

### Heartbeat (Vercel Cron)
`/api/heartbeat` runs every 15 min via Vercel Cron. Processes assigned tasks autonomously. Budget enforcement with auto-pause. Monthly reset on 1st. Uses Fluid Compute (`maxDuration=300`).

### Memory System (v2 — SHIPPED. It is not mem0, and Ruflo is no longer "the" memory system)

The previous version of this section described Ruflo as the memory system with "keyword
search only, no semantic, no deduplication" and mem0 as the planned replacement. **Memory v2
shipped, and it is not mem0.** The file references were real; the capability description was
two generations stale.

Three layers on Supabase + pgvector, all imported directly by `src/app/api/chat/route.ts`:

- **Facts** — `lib/memory/fact-extractor.ts` runs **LLM** fact extraction (fast tier) on each
  turn; `lib/memory/store.ts` embeds and stores. Semantic dedup via the `match_memories` RPC
  at **0.85 cosine** — above the threshold it *updates* the existing memory rather than
  inserting a duplicate.
- **Embeddings** — `lib/memory/embeddings.ts`. Model is **`google/gemini-embedding-001`**
  (overridable via `NRS_EMBEDDING_MODEL`), requested at **1536 dimensions** through the AI
  Gateway. `agent_memories.embedding` is `vector(1536)`, so the width is a contract, not a
  preference. **Incident:** the old client called OpenAI directly and needed `OPENAI_API_KEY`,
  which was never set — every embed threw silently and **7,074 memories were stored with no
  vector at all**. Two models do not share a vector space even at identical width; changing
  the model means re-embedding every row, not editing a constant.
- **Session memory** — `lib/memory/session-memory.ts`. A compounding **7-section** markdown
  record per brand (Current State, User Preferences, Brand Rules, Decisions Made, Content
  Performance, Corrections & Feedback, Campaign History), updated in place rather than
  replaced. Thresholds: 3 turns before the first extraction, 3 turns between updates. The
  record is itself embedded for semantic search and injected as "Brand Learning".

**Namespaces:** `lib/ruflo/namespaces.ts` — `nrs-{brandSlug}-{agentType}` per brand per
department, `nrs-agency` for the cross-department global namespace.

**Prompt integration:** `lib/agents/prompt-builder.ts` — `buildSystemPromptWithMemory()`.

**What Ruflo still is:** `lib/ruflo/` survives as a thin Supabase CRUD shim plus
`memory-extractor.ts`, which still runs alongside v2 from the chat route. It is a co-resident
legacy path, not the system.

**#CRITICAL schema gotcha:** `agent_memories.value` is a **TEXT** column — reads return a
string. Always go through `parseMemoryValue()` (`src/lib/memory/memory-value.ts`). Casting it
straight to an object fails silently and has already disabled three features at once.

### Team Members & Invitations
`team_members` table with roles (`owner`, `admin`, `viewer`) and optional per-brand access (`brand_ids UUID[]`, NULL = all brands). Invite flow via Resend email with token link. Auto-accept on signup via updated `handle_new_user()` trigger.
- **RLS**: 3 helper functions (`is_owner_or_team_member`, `can_write_for_owner`, `can_access_brand`, defined in `supabase/migrations/015_team_members.sql`) replace per-table policy duplication across the schema. The old "all 16 table policies" figure is four years of drift behind — the live public schema has **64 tables** and **55 migrations** have shipped.
- **UI**: `/agency/team` page, `InviteTeamDialog`, `/invite/[token]` public landing page
- **API**: `/api/team` (GET list + POST invite), `/api/team/[id]` (PATCH + DELETE), `/api/team/accept`

### Chat Image/Screenshot Support
Users can paste (Cmd+V) or drag/drop images into chat. Images are sent as AI SDK v6 `FileUIPart` (base64 data URL) so the model actually sees them. Video/audio still goes through the media upload pipeline.

### Post Signature Branding
Per-brand `post_signature` JSONB field on `brands` table. Three formats: plain text, `@mention`, or `#hashtag`. Injected into all agent system prompts as a mandatory attribution rule. Also appended by the cron publisher to scheduled posts before they reach `publishToPlatform` in the dispatcher.

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
`src/lib/agents/tools/canva.ts` exports **27** tool factories (counted 2026-08-17) — design
generation, template autofill, folders, comments, exports, asset upload. OAuth 2.0 + PKCE.
The Director, Brand, Content and Paid Ads sets all carry large slices of this surface. Only
`search_designs`, `list_brand_templates`, `get_brand_template_dataset`, `get_export_formats`,
`export_design`, `generate_design_structured` and `import_canva_design_to_media` are exposed
on MCP; the rest are Director-only.

### MCP Server — CLI & AI Client Access (LIVE)
NRS is an MCP server. Users connect from Claude Desktop (includes Cowork), Claude Mobile, terminal Claude Code, or any MCP-compatible AI client.

**Endpoint:** `https://www.notrealsmart.com.au/api/mcp` (Streamable HTTP, stateless)

**Two auth methods:**
1. **Bearer token** — user creates API key in Settings, adds to config. Key prefix `nrs_sk_`, SHA-256 hashed in `api_keys` table.
2. **OAuth 2.0** — user clicks "Add custom connector" in Claude Desktop/Mobile, logs in via `/mcp-login`, token issued automatically. Full RFC 8414 + RFC 7591 + PKCE S256.

**Access token = nrs_sk_ API key.** Both auth methods produce the same key type. The MCP server's `resolveApiKey()` validates both. Zero duplication.

#### MCP ALLOWLIST — plug-in AIs don't orchestrate, the Director does (NON-NEGOTIABLE)
**Plug-in AIs are MESSENGERS.** Claude Desktop, Cowork, Codex, any external MCP client — they hand user intent to `chat_with_director` and wait. They do NOT call multi-step orchestration tools directly, do NOT write marketing copy, do NOT bypass the Review queue.

> ### The mechanism was INVERTED. Read this before you add a tool.
>
> This section used to describe `HIDDEN_FROM_MCP` — a **denylist** in `src/lib/mcp/server.ts`
> passed as `adaptToolsForMCP(..., hiddenFromMcp)`. **That symbol does not exist anywhere in
> `src/`.** It was replaced by a genuine **allowlist**: `DIRECT_MCP_TOOLS` in
> `src/lib/mcp/director-only-tools.ts`, applied through `getDirectMcpToolEntries()` inside a
> four-argument `adaptToolsForMCP(tools, mcpServer, principal, toolFactory)`.
>
> **The consequence is the exact opposite of the old instruction.** A newly added tool is
> **Director-only by default** and must be explicitly allowlisted to appear on MCP. The old
> rule — "query-only or bounded single-shot? leave it alone, auto-exposed" — would silently
> leave a new read tool permanently invisible to Claude Desktop, Cowork and Codex.

Enforced structurally: `DIRECT_MCP_TOOLS: ReadonlySet<string>` is the **only** set of AI SDK
tools an external MCP client may invoke directly. Everything else exists only inside the
Director's internal AI SDK tool loop.

**Exposed directly on MCP** — the whole of `DIRECT_MCP_TOOLS` as of 2026-08-17:
- Brand contract & setup: `get_brand_kit`, `goal_interview`, `sync_brand_to_canva`
- Read-only agency state: `query_media`, `query_calendar`, `query_outputs`, `query_analytics`, `query_social_analytics`
- Read-only design library: `search_designs`, `list_brand_templates`, `get_brand_template_dataset`, `get_export_formats`
- Bounded, non-public utilities: `scan_website`, `browse_page`, `generate_image`, `save_output`
- Asset handling (writes only to the owner's own library, publishes nothing): `upload_media`, `export_design`
- The cross-project brain, read-only: `search_brain`
- The carousel chain end to end: `generate_design_structured`, `import_canva_design_to_media`, `create_carousel_proposal` — the last creates an **unapproved** review record, which is the gate

Plus the MCP-native tools registered directly on the server rather than adapted from the
agent tool set: `list_projects`, `list_brands` (compatibility alias), `project_brief`,
`chat_with_director`, `get_director_response`, `draft_post`.

**Director-only — everything not listed above.** In particular `publish_to_social`,
`manage_posts` and `manage_tags` are **NOT** exposed. An earlier version of this document
listed all three as "still exposed on MCP"; `publish_to_social` reaching a live account
without the Director is precisely the failure the allowlist exists to prevent.

**Adding a new tool — decide exposure:**
1. Default is Director-only. **Do nothing** and the tool is correctly walled off.
2. Want it reachable from Claude Desktop / Cowork / Codex? → add the name to `DIRECT_MCP_TOOLS` in `src/lib/mcp/director-only-tools.ts`, with a comment explaining *why it is safe* (every existing entry carries one), AND update the `quick_start` MCP prompt in `src/lib/mcp/server.ts`.
3. If it is multi-step, writes marketing copy, publishes, or spends money — it does not go in the set.

**Resources:** `brands://list` — all user's brands.

**Key files:**
- `src/app/api/mcp/route.ts` — MCP HTTP handler
- `src/lib/mcp/server.ts` — McpServer factory + native tool registration + `quick_start` prompt
- `src/lib/mcp/director-only-tools.ts` — `DIRECT_MCP_TOOLS` allowlist, `isDirectMcpTool`, `isDirectorOnlyMcpTool`, `getDirectMcpToolEntries`
- `src/lib/mcp/tool-adapter.ts` — `adaptToolsForMCP(tools, mcpServer, principal, toolFactory)`
- `src/lib/mcp/director-chat.ts` — chat_with_director (sync entry, kicks async job)
- `src/lib/mcp/director-job.ts` — the async Director run
- `src/lib/mcp/director-job-tool.ts` — get_director_response (poll)
- `src/lib/mcp/draft-post-tool.ts` — draft_post (sync Content & Copy shortcut)
- `src/lib/auth/api-key.ts` — key generation + validation
- `src/app/api/mcp/authorize/route.ts` — OAuth authorize
- `src/app/api/mcp/token/route.ts` — OAuth token exchange
- `src/app/mcp-login/page.tsx` — branded OAuth login page

**Team invite emails** include step-by-step setup for web, Claude Desktop/Mobile (OAuth), and Claude Code (API key + "tell Claude to connect").

Full reference: `~/Obsidian/Reference/nrs-mcp-architecture.md`.

### Media Processing Pipeline — single source of truth
**File:** `src/lib/media/process-pipeline.ts` — `runMediaProcessingPipeline({supabase, mediaItemId, runStages?})`.

ONE canonical function owns all media_items row mutations that touch thumbnails, the delivery copy, transcription, AI tagging, or the per-stage processing report. Both the HTTP route `/api/media/process` (browser uploads) AND the Director's `process_media` tool delegate to it. No other pipeline exists.

**Stages:**
1. **Thumbnail** (videos only) — `extractFirstFrameFromUrl()` runs `ffmpeg -ss 1 -i <https-url> -frames:v 1`. Fast-seek before input streams only the bytes needed for frame 1. Memory-safe for 500 MB files on Vercel serverless. Hard 30s kill timeout. Thumb uploaded to `{path}_thumb.jpg` in the media bucket.
2. **Delivery** (large videos only) — `needsDeliveryCopy()` → `transcodeForDeliveryFromUrl()` writes a lighter `{path}_social.mp4` **beside** the master (the master is never touched) and records it. Publishing prefers it when present. A platform fetches the URL rather than receiving an upload, so a 300MB phone video fails *late* — caption written, draft created, Mixpost synced, then error 2207082. On failure the master still publishes.
3. **Transcription** (video/audio, **no size gate**) — `transcribeFile()` → Deepgram nova-2 URL mode → Whisper fallback. Persists to `transcription`, `transcription_model`, `transcription_status`, `duration_seconds`.
4. **AI** — model vision (images) or transcript analysis (video/audio). Persists to `ai_description` + extends `tags`.

> **Do not re-add a transcription size gate.** An earlier version of this file described stage
> 3 as "video/audio < 100MB". That gate was deliberately deleted —
> `src/lib/media/process-pipeline.ts:258-266` says so in a comment: it "turned away every real
> video the owner shot — a three-minute phone clip is about 240MB", and Deepgram's URL mode
> never downloads the file and has no size limit. Measured on the 241MB clip that exposed it:
> 11 seconds, full transcript. The only layer that cares about size is the Whisper fallback,
> which enforces its own 25MB limit internally. The one surviving size constant in the file is
> `THUMBNAIL_MAX_SIZE = 500 * 1024 * 1024` (line 38), and it gates **thumbnails**, not
> transcription.

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
**Never ask the user to open Chrome DevTools, Network tab, or console.** That violates the non-tech-user First Principle at the top of this file. Justin is not a developer; he uses the Claude app (which contains Cowork) and the terminal Claude Code CLI — nothing else.

When a client-side flow (upload, chat, preview) hangs and needs diagnosis, instrument the CLIENT to POST breadcrumbs to a server endpoint and query them from the terminal with the admin client. Build-time pattern in place for media uploads:

- Client: `src/components/agency/MediaUploader.tsx` calls `log(traceId, step, data)` which both `console.log`s AND fires `fetch('/api/debug/upload-log', { keepalive: true })` for each breadcrumb. Each log includes the `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` so stale-cache bundles are obvious.
- Server: `src/app/api/debug/upload-log/route.ts` persists to `audit_log` with `action='upload_debug'`, `entity_type='media_upload_trace'`, `entity_id=<trace_id>`.
- Terminal: `node scripts/read-upload-trace.mjs` — prints all breadcrumbs grouped by trace_id with millisecond timings.

When a new class of client-side bug appears, extend this pattern rather than asking the user to paste logs. See feedback memory `feedback_no_devtools_for_user.md` for the full rationale.

### Planned Major Builds
1. ~~mem0 memory system~~ — **done differently and shipped.** Memory v2 (pgvector + LLM fact
   extraction + compounding session record) is live; it is not mem0. See Memory System above.
2. **Self-updating knowledge** — nightly research cron; agents stay current with AI/marketing trends.
3. **Zernio multi-tenant hardening** — required before subscriptions are sold: publish/account
   lifecycle webhooks, a stored `accountId` → customer mapping, scoped per-tenant API keys,
   `402 PAYMENT_REQUIRED` handling, and a fairness queue. Gaps enumerated in
   `~/Obsidian/Reference/nrs-zernio-multi-tenant-integration.md`.

### Meeting Room (Multi-Department Collaboration)
When the intent router detects 2+ departments needed, the Director uses `convene_meeting` instead of `delegate_to_agent`. All departments run as independent AgentWorkers in parallel. Each gets meeting context + department-specific brief. Results returned as structured meeting output with agent personality attribution. Auto-saved to output library with `[Meeting]` prefix.

Compound triggers: comprehensive audit, launch plan, campaign, rebrand, growth strategy, content strategy, competitive analysis, video campaign, review my brand.

### 11-Action Report Bar (`components/agency/MessageActions.tsx`)
Every substantial assistant message (>100 chars) gets action buttons. The `actions` array at
`MessageActions.tsx:184-195` holds **eleven** (re-counted 2026-08-17; the doc previously said
ten and omitted Help): Save, Email Me, Send to…, Baseline, Re-analyse, Todo, Copy, Remember,
Full View, PDF, Help. The Todo button relabels itself to `{n} tasks` once it has run. APIs:
`POST /api/outputs`, `POST /api/email-report`, `POST /api/extract-todos`; Help opens
`help.notrealsmart.com.au`.

### GitHub Repo Scanning
Add Brand dialog has a scan button. `GET /api/scan-github-quick?url=...` fetches README + package.json + repo metadata. Auto-fills brand name, description, niche, extra_context.

### Video Generation Pipeline
Video agent writes platform-specific scripts, shot lists, captions and production briefs (Reels, TikTok, YouTube, LinkedIn). Scripts are saved as `video_script` outputs with AHPRA/TGA compliance checking. Owned video-toolkit endpoints provide optional voiceover, image and music assets; an approved external renderer can be added later behind an explicit capability contract.

### "Review My Brand" Flow
Brand cards have "Review Brand" button → `POST /api/brands/{brandId}/review` runs website + GitHub + social scans in parallel → builds structured message → stores in Zustand `pendingReviewMessage` → redirects to Director chat → ChatInterface auto-sends → triggers 6-department meeting (competitor, SEO, content, analytics, compliance, website).

### Compliance Filter — runs on the FRONTIER tier, deliberately

`lib/agents/compliance-filter.ts` — `runComplianceFilter()` evaluates content against AHPRA/TGA
rules. Returns `{ isValid, flags, warnings, voiceIssues }`.

**It does not use Haiku.** It routes with `taskCapability: 'compliance_review'`, which
`TIER_BY_TASK_CAPABILITY` maps to the **`frontier`** tier — `anthropic/claude-opus-5`, the most
expensive model in the ladder. That is intentional: AHPRA/TGA exposure runs to $60K per offence
and the cost difference is cents per draft. Earlier versions of this file said "Codex Haiku",
which is both a corrupted identifier and the wrong model — a reader who believed it could
"optimise" the regulatory check onto a cheap model and never know the guardrail had moved.
**Do not change this tier without a compliance decision, not an engineering one.**

It also goes through the Gateway (not a provider directly) so it carries the same fallback,
no-training and zero-retention controls as every other call, and is tagged
`['compliance-review', 'regulated'|'unregulated']`.

**It is not "run automatically in `save_output`" and nowhere else.** Two chokepoints own it,
so a new code path cannot skip the check:

- `src/lib/agents/publish-gate.ts` — `checkPublishAllowed()` **runs** `runComplianceFilter` on every publishing path. Previously only the Mixpost tool checked, so scheduling or direct-publishing reached live accounts unreviewed.
- `src/lib/agents/save-gate.ts` — `complianceGateForSave(result)` **adjudicates** a `GuardianResult` the caller already produced; it does not call the filter itself. The outputs library is not passive storage: `query_outputs` is given to every department, so anything saved becomes something later work imitates; failed content must not be written down.

`grep -rln runComplianceFilter src` (run 2026-08-17) returns exactly nine non-test files:
`compliance-filter.ts` itself, `publish-gate.ts`, and then `save-output.ts`, `write-blog.ts`,
`write-ads.ts`, `write-email-campaign.ts`, `publish-to-social.ts`, `draft-post-tool.ts` and
`/api/compliance-check/route.ts`. **Add a new publisher or save path → route it through the existing
gate; do not re-implement the check.**

### Social Media Knowledge
`lib/agents/knowledge/social-media-benchmarks.ts` — platform benchmarks (engagement rates, CTR, CPC, video specs, posting times). Injected into agent prompts filtered by agent type (video gets video specs, analytics gets all formulas, etc.).

### Cross-Agent Learning
`query_outputs` tool (all agents) — search past outputs from any department. Memory extractor captures social metrics. Cross-department memories stored to `nrs-agency` global namespace.

### Client State (Zustand)
Single store `src/stores/agency-store.ts` — `useAgencyStore` persisted to localStorage key `nrs-agency`. Manages: `activeBrandId`, `activeAgentType`, `activeConversationId`, `activeView`, `sidebarOpen`, `pendingReviewMessage` (transient). Changing brand resets agent to `overall` and clears conversation.

### Stack
- **Next.js 15.5.21** (pinned exactly in `package.json`, NOT 16), **React ^19.2.0**, **Tailwind CSS ^4** (oklch only)
- **shadcn/ui v4** (base-ui — use `render` prop, NOT `asChild`)
- **Supabase** (3 clients: browser, server, admin)
- **Vercel AI SDK v6** `streamText` + AI Gateway (auto-injected via `@ai-sdk/gateway`)
- **Stripe** — checkout, portal, webhooks (`lib/stripe/`)
- **Resend** — transactional email
- **GSAP** + **Motion** (Framer Motion) — animations (landing page, about page)
- **IBM Plex Sans + Mono**, **lucide-react** icons
- **zustand** (client state), **Zod v4** (`zod/v3` import for AI SDK tool schemas)

### Room-Based Navigation (`lib/room-config.ts`)
Agency UI is organised into **4** rooms (tabs in header), in this order:
1. **Today** (`/agency/board`) — first in `ROOMS`, ahead of the Director's Office
2. **Director's Office** (`/agency/chat`) — primary chat interface, conversations
3. **Creative Studio** (`/agency/studio`, also matches `/agency/calendar`) — **no sub-tabs.** `room-config.ts` states they were deliberately removed in favour of a left sidebar, matching Mixpost Pro's layout, to avoid double navigation
4. **Command Centre** (`/agency/tasks`) — **11** sub-tabs: Tasks, Inbox, Agents, Approvals, Ads, Costs, Analytics, Activity, Settings, Team, Brands

Config: `src/lib/room-config.ts`. Components: `RoomTabs.tsx` (embedded in `AgencyHeader.tsx`), `RoomSubTabs.tsx`.

**Studio navigation is `StudioSidebar.tsx`, with 14 destinations:** Dashboard, Create Post,
Posts, Calendar, Media Library, Review, Templates, Brand Kit, Pages, Analytics, Hashtags,
Social Accounts, Posting Schedule, Webhooks. Note `StudioSidebar` is `hidden md:flex`, so
anything filed there is unreachable on a phone — which is why Inbox sits in the Command
Centre, not the Studio.

### Creative Studio — Intelligent Agency Dashboard
`StudioDashboard.tsx` — live feeds from all integrations. Chat panel auto-opens on Studio pages.

**Dashboard sections** (in order): Director's Brief, Social Connections (Mixpost), Week-at-a-Glance, Drafts Awaiting Action, Strategy & Pillars, Canva Designs, Video Plans, Competitor Intel, Agent Activity Ticker, Recent Content Feed.

**Data flow**: `useStudioData()` hook fetches from `GET /api/studio/overview?brandId=X` + `GET /api/canva/designs?brandId=X` in parallel.

**Create** (`/agency/studio/create`): renders **`PostCreator`** — the full composer. It is not
the six-intent-card screen. `CreateHub.tsx` still exists on disk but **has no importers
anywhere in `src/`**, so that screen is unreachable; treat it as dead code, not as the current
design.

**`/agency/studio/post` was retired** and now 307-redirects to `/agency/studio/create`. Two
composers was the fault: only `create` had the content validator and the per-platform options,
and every fix had to be written twice or it landed on one of them. The route survives as a
redirect so an old bookmark does not become a 404, and 307 rather than 308 so reversing it
later does not require asking a non-developer to clear his browser cache.

### Creative Studio v2 — Component Library
Phone-frame platform mockups (`preview/`, listed 2026-08-17 — the doc previously named six
platforms and missed five): PhoneFrame, MultiPlatformPreview, and **11** platform mockups —
Instagram, Facebook, LinkedIn, X, TikTok, YouTube, Bluesky, GoogleBusiness, Mastodon,
Pinterest, Threads. Note `PlatformMockupPreview` is **not a file**; it is exported from
`preview/index.tsx`, which is why grepping for the filename finds nothing.
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
/agency/board                  → "Today" room (first tab in ROOMS)
/agency/chat                   → Director's Office (new conversation)
/agency/chat/[conversationId]  → Existing conversation
/agency/studio                 → Creative Studio dashboard (left sidebar, no sub-tabs)
/agency/studio/create          → PostCreator — THE composer
/agency/studio/post            → 307 redirect → /agency/studio/create (retired second composer)
/agency/studio/{posts,calendar,media,review,templates,brand-kit,pages,analytics,
                hashtags,accounts,posting-schedule,webhooks}
                               → 12 of the 14 Studio sidebar destinations
                                 (the other two are /agency/studio itself and /create)
/agency/studio/{campaign,design,repurpose,video}
                               → real routes, NOT reachable from the sidebar
/agency/tasks                  → Command Centre → Tasks
/agency/inbox                  → Command Centre → Inbox (customer DMs/comments)
/agency/agents                 → Command Centre → Org chart + budgets
/agency/approvals              → Command Centre → Approval queue
/agency/ads                    → Command Centre → Ads
/agency/costs                  → Command Centre → Cost dashboard
/agency/brands                 → Brand list
/agency/brands/[brandSlug]     → Brand profile editor
/agency/calendar               → Calendar (matched by the Studio room)
/agency/outputs                → Output library (still a live page)
/agency/media                  → Media library (still a live page)
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
/api/cron/publish-posts              → Cron (5 min): delegates to publishToPlatform in the dispatcher
/api/cron/recover-director-jobs      → Cron (5 min): recover stalled async Director jobs
/api/cron/daily-intel                → Cron (daily 20:00): daily intelligence research
/api/cron/web-vitals                 → Cron (weekly Mon): Core Web Vitals report
/api/cron/weekly-traffic             → Cron (weekly Sun): site traffic report
/api/media/process                   → Media processing pipeline (browser uploads)
/api/scheduled-posts/publish-now     → Publish a scheduled row immediately. NOT yet behind the
                                       dispatcher — calls createMixpostPost directly, so it
                                       cannot reach Zernio. See Publishing → Migration status
/api/zernio/{accounts,ads,analytics,connect,callback} → Zernio surface
/api/webhooks/mixpost                → Mixpost Pro webhook receiver (9 events, HMAC SHA-256)
/api/webhooks/zernio                 → Zernio inbox webhook (message.received, comment.received)
/api/webhooks/telegram               → Telegram bot webhook
/api/compliance-check                → Standalone AHPRA/TGA check
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
- `scheduled_posts` table tracks draft → scheduled → publishing → published flow. It is **one row per platform**, so the row's own caption IS the per-platform variant
- Cron publisher (`/api/cron/publish-posts`, every 5 min) delegates to `publishToPlatform` in `src/lib/publishers/dispatcher.ts` — Zernio → native → Mixpost. There is no Ayrshare fallback
- Provider settings: Deepgram in Brand Settings → Video tab
- `PublisherPlatform` (`src/lib/publishers/types.ts:9-16`) is exactly six: `facebook`, `instagram`, `linkedin`, `tiktok`, `youtube`, `twitter`. **Scheduled** posts reach them through whichever transport the dispatcher selects for that brand; **Publish now** and the `publish_to_social` tool still go straight to Mixpost — see Publishing → Migration status

### Department-Specific Quick Actions
`QuickActions.tsx` shows contextual buttons per department (not generic). **15 sets of 4–6
buttons** (counted 2026-08-17) with conditional AHPRA/TGA compliance prompts, website scan
prompts, and GitHub scan prompts based on brand config. The 15 are not the 15 live agent types:
the set covers the archived `martech` (6 buttons) but has **no `help` set**, so Get Help falls
through to the generic default.

### Database Tables

**The live public schema has 64 tables** (counted against project `uyhtrwlotoriblicqqrl` on
2026-08-17) across **55 migrations**. The 22-table list this section used to carry was a
snapshot, not an inventory, and reading it as complete is how a write lands on a table nobody
documented. **Check `src/types/database.ts` or run `list_tables` before writing an update.**

Core, roughly by area — **51 of the 64**, all confirmed present 2026-08-17:

```
Identity & access:  users, brands, team_members, api_keys, oauth_clients,
                    oauth_auth_codes, project_access_grants,
                    api_key_project_grants, project_links, project_connectors
Conversation:       conversations, messages, brand_conversation_log
Agents:             agent_configs, agent_registry, agent_memories, goals, tasks,
                    approval_queue, heartbeats, director_runs, director_evidence,
                    mcp_jobs, execution_audit
Content & media:    outputs, media_items, media_tags, media_collections,
                    media_usage, media_intake_links, post_templates,
                    hashtag_groups, post_activity
Publishing:         scheduled_posts, posting_schedule_slots, publisher_runs,
                    publisher_retry_queue, social_oauth_tokens, user_webhooks
Knowledge:          brand_proforma_sections, project_scans, account_entities
Ops & billing:      audit_log, ai_usage, user_integrations,
                    connection_health_events
Integrations:       telegram_accounts, telegram_groups,
                    telegram_project_sessions, github_app_installations,
                    github_repository_bindings
```

The **13 not named above**, so the gap is stated rather than implied: `compliance_scans`,
`diagnostics`, `github_connect_requests`, `github_installation_repositories`,
`inspiration_entries`, `media_collection_items`, `memory_maintenance_runs`, `phases`,
`regulations`, `telegram_pair_codes`, `tools`, `user_phases`, `user_webhook_deliveries`.

`audit_log` is append-only. Budget is stored in **cents** (integers).

### Three Supabase Clients (don't mix)
- `lib/supabase/client.ts` — browser
- `lib/supabase/server.ts` — server (RSC, API routes)
- `lib/supabase/admin.ts` — service role (webhooks, heartbeat)

### Tool Implementation Pattern
**80 files in `src/lib/agents/tools/`** (72 non-test `.ts` plus 8 `.test.ts`, counted 2026-08-17).
Factory functions take context (`supabase`, `userId`, `brandId`) and return AI SDK tool objects
with Zod schemas. `tools/index.ts` assembles the per-agent set via `getToolsForAgent()`.

- Import Zod as `import { z } from 'zod/v3'` for tool schemas — v4 shapes break AI SDK.
- **Nine** management tools are shared across all agents: `create_task`, `request_approval`, `handoff_to_department`, `query_outputs`, `read_proforma`, `get_brand_kit`, `project_brief`, `goal_interview`, `sync_brand_to_canva`. (`save_output` is **not** one of them.)
- **A tool's returned string is read aloud to the owner**, so it may not interpolate a raw error. Log with `console.error`, or pass through `userSafeError()` first. Enforced by `src/lib/errors/no-raw-errors.test.ts`.

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
- **AHPRA/TGA compliance** — **$60,000 per offence**. (An earlier version of this line said
  "$60K/$120K". The $120K figure appeared once, unsourced, and contradicted every other
  statement of it in this repo — AGENTS.md's own Compliance Filter section, README.md:126,
  `docs/ARCHITECTURE.md` and `CLAUDE.md`. It is removed rather than replaced with a second
  guess: a regulatory penalty figure gets sourced to the legislation or it does not appear.)
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
- **Default model:** `GATEWAY_MODELS.agency` = **`anthropic/claude-sonnet-5`** (overridable per agent in `agent_registry.model`). Never write a model id from memory — `src/lib/ai/model-routing.ts` is the only source of truth.
- **Cost calculation:** `estimateGatewayCost(modelId, usage)` in `model-routing.ts`. It uses a **per-model** `GATEWAY_MODEL_PRICING` table with separate cache-read and cache-write rates, sums input + cacheRead + cacheWrite + output in USD, then `Math.ceil(usd * 100)` for budget cents while keeping the precise USD figure for reporting. **There is no flat `0.3 / 1.5` constant** — that formula applied one old rate to every model and is gone.
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
  These are Mixpost **connected accounts**, not `brands` rows — do not read one as the other.
  The list below is carried over from the Cowork import and was **not** re-verified in the
  2026-08-17 pass (it needs the live Mixpost VPS). Re-derive it rather than trusting it:
  `GET /api/mixpost/accounts`, or `fetchMixpostAccounts` in `src/lib/mixpost/client.ts`.

  - Downscale: Facebook, Instagram, LinkedIn
  - TeleScribe: Facebook (x2), Instagram, YouTube, TikTok
  - Scent Sell: Facebook, Instagram (x2), YouTube
  - DownscaleDerm: Facebook, Instagram
  - Man Clinic: Facebook
  - EndorseMe: Facebook
  - Justin Black: LinkedIn (personal)

  ### Brand Rules
  - Each brand has its own identity. NEVER cross-post between brands
  - **The regulated set is `brands.compliance_flags`, not this list.** Read the flag, do not
    recall the brand name. Checked live 2026-08-17, the four **active** brands carrying a flag
    are **Black Health Intelligence** (ahpra), **Downscale Weight Loss** (ahpra + tga),
    **EndorseMe** (ahpra) and **TeleCheck Clinic** (ahpra). Two inactive rows also carry flags
    — DownscaleDerm (ahpra + tga) and Tele360 (ahpra) — so they regain the restriction the
    moment they are reactivated. **TeleScribe is `{ahpra: false, tga: false}`** and is not
    regulated. AHPRA/TGA fines run to $60,000 per offence
  - An earlier version of this block named "Downscale, TeleScribe, DownscaleDerm, EndorseMe".
    That both over-restricted TeleScribe and omitted Black Health Intelligence and
    TeleCheck Clinic. Getting the regulated set wrong is a compliance error, not a typo
  - Health content: no testimonials, no before/after, no guaranteed outcomes, no naming specific medications
  - Scent Sell, Sniffopotamus, Underground Parfums, Do Today, TeleCheck, TeleScribe and NRS carry no compliance flag
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
