# Decisions

Extracted from the ingest set at `.planning/intel/classifications/`.

**Provenance note — read before using this file.** The ingest set contains **no ADR-class documents**. Every entry below is a decision statement embedded inside a SPEC. All are therefore recorded as `status: proposed`, never `locked`, and none carries ADR authority. No decision in this file may be treated as immovable by the roadmapper. Where a decision has been overtaken by verified code reality, the entry says so and points at the conflict report.

---

## D-01: Build our own composer components; do not embed a third-party frontend
- source: docs/specs/nrs-creative-studio-redesign-research.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: Build NRS's own React components using MIT-licensed npm packages (`react-filerobot-image-editor`, `@dnd-kit/core` + `@dnd-kit/sortable`, `@fullcalendar/react`, `html-to-image`). Do NOT embed Mixpost's Vue frontend. Do NOT take Postiz as a dependency. Study competitor patterns, build our own.
- scope: Creative Studio composer, image editor, carousel builder, calendar, grid planner

## D-02: The Creator is the single content workspace — never build a separate edit screen
- source: docs/specs/nrs-creative-studio-definitive-architecture.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: One Creator component handles both new-post creation and existing-draft editing, selected by a `draftId` prop. Three entry points converge on it: Media Library ("Start your post?"), fresh Create tab, and Review/Drafts ("Alter"). Never build a separate "edit post" screen.
- scope: Creative Studio Creator, Media Library, Review/Drafts tab, navigation

## D-03: NRS is a hybrid human + AI creative workspace, not an AI factory
- source: docs/specs/nrs-creative-studio-definitive-architecture.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: The human is always the creative director, never just an approver. AI assists inline at every step; the system teaches marketing as the user works. Not a form, not an AI factory.
- scope: Creative Studio product principle, inline AI assistance, marketing intelligence surfacing

## D-04: Creative Studio keeps four tabs — Create / Review / Schedule / Media
- source: docs/specs/nrs-creative-studio-definitive-architecture.md, docs/specs/nrs-creator-build-checklist.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: The four-tab structure is correct and is not to be changed. Tabs represent the content pipeline: Media → Create → Review → Schedule. Director chat panel is always visible alongside all tabs.
- scope: Creative Studio navigation
- note: CONTRADICTED by D-05 below. See INGEST-CONFLICTS.md → WARNINGS.

## D-05: Restructure Studio navigation to a Mixpost-style left sidebar
- source: docs/specs/nrs-mixpost-visual-parity-inventory.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: Priority 1 of the visual parity pass is a layout restructure to a left sidebar matching Mixpost's Content / Configuration grouping, replacing NRS's top horizontal sub-tabs — "OR make the top tabs visually equivalent".
- scope: Creative Studio navigation, Studio header
- note: CONTRADICTS D-04. Both are SPEC-class and equal precedence. See INGEST-CONFLICTS.md → WARNINGS.

## D-06: Plug-in AIs are messengers; only the NRS Director orchestrates
- source: docs/specs/nrs-mcp-architecture.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: External MCP clients (Claude Desktop, Mobile, Cowork, Claude Code) hand user intent to `chat_with_director` and wait. They do not call multi-step orchestration tools directly, do not write marketing copy, and do not bypass the Review queue. Enforcement is structural at tool-registration time, not merely a prompt rule.
- scope: MCP server, tool exposure, Director authority
- note: The stated *intent* holds and is implemented. The stated *mechanism* is stale — see D-07.

