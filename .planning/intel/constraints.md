# Constraints (SPEC-class intel)

Extracted from classifications typed `SPEC`. Twelve source documents: five design specs (precedence 10) and seven implementation plans (precedence 20).

---

## Human approval is mandatory at every publishing step
- source: docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md
- type: protocol
- content: "Human oversight is mandatory at every publishing step. AI assists, human decides. Nothing goes live without human approval. Especially for healthcare brands where AHPRA/TGA violations cost $60K per offence." Design principle 4: "Nothing publishes without human review. Healthcare or not. Review room is mandatory." Design principle 8: "MCP access follows the same rules. Drafts from any client land in Review. Human approves on web." For healthcare brands the Approve button is DISABLED until compliance passes.

## Creative Studio is a four-room content pipeline
- source: docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md
- type: protocol
- content: Three areas — Director's Office (strategy & intelligence), Creative Studio (content pipeline), Command Centre (operations & analytics). Creative Studio has four rooms: CREATE → REVIEW → SCHEDULE, plus an always-accessible Media Pantry. Tab structure change: "BEFORE: All Content | Calendar | Media | Create | Grid Planner (default: All Content). AFTER: Create | Review | Schedule | Media (default: Create)." Grid Planner folds into Create; All Content folds into Command Centre; Calendar becomes the Schedule room.

## Each content type opens a completely different form
- source: docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md
- type: protocol
- content: Step 1 of CREATE is content-type selection and the ENTIRE form changes based on it — Single Post (1 image slot + caption + hashtags), Carousel (2-10 numbered slide builder + text per slide + brand templates), Short Video (upload/record + script editor + caption overlay + thumbnail), Long Video (upload + title + description + thumbnail + tags + categories), Story (9:16 slot + sticker/text overlay + poll/question tools), Advertisement (ad creative + headline + body + CTA button + audience notes). Design principle 2: "Each content type = completely different form. Not generic. Tailored like Scent Sell." Design principle 7: "AI integrated per section, not globally."

## Platform list is per-brand, configured at brand setup
- source: docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md
- type: protocol
- content: Supported at launch — Instagram (Feed, Reels, Stories, Carousels), Facebook (Feed, Reels, Stories, Groups), LinkedIn (Feed, Articles, Documents), YouTube (Videos, Shorts), X/Twitter (Tweets, Threads). Later — TikTok (pending app review), Reddit, Google Business Profile, Pinterest. Per-brand settings: which platforms are active, connected accounts per platform, post signature (mandatory attribution), compliance flags (AHPRA, TGA, general), content pillars, posting frequency targets. Incompatible platforms are greyed out based on content type.

## The pipeline is a loop — published content feeds learning
- source: docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md
- type: protocol
- content: Create → Review → Schedule → Published → Analyse → Learn → (Repurpose | Re-share | New content) → Review. Analysis shows per published post: engagement metrics (likes, comments, shares, saves, reach, clicks), benchmark comparison, AI insights, re-publish options. All re-published content goes through Review again before publishing. The Director uses this to update the 30-60-90 plan, adjust content-type recommendations, shift platform focus, refine brand-voice understanding and report monthly.

## Server-enforced project scope precedes every operation
- source: docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md
- type: protocol
- content: Non-negotiable rules — (1) NRS is marketing-only: strategy, social, copy, SEO, ads, approved email drafts, website messaging, aggregate marketing analytics and publishing. (2) A request receives one server-enforced project scope before any prompt, memory, tool, job, output or connector query occurs. (3) Project context is private by default; the Director does not receive sibling projects, owner-wide work context or agency-wide memory by default. (4) Cross-project work is possible only through an explicit, auditable project link recording both projects, purpose, allowed marketing data and expiry. (5) Patient, clinical, personal, customer, confidential operational and private lab data is rejected at the channel boundary, and raw rejected content is not written to prompts, jobs, memories or audit details. (6) Publishing, sending and any other external side effect remains approval gated; approval never grants access beyond the current project scope. (7) Telegram remains disabled until the entire acceptance suite passes and the BotFather token has been rotated. Status: "Approved by Justin, 24 July 2026."

