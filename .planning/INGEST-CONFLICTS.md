## Conflict Detection Report

Ingest set: 11 classified documents (8 SPEC, 3 DOC, 0 ADR, 0 PRD, 0 UNKNOWN). Mode: new.
Reconciled against verified code reality, `.planning/codebase/CONCERNS.md`, and `.planning/OPTIONS-publishing-and-interface.md`.
Where a spec contradicts verified code, reality wins and the spec is recorded as stale.

Note on the safety gate: the BLOCKERs below gate **routing** — no roadmap, PROJECT.md or REQUIREMENTS.md should be written on the assumption that these are handled. They did not gate the intel write, which the ingest brief explicitly requested.

### BLOCKERS (3)

[BLOCKER] Direct publishing can post one brand's content to another brand's account
  Found: src/app/api/oauth/meta/callback/route.ts:114 loops `for (const page of pages)` and writes every Facebook Page the user administers under the single `brandId` taken from the OAuth state (line 119). src/lib/publishers/token-store.ts:getToken() then filters on brand_id + platform and resolves the account with `.order('updated_at', {ascending:false}).limit(1)` — an arbitrary pick among them.
  Expected: docs/specs/nrs-social-publishing-build-plan.md specifies per-account token storage keyed to the connecting brand; docs/specs/nrs-creative-studio-definitive-architecture.md Rule 5 requires compliance to hold for every health-brand publish.
  Impact: With 7 Facebook Pages and 5 Instagram accounts across Downscale, Downscale-Derm, TeleScribe, Scent Sell, Man Clinic and EndorseMe, one sign-in files all twelve under one project. A Downscale weight-loss post can publish to the Man Clinic Page. AHPRA/TGA exposure is $60,000 per offence.
  → Build account-to-project mapping before any direct-publishing work is scheduled. Confirmed independently this session. Cross-referenced by .planning/OPTIONS-publishing-and-interface.md:204.

[BLOCKER] The direct publishing path has no compliance check at all
  Found: Zero compliance, Guardian or runComplianceFilter references anywhere in src/lib/publishers/ — verified by grep this session across dispatcher.ts, meta.ts, linkedin.ts, tiktok.ts, twitter.ts and youtube.ts.
  Expected: docs/specs/nrs-creative-studio-definitive-architecture.md Rule 5 — "Never skip compliance for health brands. Auto-check, block if red." Card 8 blocks publishing on red for AHPRA/TGA brands.
  Impact: The only working AHPRA/TGA gate is on the Mixpost path (src/lib/agents/tools/publish-to-social.ts). Switching to direct publishing removes it. Nine of eleven projects are AHPRA or TGA flagged.
  → Route every publisher through one shared gate before enabling any direct path. Do not treat "compliance is handled" as true in any roadmap phase that touches src/lib/publishers/.

[BLOCKER] Scheduled posts publish on a timer with no regulatory review
  Found: .planning/codebase/CONCERNS.md 1.4 — `grep -n "compliance" src/app/api/cron/publish-posts/route.ts` returns nothing, and neither does src/app/api/scheduled-posts/route.ts. src/lib/agents/tools/manage-posts.ts sets `status: 'scheduled'` in four places (lines 134, 212, 447, 547) with no Guardian call. Content can also be edited to non-compliant text in the Review UI after the draft-time check passed.
  Expected: docs/specs/nrs-creative-studio-definitive-architecture.md Rule 5, and docs/specs/nrs-mixpost-webhook-setup.md which describes the draft → scheduled → published flow as the normal publishing route.
  Impact: A time-of-check/time-of-use gap on the path that currently carries all real publishing traffic. This is live today and is independent of every publishing-route decision.
  → Run the Guardian in the cron publisher immediately before the platform call for any brand with ahpra || tga, and mark the row failed on a block. Both CONCERNS.md (item 3 of its suggested order) and OPTIONS (step 6 of ten) reach this conclusion independently.

### WARNINGS (8)

[WARNING] Two SPECs give opposite instructions on Studio navigation
  Found: docs/specs/nrs-creative-studio-definitive-architecture.md — "Creative Studio has 4 tabs (this is correct, don't change)" and checklist item "Do NOT change the tab structure". docs/specs/nrs-mixpost-visual-parity-inventory.md — priority 1 of the parity pass is "Layout restructure — left sidebar matching Mixpost's Content/Configuration grouping", replacing NRS's top sub-tabs, "OR make the top tabs visually equivalent".
  Impact: Equal precedence — both SPEC-class, neither locked, dated two days apart (2026-04-09 and 2026-04-10). Synthesis cannot pick without discarding one document's intent. Both variants are preserved as D-04 and D-05 in .planning/intel/decisions.md.
  → Owner decides: keep four top tabs, or restructure to a left sidebar. Note the parity document offers "make the top tabs visually equivalent" as an escape that satisfies both.