## D-07: MCP tool exposure is an inverted allowlist, defaulting to Director-only
- source: src/lib/mcp/director-only-tools.ts (verified code, 2026-07-30); supersedes docs/specs/nrs-mcp-architecture.md
- status: proposed (code-derived reality; supersedes the SPEC's stated mechanism)
- decision: Tool exposure is governed by `DIRECT_MCP_TOOLS` in `src/lib/mcp/director-only-tools.ts` — an explicit allowlist. A new tool is Director-only **by default** and must be named to be exposed. The `HIDDEN_FROM_MCP` denylist described in the SPEC no longer exists anywhere in `src/`.
- scope: MCP server, tool exposure, security boundary
- note: Polarity is reversed from the SPEC (deny-list → allow-list) and the new design is the safer one. `publish_to_social` and `manage_posts`, which the SPEC lists as "still exposed on MCP", are absent from `DIRECT_MCP_TOOLS` and are Director-only in reality. See INGEST-CONFLICTS.md → INFO.

## D-08: One canonical media pipeline owns every media_items mutation
- source: docs/specs/nrs-media-processing-pipeline.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: `runMediaProcessingPipeline` in `src/lib/media/process-pipeline.ts` is the single function that mutates `media_items` for thumbnails, transcription, AI tagging and the per-stage processing report. Both the browser upload path (`/api/media/process`) and the Director's `process_media` tool delegate to it. No second pipeline exists.
- scope: media processing, thumbnails, transcription, AI tagging
- note: Spec status is `live (shipped 2026-04-10 in commit 1a18fb8)`.

## D-09: Thumbnails are server-side only; no client-side frame extraction in the upload path
- source: docs/specs/nrs-media-processing-pipeline.md, docs/specs/nrs-video-pipeline-architecture.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: Client-side frame extraction is removed from the upload path. Thumbnails are extracted server-side via `ffmpeg -ss 1 -i <https-url>` fast-seek URL streaming. Client-side extraction survives only in `VideoImportPanel` / `VideoEditPanel` for visual analysis, hardened with a 10s timeout and never-rejects semantics.
- scope: MediaUploader, upload path, thumbnail extraction
- rationale: CleanShot macOS `.mov` moov-atom layouts hang Chrome's `<video>` element on `loadedmetadata` forever with no error event, parking the entire upload.

## D-10: Publishing fails loud — never silently publish text-only
- source: docs/specs/nrs-video-pipeline-architecture.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: If any `media_id` cannot be uploaded to the publisher (timeout, size, codec), `publish_to_social` returns `BLOCKED` with the precise upstream error. It never degrades to a text-only publish.
- scope: publish_to_social, media handling

## D-11: Build direct social publishing in-house; no publishing middleware
- source: docs/specs/nrs-social-publishing-build-plan.md
- status: proposed (SPEC-derived; no ADR in ingest set)
- decision: "Build our own. No middleware. Agent calls platform API directly as a tool." Direct OAuth + REST integration with Meta, YouTube, TikTok and LinkedIn, structured so each publish tool later becomes a thin wrapper when platforms ship their own MCP servers.
- scope: direct social publishing, OAuth, Meta / YouTube / TikTok / LinkedIn
- note: The *intent* is intact and partially built. The *file plan* is entirely stale, and the built path has never executed. See D-12 and INGEST-CONFLICTS.md → BLOCKERS/WARNINGS.

## D-12: Direct publishing was built under src/lib/publishers/, not the paths the plan names
- source: verified code, 2026-07-30 (src/lib/publishers/, src/app/api/oauth/); supersedes docs/specs/nrs-social-publishing-build-plan.md
- status: proposed (code-derived reality; supersedes the SPEC's file plan)
- decision: The capability exists at `src/lib/publishers/` (`dispatcher.ts`, `token-store.ts`, `meta.ts`, `linkedin.ts`, `tiktok.ts`, `twitter.ts`, `youtube.ts`, `media-validator.ts`, `rate-limiter.ts`, `retry-queue.ts`, `types.ts`) with OAuth callbacks at `src/app/api/oauth/{meta,linkedin,tiktok,twitter,youtube}`. Twitter/X was added beyond the plan's four platforms.
- scope: direct social publishing file layout
- note: Every path named in the build plan is absent from the repo. Verified this session.

## D-13: Do not programmatically register Mixpost webhooks
- source: docs/specs/nrs-mixpost-webhook-setup.md
- status: proposed (DOC-derived; no ADR in ingest set)
- decision: NRS is single-tenant, so webhook registration is a one-off manual step in the Mixpost admin UI rather than a programmatic flow. The NRS receiver at `/api/webhooks/mixpost` handles everything thereafter.
- scope: Mixpost webhooks, operational setup

## D-14: Upload ceiling is 2 GB, deliberately not higher
- source: docs/specs/nrs-mixpost-upload-limits.md
- status: proposed (DOC-derived; no ADR in ingest set)
- decision: 2048 MB video upload limit. Chosen to match paid SaaS competitors (Buffer, Hootsuite, Publer), cover 10-min 4K at ~20 Mbps, and stay inside VPS RAM headroom with `memory_limit=1024M` plus 50 MB chunked uploads.
- scope: Mixpost upload limits, VPS infrastructure