## ExecutionScope is the typed server-side scope contract
- source: docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md
- type: api-contract
- content: Flow — `Web / MCP / Telegram → identity and channel grant → ExecutionScope(actor, project, channel, capabilities, approvedLinks) → data-boundary gate → scoped Director → project-only memory, proforma, assets, outputs, connectors and analytics → Review / explicit approval / publisher`. `ExecutionScope` is a typed server-side value passed to every service and repository. A client-supplied `brand_id` is only a requested project; it is accepted only when the verified grant permits it.

## ExecutionScope implementation shape
- source: docs/superpowers/plans/2026-07-24-nrs-project-boundary-foundation.md
- type: api-contract
- content: `export type ExecutionChannel = 'web' | 'mcp' | 'telegram' | 'internal'`; `export interface ExecutionScope { actorId: string; projectId: string; channel: ExecutionChannel; capabilities: readonly string[] }`; `createExecutionScope()` returns a frozen value; `assertProjectScope(scope, projectId)` throws "Requested project is outside the active project scope." when they differ. Files: `src/lib/security/execution-scope.ts` + `.test.ts`.

## Marketing data boundary gate
- source: docs/superpowers/plans/2026-07-24-nrs-project-boundary-foundation.md
- type: api-contract
- content: `inspectMarketingInput(input): { allowed: true } | { allowed: false; reason: string }` in `src/lib/security/marketing-data-boundary.ts`. Deterministic conservative detection against prohibited patterns (patient, DOB/date of birth, medication/diagnosis/clinical note, appointment, email addresses). Rejection reason: "Use the approved secure system for patient, clinical or personal information." Global constraints of the plan: Telegram webhook stays disabled and no code path may re-enable it; NRS stays marketing-only; scope enforcement is code, not a prompt instruction; no live schema migration is applied in this plan; every new behaviour starts with a failing Node test.

## Director prompt construction is project-only by default
- source: docs/superpowers/plans/2026-07-24-nrs-project-boundary-foundation.md
- type: protocol
- content: `buildSystemPromptWithMemory()` accepts an explicit scope object; default Director retrieval reads only its brand and department namespaces. "Do not fetch sibling brands or users.work_context in normal Director paths. Do not query getGlobalNamespace() for any ordinary project scope. Query only getNamespace(brand.slug, agentType) and getBrandNamespace(brand.slug)." Execution record (24 July 2026): removed default owner work context, sibling-project context and global-agency memory retrieval from both web and MCP Director prompt paths; removed global-agency writes from the conversation memory extractor; replaced the Telegram webhook with a fail-closed maintenance response creating no jobs, reading no memory and listing no projects; added `tsx` as the local test runner. Verified `npm test` (50 passing), `npm run lint` (0 errors, 41 existing warnings), `npm run build` successful.

## Deferred data-model changes requiring separate migration approval
- source: docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md
- type: schema
- content: `api_keys` (scopes, capabilities, expiry, policy version); `project_access_grants` (actor-to-project grants for MCP and channels); `project_links` (explicit cross-project links with purpose, permitted data classes, approval record, expiry); `project_connectors` (marketing source contracts and health state); `channel_accounts` and `channel_sessions` (verified Telegram pairing and non-memory project selection); `execution_audit` (redacted policy decisions, scope ID, output class); project-bound memory metadata or a dedicated memory table keyed by project ID.

## Project connector data-class allow-list
- source: docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md
- type: api-contract
- content: A connector declares source, credentials reference, allowed data classes, read/write mode, freshness, provenance and health. Initial allowed classes: public website facts, approved product/catalogue facts, approved assets, connected social account metadata, aggregate marketing performance. Examples — Downscale and Do Today: public positioning, approved marketing material and aggregate campaign performance only; never Halaxy, patient accounts, chats, health logs, appointment data or clinic recipient lists. Scent Sell: approved public product/listing data and marketing assets only. Underground Parfums: approved public product/launch material and marketing analytics only; never formulae, bench stock, costs, unreleased work or lab records. "Mixpost remains the owned publishing bridge. Any external distribution adapter is bounded by the same connector contract and is never NRS's source of truth."