[WARNING] Two mutual cross-reference cycles in the ingest graph
  Found: nrs-mcp-architecture.md ↔ nrs-video-pipeline-architecture.md, and nrs-mixpost-webhook-setup.md ↔ nrs-mixpost-webhooks.md. Detected by DFS over the cross_refs graph; maximum traversal depth reached was 3, well inside the 50 cap.
  Impact: Both are "see also" back-links between paired documents, not derivation dependencies, and extraction here is flat and per-document rather than ref-following — so the synthesis-loop failure mode the cycle check guards against does not arise. All four documents were extracted normally.
  → Recorded as a warning rather than a blocker on that reasoning. This is a deliberate deviation from a strict reading of the cycle rule; override it and re-run with those four excluded if the strict gate is wanted.

[WARNING] A document both CLAUDE.md and a SPEC call mandatory reading was not ingested
  Found: docs/specs/nrs-creative-studio-definitive-architecture.md cross-references `2026-04-08-post-creator-redesign.md` and states the 10-card Creator is "Built to spec from" it. CLAUDE.md lists it in the MANDATORY pre-work reading block. The file exists at the repo root but is absent from CLASSIFICATIONS_DIR.
  Impact: The per-card field requirements for the Creator — the authority the definitive architecture defers to — are outside the intel. Any Creator work planned from this intel is planned without them.
  → Add /Users/jb-downscale/NotRealSmartAgency/2026-04-08-post-creator-redesign.md to the manifest and re-run ingest before scheduling Creator work.

[WARNING] No PRD-class sources — the corpus contains no stated product requirements
  Found: All 11 documents classify as SPEC (8) or DOC (3). Nothing in the ingest set states what the product must do for its user in requirement form; every document describes how something is built or configured.
  Impact: .planning/intel/requirements.md is deliberately empty of REQ- entries. Nothing was invented to fill it. The roadmapper has no ratified requirements to route against.
  → Requirements must be written, not extracted. The raw material is the owner's stated purpose (captured in context.md) plus the Macro Board specification in OPTIONS Section 1. Do not back-fill requirements from SPEC implementation detail — the SPECs have partly drifted from the code, and treating build steps as requirements would lock in that drift.

[WARNING] The publishing route is an open owner decision, and two sources point different ways
  Found: docs/specs/nrs-social-publishing-build-plan.md opens with "Build our own. No middleware." .planning/OPTIONS-publishing-and-interface.md Section 3 revises that: "Destination: E (direct to the platforms). Bridge: B (move Mixpost to a different rented host, this week)" — keeping middleware for 2–4 months because the direct tables are empty and "completing this route doesn't fill your accounts screen; it empties it".
  Impact: These are not contradictory on destination, only on sequencing and timing — but the sequencing choice determines the entire shape of the roadmap's first two months.
  → Owner decides before routing. OPTIONS states plainly: "There is no option that is both server-free and available this month."

[WARNING] Three platform assumptions in the publishing plan are explicitly unverified
  Found: .planning/OPTIONS-publishing-and-interface.md:235-237 flags three as unchecked. TikTok — unaudited app credentials are restricted to private-only posting with a hard daily cap until review passes; "not independently re-verified against TikTok's current 2026 policy". Meta — production Instagram/Page publishing normally needs an elevated permission level (2–4 weeks, first submissions often rejected); "this has not been checked" against the app's current level. X/Twitter — write access requires a paid tier; "current 2026 pricing not verified".
  Impact: docs/specs/nrs-social-publishing-build-plan.md states these requirements as settled fact from April 2026. Any timeline built on them is built on unverified external gating.
  → Check the Meta dashboard for the app's current permission level before committing to any direct-publishing timeline. Treat TikTok and X as unknown.

[WARNING] The video pipeline spec carries four items never verified live
  Found: docs/specs/nrs-video-pipeline-architecture.md frontmatter reads `status: partial — 8/10 verified live`, with an explicit "Still unverified live" section: the HeyGen webhook → rehost → media_items path (code shipped, no render triggered); Director end-to-end through the 600s maxDuration (the live test bypassed the Director and called Mixpost directly); the cache-hit publish path (~5s expected, untested); and the draft_post JSON hashtag envelope since deploy ffd2425.
  Impact: The one confirmed live publish (Hibiscus Mahajád to Scent Sell Facebook, 2026-04-09) did not exercise the Director path end-to-end. Treating the pipeline as fully proven would overstate what has run.
  → Carried into constraints.md as C-20. Verify these four before any phase depends on them.

[WARNING] Studio build-state documents are April 2026 snapshots, never re-verified, and disagree with each other
  Found: docs/specs/nrs-creator-build-checklist.md (2026-04-09) records PostCreator at "541 lines, 7 StudioCards" with 6 items outstanding and a 10-item testing checklist, none ticked. docs/specs/nrs-mixpost-visual-parity-inventory.md (2026-04-10) records "PostCreator exists (754 LOC)".
  Impact: A 213-line difference one day apart means work landed between the two documents, and neither has been checked against the code in this ingest. Planning Creator work from either would be planning against an unknown baseline.
  → Re-verify PostCreator.tsx and the six outstanding checklist items against the current code before scheduling Creator work.

### INFO (9)

[INFO] Auto-resolved: reality wins on the MCP enforcement mechanism
  Note: docs/specs/nrs-mcp-architecture.md and CLAUDE.md both document a `HIDDEN_FROM_MCP: ReadonlySet<string>` denylist in src/lib/mcp/server.ts and instruct future work to add to it. `grep -rn "HIDDEN_FROM_MCP" src/` returns nothing — verified this session. The mechanism is now `DIRECT_MCP_TOOLS`, an inverted allowlist in src/lib/mcp/director-only-tools.ts, where a new tool is Director-only by default and must be explicitly named to be exposed. The polarity is reversed and the new design is the safer one. The SPEC's *intent* — plug-in AIs are messengers, only the Director orchestrates — is intact and enforced. Recorded as D-06 (intent) and D-07 (mechanism) in decisions.md, and C-10 in constraints.md.

[INFO] Auto-resolved: two tools documented as MCP-exposed are Director-only in reality
  Note: nrs-mcp-architecture.md lists `publish_to_social` (as "gated by MANDATORY APPROVAL rule") and `manage_posts` among tools safe for plug-in AIs to call directly. Neither appears in DIRECT_MCP_TOOLS — verified this session. Both are Director-only. CLAUDE.md repeats the same stale claim. The security boundary is tighter than the documentation describes, not looser.

[INFO] Auto-resolved: the direct-publishing file plan is stale on paths, not on intent
  Note: docs/specs/nrs-social-publishing-build-plan.md names src/lib/social/token-manager.ts, src/lib/social/platforms.ts, src/components/agency/ConnectSocialsCard.tsx, src/app/api/auth/[platform]/{redirect,callback} and src/lib/agents/tools/publish-to-{meta,youtube,tiktok,linkedin}.ts. All are absent — verified individually this session. The capability was built at src/lib/publishers/ (dispatcher, token-store, meta, linkedin, tiktok, twitter, youtube, media-validator, rate-limiter, retry-queue, types) with OAuth callbacks at src/app/api/oauth/{meta,linkedin,tiktok,twitter,youtube}. The platform requirements, scopes and quotas in that spec remain the best source available and are extracted as C-11.

[INFO] Auto-resolved: CONCERNS.md findings 1.1 and 1.2 are out of date
  Note: CONCERNS.md 1.1 states the Guardian fails open on every error path and that the fail-closed branch in publish-to-social.ts is unreachable; 1.2 states TGA-only brands fail open by design. Verified this session at src/lib/agents/tools/publish-to-social.ts:96-106 — an explicit `check.checkCompleted` flag now blocks publication for `complianceFlags.ahpra || complianceFlags.tga`, with an in-code comment naming Downscale-Derm as the TGA-only case. OPTIONS:208 already flagged this correction. The `publish_to_social` path fails closed correctly. Every other finding in CONCERNS Severity 1 remains open — see the BLOCKERS above and context.md.

[INFO] Auto-resolved: the Guardian still bypasses the AI Gateway
  Note: CONCERNS 1.8 and 3.5 state that src/lib/agents/compliance-filter.ts imports `anthropic` directly from @ai-sdk/anthropic rather than routing through the gateway. Confirmed still true this session — `model: anthropic('claude-3-5-haiku-latest')`. src/lib/agents/tools/review-content.ts:13 has the same import. This part of the finding stands: a separate credential dependency, no gateway fallback chain and no gateway spend attribution, on the compliance and review paths.

[INFO] Auto-resolved: DOC classification retained, SPEC-grade content routed to constraints
  Note: docs/specs/nrs-mixpost-webhooks.md is typed DOC by manifest override. Its own classifier recorded that the content "carries strong SPEC signals (event tables, exact wire format, signature verification contract) that would otherwise argue for SPEC". The manifest type is honoured, and the technical contract is extracted to constraints.md as C-08 so downstream work does not lose it. No re-typing was performed.

[INFO] Table drift between the publishing plan and the schema in use
  Note: docs/specs/nrs-social-publishing-build-plan.md specifies token storage in `user_integrations`. The built code uses `social_oauth_tokens` (referenced in the meta, linkedin, tiktok and twitter OAuth callbacks via saveToken). The table has 0 rows — direct publishing has never run.

[INFO] Cost tracking has never recorded anything
  Note: `ai_usage` has 0 rows. OPTIONS:133 gives the mechanism — both write sites include a column that does not exist, so PostgREST silently rejects every write, the same PGRST204 class of bug documented for media_items in C-01. Every cost row since launch has been dropped. Any spend panel is dead until that is fixed, and OPTIONS lists it as step 4 of ten.

[INFO] Classification filenames use path-derived suffixes rather than SHA-256 prefixes
  Note: Six of the eleven classifier outputs record that no hashing tool was available in that agent's toolset, so the output filename suffix encodes the source directory instead of a SHA-256 slice. Slugs are unique within the directory and every record carries a full `source_path`, so provenance is intact. Cosmetic; no action needed.