## Project-boundary acceptance evidence
- source: docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md
- type: nfr
- content: A sentinel stored for Do Today cannot appear in Downscale or Scent Sell prompts, outputs, tools or Telegram replies. A standard MCP key restricted to Downscale cannot enumerate or invoke any other project. An explicit approved link can expose only its declared marketing facts. Patient/clinical/PII input is rejected before a job or memory is created. A Telegram project-specific channel cannot display a project picker or use a non-fixed project; a generic NRS channel lists only the paired grants. Publishing is impossible without a current-project approval. The production proof uses seeded, synthetic sentinel text only; no patient or real confidential data.

## MCP direct-tool allowlist keeps publication Director-only
- source: docs/superpowers/specs/2026-07-24-publishing-and-verification-hardening-design.md
- type: api-contract
- content: "The MCP adapter will use an explicit direct-tool allowlist: read-only queries plus a small set of bounded utilities. External publication and finalisation tools—including `publish_to_social`, `blotato_publish`, `send_email`, and `manage_posts`—therefore stay Director-only by default. They remain available to the web Director and internal agent loop, but an external MCP client must use `chat_with_director`, where the existing current-conversation approval rule and Review queue context apply." Alternatives rejected: an approval token for direct MCP publishing (the approval queue has no atomic one-time consumption state and adding one requires a live schema migration); leaving direct publishing exposed with a stronger prompt (prompts do not structurally prevent a direct MCP caller invoking the tool).

## Mixpost webhook fails closed outside development
- source: docs/superpowers/specs/2026-07-24-publishing-and-verification-hardening-design.md
- type: api-contract
- content: Signature verification moves into a small dependency-free helper. The route accepts a missing webhook secret only when explicitly running in `development` or `test`; preview and production deployments return a configuration error instead of accepting the event. Valid HMAC signatures remain accepted; invalid signatures remain rejected.

## Publishing-hardening acceptance criteria
- source: docs/superpowers/specs/2026-07-24-publishing-and-verification-hardening-design.md
- type: nfr
- content: Only reviewed read-only or bounded utilities are registered as direct MCP tools; `publish_to_social`, `blotato_publish`, `send_email` and `manage_posts` are not. MCP guidance tells clients to ask the Director to publish after review rather than invoking the tool directly. A missing Mixpost webhook secret is rejected outside `development` and `test`. Valid HMAC signatures remain accepted and invalid signatures remain rejected. `npm test` runs all committed TypeScript node:test files. GitHub Actions runs test, lint and production build for `main` and pull requests. Dependency updates are applied only when the package manager identifies a compatible, non-breaking remediation and all quality gates remain green.

## Publishing-hardening implementation contracts
- source: docs/superpowers/plans/2026-07-24-publishing-and-verification-hardening.md
- type: api-contract
- content: `isDirectorOnlyMcpTool(name: string): boolean` returning `DIRECTOR_ONLY_MCP_TOOLS.has(name)`, asserted true for `publish_to_social`, `blotato_publish`, `send_email`, `manage_posts`. `type MixpostSignatureResult = { ok: true } | { ok: false; reason: 'missing-secret' | 'missing-signature' | 'invalid-signature' }` in `src/lib/webhooks/mixpost-signature.ts`. Route returns HTTP 503 for a missing secret and 403 for a signature failure. CI workflow `.github/workflows/quality.yml` runs `npm ci`, test, lint and build on pushes to `main` and pull requests. Global constraints: do not migrate Supabase or alter database schema; preserve existing user-owned working-tree changes; do not expose a new direct publish path; dependency remediation must avoid a major-version migration. All four tasks are marked complete (`[x]`) in the source.

## Telegram chief global constraints
- source: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md
- type: protocol
- content: Telegram is natural language first — never tell Justin to type `/` for routine work; slash parsing is retained only as undocumented backwards compatibility. A Telegram session has exactly one active project; a plain-language switch request opens an explicit project picker, wording alone never expands scope. Every connector is project-bound, read-only by default, and limited to a named resource contract; never retrieve raw database tables, customer lists, patient data, credentials or source secrets. NRS may propose a backend or conversion optimisation with evidence, expected marketing impact, risk, rollback and implementation owner, but never changes a product backend, customer journey, pricing, messages or data model without explicit approval and a separate project-scoped execution path. Brand facts, founder decisions, preferences, generated drafts and performance outcomes are separate data classes; generated copy is never promoted to fact merely because the model wrote it. Live website/repository/social evidence overrides conflicting stale memory, is time-stamped and cited internally. All publishing, messaging to customers, email, paid spend and data export remain explicit approval actions. Telegram output is concise plain text with no Markdown delimiters, no generic praise, no unexplained claims and no vague "want me to?" ending. Keep the current explicit project-grant, scope-proof, audit and webhook-secret controls. Move the durable agent brain to Eve only behind parity tests and a reversible cutover; do not rewrite the live bot in place.

## Evidence pack contract
- source: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md
- type: api-contract
- content: `EvidenceItem` with `projectId`, `sourceType`, `sourceUrl`, `observedAt`, `freshUntil`, `claim`, `excerpt`, `confidence`, `classification`. Bounded source collectors: configured public website and sitemap, selected GitHub App paths, approved social profiles, aggregate analytics only. Reject unconfigured URLs, public web claims without a source, repositories without an active binding, private paths outside the allow-list, and any detected customer/patient data. The evidence pack is persisted against the run, not as invisible prompt text, so every conclusion can be reviewed later.

## Work contract types
- source: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md
- type: api-contract
- content: Contracts for `site_review`, `marketing_audit`, `launch_plan`, `campaign_pack`, `content_pack`, `competitor_research` and `status_update`. Each requires inputs, evidence threshold, structured output and one next action rather than an open-ended chat response. Short commands such as "scan the site" become deterministic source-first jobs; a specialist is used only when it materially improves the defined deliverable. The Director must label uncertainty and missing evidence rather than inventing positioning, analytics, testimonials, compliance status or repository facts.

## Marketing-intelligence connector contract
- source: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md
- type: api-contract
- content: Versioned first-party contract with narrow read tools: `get_marketing_snapshot`, `get_funnel_summary`, `list_approved_marketing_assets`, `get_verified_product_facts`, `list_optimisation_opportunities`. Every result must contain project id, source timestamp, aggregation level, freshness and a data-class declaration. Reject customer identifiers, message bodies, medical information, payment details, addresses, credentials and unrestricted SQL/filter inputs at the connector boundary. Connectors registered per project in `project_connectors` with explicit allowed resources and expiry. Scent Sell is the first proof connector. An optimisation-proposal tool produces observation, marketing impact, affected product surface, proposed change, evidence, risk/compliance note, rollback and owner approval needed; it saves a proposal or GitHub issue/draft only after explicit approval and never changes the backend itself.

## Project learning taxonomy
- source: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md
- type: schema
- content: Four distinct learning types — `founder_decision`, `brand_preference`, `verified_fact`, `measured_outcome`. Every learning item carries `brand_id`, provenance, confidence, freshness, source/run id and active/quarantined review state. Ambiguous legacy and generated-only memories are quarantined and never enter a Telegram prompt until reviewed. Retrieval uses semantic relevance plus recency and confidence, always filtered by active project id. Duplicates are consolidated and source facts expire without rewriting founder decisions. Migration `supabase/migrations/041_telegram_marketing_chief.sql` adds the durable run/evidence/learning schema, RLS and provenance checks after explicit migration approval.

## Telegram delivery format
- source: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md
- type: protocol
- content: One plain-text delivery formatter with `What I found`, `What I recommend`, `Ready to use`, and `Next action` only when relevant. Strip Markdown and AI scaffolding after generation; reject malformed answers before delivery and make one bounded repair pass using the work contract. Include source names and freshness in an internal detail record. Inline buttons for safe follow-ons only: `Save plan`, `Make posts`, `Change project`, and approval-request actions — buttons do not publish or message anyone.

## Telegram chief definition of done
- source: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md
- type: nfr
- content: Justin never needs a slash command. Every reply identifies the active project, completes a defined job, and stays free of raw Markdown and generic filler. NRS can research the project's approved website, selected repository, approved social profiles and aggregate analytics. NRS can query each opted-in project's approved backend marketing-intelligence contract and turn evidence into a safe, approval-gated proposal. It learns direct founder corrections and measured outcomes for that project only, with provenance and a way to review/expire facts. It cannot use or reveal another project's context, private repository paths outside the allow-list, customer/patient information or credentials. It never publishes or broadcasts without an explicit approval event. A real Telegram rehearsal and the automated evaluation suite prove those statements. Execution order: Tasks 1–5 as the first live-value release; Tasks 6–7 extend learning and migrate to Eve once proven; Task 8 is a release gate, not optional clean-up.

## Creative Studio Create tab becomes a launchpad into six rooms
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: protocol
- content: Context — "The Creative Studio Create tab currently shows 6 dead intent cards that don't work." The spec redesigns the Create tab as a launchpad into 6 full-screen creation workspaces. Routes: `/agency/studio` (Dashboard/All Content, existing), `/agency/studio/video` (Video Room), `/agency/studio/design` (Design Room), `/agency/studio/post` (Post Composer), `/agency/studio/campaign` (Campaign Planner), `/agency/studio/repurpose` (Content Repurposer), plus the existing Calendar tab enhanced. Launchpad cards map to primary agents: Video, Brand, Content, Director, Content, Strategy.

## Founding principles for the studio rooms
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: protocol
- content: (1) The user has OPTIONS — AI does it, edit yourself, or both. (2) Strategy guides everything — the Strategist agent ensures content aligns with the plan, mix and goals; no ad-hoc posting. (3) Director reviews everything — nothing gets published without Director quality gate + compliance check + memory storage. (4) Same brain everywhere — all rooms share agent memory, brand context, outputs, calendar and media library. (5) Non-technical user — one click to value.

## Shared brain layer and Director quality gate
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: protocol
- content: Every room connects to agent memory (`nrs-{brandSlug}-{agentType}` namespaces), brand context auto-injected via `buildSystemPromptWithMemory()`, the `outputs` table, `scheduled_posts`, the Supabase `media` bucket, the chat panel (Director follows into every room via the `nrs-send-chat` DOM event), Mixpost, and the audit log. Quality-gate lifecycle: user creates content → specialist agent does work → Director reviews (AHPRA/TGA compliance if health brand, brand voice consistency against DNA, strategy alignment, cross-brand awareness, publish-ready gate) → Director approves → saves to outputs + memory → memory updated → available everywhere.

## Strategy layer inputs
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: api-contract
- content: Before content is created in ANY room the Strategy agent pre-calculates content mix target (80/20 value vs promotional or brand-specific), content type balance (entertainment / education / inspiration / promotional), platform allocation vs actual (`channel_strategy` percentages), content pillar rotation, posting frequency target vs actual, and 30/60/90 day plan milestones. `useStrategyContext()` calculates from `scheduled_posts` (this week), `brand.channel_strategy`, `brand.content_pillars`, agent memory, and proforma `thirty_sixty_ninety`. `StrategyBrief` renders at the top of every room. When "AI does it" is clicked, strategy context is automatically embedded in the message to the Director.

## Content tagging columns
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: schema
- content: New columns on `scheduled_posts`: `content_type` TEXT (entertainment | education | inspiration | promotional) and `content_pillar` TEXT (from the brand's content_pillars array). Same two columns on `outputs`. No new tables required.

## Content tagging migration and types
- source: docs/superpowers/plans/2026-04-05-studio-foundation.md
- type: schema
- content: `supabase/migrations/020_content_tagging.sql` — `ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS content_type TEXT, ADD COLUMN IF NOT EXISTS content_pillar TEXT;` and the same for `outputs`, with column comments. TypeScript: add `content_type?: 'entertainment' | 'education' | 'inspiration' | 'promotional' | null` and `content_pillar?: string | null` to the `ScheduledPost` and `Output` interfaces, plus `export type ContentType = 'entertainment' | 'education' | 'inspiration' | 'promotional'`.

## Studio foundation build order
- source: docs/superpowers/plans/2026-04-05-studio-foundation.md
- type: protocol
- content: Goal — build the shared foundation (strategy layer, chat panel fix, room routing, launchpad) that all 6 Creative Studio rooms depend on. Architecture — strategy context hook calculates what content is needed from brand data + scheduled posts; StrategyBrief renders at the top of every room; the chat panel uses DOM events (not Zustand) for reliable message sending; the Create tab becomes a launchpad linking to room routes; content tagging via new DB columns. Overall spec build order: (1) strategy layer, (2) chat panel DOM event fix, (3) Create tab launchpad, (4) Post Composer, (5) Design Room, (6) Content Repurposer, (7) Campaign Planner, (8) Video Room, (9) Calendar enhancement.

## Room-to-chat communication uses a DOM event, not Zustand
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: api-contract
- content: All rooms communicate with the chat panel via the `nrs-send-chat` custom DOM event, bypassing the broken Zustand effect chain: `window.dispatchEvent(new CustomEvent('nrs-send-chat', { detail: { message: contextRichMessage } }))`, with the existing ChatPanel listener calling `handleSendRef.current(e.detail.message)`. Implemented as `sendToDirector(message)` in `src/lib/chat-dispatch.ts`.

## Platform character limits
- source: docs/superpowers/plans/2026-04-05-content-rooms.md
- type: api-contract
- content: `PLATFORM_LIMITS` — instagram 2200, facebook 63206, linkedin 3000, twitter (X) 280, tiktok 2200, youtube 5000 characters, each with label and lucide icon name. Post Composer and Content Repurposer both consume this reference.

## Content rooms existing infrastructure (do not rebuild)
- source: docs/superpowers/plans/2026-04-05-content-rooms.md
- type: protocol
- content: `RoomLayout.tsx` (shared room shell with back button + strategy brief), `useStrategyContext.ts`, `StrategyBrief.tsx`, `src/lib/chat-dispatch.ts` (`sendToDirector`), stub route pages for `/agency/studio/post` and `/agency/studio/repurpose`, `useStudioData.ts`, `/api/scheduled-posts`, `/api/outputs`, `src/types/database.ts` types, `src/stores/agency-store.ts`, and agent tools `fill_calendar`, `write_blog`, `manage_posts`, `repurpose_content`, `query_outputs`. Tech stack addition: Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-character-count`).

## Campaign Planner and Calendar enhancement contracts
- source: docs/superpowers/plans/2026-04-05-planning-rooms.md
- type: api-contract
- content: Campaign Planner uses `sendToDirector` to trigger `convene_meeting` with 6 departments; results displayed in a timeline/card view. Calendar enhanced with FullCalendar for drag-and-drop, strategy overlay and bulk actions. `CampaignBriefData { name: string; goal: string; duration: CampaignDuration; audience: string }` with `CampaignDuration = '1_week' | '2_weeks' | '1_month' | '3_months'`. Dependency: the Foundation plan must be complete.

## Campaign Planner department roster
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: protocol
- content: One creation path — the Director runs `convene_meeting` with 6 departments in parallel: Strategy (timeline, milestones, success metrics), Content (social posts, blog articles, scripts), SEO (keyword targets, landing page optimisation), Email (nurture sequence, launch announcement), Paid Ads (ad copy, targeting, budget allocation), Compliance (AHPRA/TGA review of everything). Results in a Gantt-style timeline with expandable department cards; "Generate assets" buttons trigger delegation; everything saves to outputs + calendar.

## Visual rooms production paths and existing assets
- source: docs/superpowers/plans/2026-04-05-visual-rooms.md
- type: protocol
- content: Video Room has 3 paths (AI generates; manual edit via Twick; bulk import via C.A.M.). Design Room has 3 paths (AI designs via Canva API; browse/edit in Canva; upload own). Both use RoomLayout, `sendToDirector` for AI, and strategy context. Existing assets not to be recreated include `/api/video-toolkit/*`, `/api/canva/{designs,auth,callback}`, `/api/media/{upload,transcribe}`, `VideoCreatePanel.tsx`, `src/lib/agents/tools/canva.ts` (`design_graphic`, `export_design`, `search_designs`, `list_brand_kits`, `get_design`, `list_folder_items`, `search_folders`) and `process-media.ts`. Canva key retrieval: user-specific key from `user_integrations` first, then `process.env.CANVA_API_KEY`.

## Canva format dimensions
- source: docs/superpowers/plans/2026-04-05-visual-rooms.md
- type: api-contract
- content: `FORMAT_DIMENSIONS` — instagram_post 1080x1080, instagram_story 1080x1920, facebook_post 1200x630, linkedin_post 1200x627, twitter_post 1600x900, tiktok_video 1080x1920, youtube_thumbnail 1280x720, presentation 1920x1080, a4_document 595x842.

## Studio tech stack additions
- source: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md
- type: protocol
- content: Twick (video editor, React SDK, MIT), Tiptap (headless rich text, MIT), FullCalendar (drag-and-drop calendar, MIT), OpenClaw Video Toolkit (Remotion + cloud GPU, already installed), SVAR React Gantt (campaign timeline, MIT), ffmpeg.wasm (client-side video processing, LGPL).

## Post Creator — ten card sections
- source: 2026-04-08-post-creator-redesign.md
- type: protocol
- content: Rebuild the NRS Post Composer (`/agency/studio/post`) to the Scent Sell listing-form quality standard. Ten sections: (1) Media Slots — platform-aware cover/carousel(up to 10)/video slots, aspect ratio indicators (1:1, 4:5, 9:16, 16:9), HEIC conversion, orientation fix, Supabase upload, per-slot "Generate an image", pull from media library. (2) Platform Selector — visual cards with icons, not a dropdown; multi-select; per-platform format requirements. (3) Content Type — visual preset cards (Post, Carousel, Short Video, Long Video, Story, Ad) that auto-adjust media slots. (4) Caption Editor — AI auto-generates from media + brand + strategy; manual edit always available; per-platform character count with warnings; platform version tabs; "Make it punchier"/"Add hook"/"Make longer". (5) Hashtags — saved groups per brand, AI suggestions, per-platform counts (30 IG, 5 TikTok). (6) Post Template — saved templates with `{variable}` substitution. (7) Schedule — date/time picker, best-time suggestion, Australian timezone aware. (8) Compliance Check — auto AHPRA/TGA check for health brands, warnings for claim language and before/after images, "This is a health-related post" toggle for stricter checks. (9) Live Preview — platform mockups updating in real time. (10) Sticky Action Bar — Save Draft, Schedule, Publish Now (immediate via Mixpost), "Ask Director".

## Post Creator platform and content-type coverage
- source: 2026-04-08-post-creator-redesign.md
- type: protocol
- content: Platforms — TikTok, Instagram (Feed, Reels, Stories), Facebook (Feed, Reels, Stories), LinkedIn (Feed, Video, Articles), YouTube (Long-form, Shorts), X/Twitter. Content types — single post (image + caption), carousel (multi-slide), short video (Reels/Shorts/TikTok, 9:16), long video (YouTube/LinkedIn, 16:9), stories (ephemeral, 9:16), advertisement (paid — needs CTA and targeting notes). Key difference from Scent Sell: "Scent Sell is a marketplace listing form… NRS is a content creation form… The AI aspect is the differentiator — AI writes the first draft, you refine."

## Post Creator reuse inventory
- source: 2026-04-08-post-creator-redesign.md
- type: api-contract
- content: Reuse `PostEditor.tsx`, `PlatformPreview.tsx`, `PostScheduler.tsx`, `PostTypeSelector.tsx`, `MediaSelector.tsx`, `CarouselPreview.tsx`, `PlatformVersionEditor.tsx`, `HashtagGroupPicker.tsx`, `PostTemplatePicker.tsx`, the 7 platform mockups in `preview/`, `ImageEditorModal.tsx` (13 crop presets), `MediaUploader.tsx`, `src/lib/post-versions.ts` (`PLATFORM_CHAR_LIMITS`, `createVersionsFromMaster`) and `src/lib/template-variables.ts` (8 built-in variables). Existing endpoints: `PATCH /api/scheduled-posts`, `POST /api/scheduled-posts`, `POST /api/media/upload`, `POST /api/media/{id}/generate`, `GET /api/hashtag-groups`, `GET /api/post-templates`.
