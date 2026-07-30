# Codebase Concerns

**Analysis Date:** 2026-07-30

**Assessment frame:** The stated purpose of NRS is to keep plugged-in AI clients (Claude Code, Hermes, Claude Desktop) **brand-aware and structured** — proactively knowing the brand, scanning the site, suggesting optimisations, knowing the socials, and surfacing enablers, barriers, risks and gaps. Every finding below is measured against that purpose and against the real-world exposure of running marketing for 11 Australian businesses, several AHPRA/TGA regulated, where a wrong published claim carries a $60,000+ penalty per offence.

**Headline:** NRS is a well-built **reactive tool server**. It is not a proactive marketing brain. Nothing in the codebase runs on its own to learn a brand, refresh what it knows, or surface a risk. Separately, the AHPRA/TGA compliance gate — the single control standing between an LLM and a $60K penalty — **fails open on every error path** and is **absent from three of the five ways content can reach a live social account**.

---

## Severity 1 — Regulatory exposure ($60K+ per offence)

### 1.1 The Guardian fails open. Every time.

**Files:** `src/lib/agents/compliance-filter.ts:155-178`, `src/lib/agents/tools/publish-to-social.ts:99-105`

`runComplianceFilter()` wraps its LLM call in a try/catch that returns the *default* result object on failure:

```ts
} catch (error) {
  console.error('Guardian check error:', error)
  return result // Return local check results even if LLM fails
}
```

`result` was initialised at line 41 with `isValid: true`. So an Anthropic outage, a rate limit, a schema-parse failure, or a timeout produces **"compliant"**. The same pattern applies to the regulatory corpus fetch (`compliance-filter.ts:118-120`) — a failure there becomes a `warning`, and warnings are explicitly non-blocking everywhere they are consumed.

The consequence compounds. `publish-to-social.ts:99-105` contains what looks like the correct control:

```ts
} catch (err) {
  // Fail open for non-health brands, fail closed for health brands
  if (complianceFlags.ahpra) {
    return 'COMPLIANCE CHECK ERROR — post NOT published. ...'
  }
}
```

**This branch is unreachable.** `runComplianceFilter` catches every one of its own async failures and never throws, so the outer `catch` never fires. The documented fail-closed safeguard for AHPRA brands does not exist at runtime.

- **Impact:** A transient LLM failure publishes unreviewed health marketing to Instagram/Facebook/LinkedIn for Downscale, DownscaleDerm, TeleCheck, TeleScribe or EndorseMe. There is no alert, no audit flag, no retry — `console.error` on a Vercel serverless function is the only trace.
- **Fix approach:** Invert the default. Initialise `isValid: false` and set it true only on a clean pass; or add an explicit `checkCompleted: boolean` to `GuardianResult` and make every caller treat `checkCompleted === false` as a hard block for any brand with `ahpra || tga`. Then delete the dead fail-closed branch in `publish-to-social.ts` and replace it with a check on the returned flag.

### 1.2 TGA-only brands fail open by design

**File:** `src/lib/agents/tools/publish-to-social.ts:102`

The (already unreachable) fail-closed branch is gated on `complianceFlags.ahpra` alone. **DownscaleDerm is TGA-regulated and not AHPRA-flagged** per the brand register in `CLAUDE.md`. Even if 1.1 were fixed, TGA-only brands would still publish on a failed check.

- **Impact:** Therapeutic-goods claims published without review. TGA penalties are of the same order as AHPRA.
- **Fix approach:** Change the condition to `complianceFlags.ahpra || complianceFlags.tga`.

### 1.3 `blotato_publish` publishes to any platform with no compliance gate and no brand context

**File:** `src/lib/agents/tools/blotato.ts:62-84`

```ts
export function createBlotatoPublishTool(supabase: SupabaseClient, userId: string) {
```

The factory takes `userId` only — **no `brandId`**. The tool therefore cannot load `compliance_flags`, cannot run the Guardian, and cannot know which of the 11 brands it is posting for. It accepts free-text `text` and posts to Twitter, Instagram, Facebook, TikTok, LinkedIn, Pinterest, Bluesky, Threads and YouTube.

It is registered in the Director's toolset (`src/lib/agents/tools/index.ts:298`), so the Director can select it in place of `publish_to_social` at any time — the two tool descriptions actively invite the model to choose between them.

- **Impact:** A complete, undefended bypass of the entire AHPRA/TGA control surface, reachable by ordinary LLM tool selection. This is the single highest-risk finding in the repository.
- **Fix approach:** Either remove `blotato_publish` from all toolsets until it takes a `brandId` and runs the same gate as `publish_to_social`, or route it through a shared `assertPublishable(brandId, text)` helper that both publishers must call.

### 1.4 The cron publisher publishes with no compliance check at all

**File:** `src/app/api/cron/publish-posts/route.ts:38`

The scheduled publisher selects `scheduled_posts` where `status = 'scheduled'` and pushes them to Mixpost (or Ayrshare) every 5 minutes. `grep -n "compliance" src/app/api/cron/publish-posts/route.ts` returns **nothing**. Neither does `src/app/api/scheduled-posts/route.ts`.

So the gate only ever runs at draft-creation time in `publish_to_social` and `draft_post` — not at the moment of publication. Anything that arrives in `scheduled_posts` by another route goes out unreviewed.

Four such routes exist in `src/lib/agents/tools/manage-posts.ts` alone (lines 134, 212, 447, 547), each setting `status: 'scheduled'` with no Guardian call. `manage_posts` is in the Director's and Strategy department's toolsets. Content can also be edited to non-compliant text in the Review UI after the draft-time check has already passed (`src/components/agency/studio/ReviewRoom.tsx:180,223,243`).

- **Impact:** Time-of-check/time-of-use gap. Content approved as a draft can be edited, or created by a different path, and published without re-review.
- **Fix approach:** Move the gate to the publisher. Run the Guardian in `/api/cron/publish-posts` immediately before the platform call for any brand with `ahpra || tga`, and mark the row `status: 'failed'` with the flags on a block. Draft-time checks stay as fast feedback, not as the control.

### 1.5 `approval_queue` does not gate anything

**Files:** `src/lib/agents/tools/request-approval.ts`, `src/app/api/approvals/route.ts`, `src/app/api/cron/publish-posts/route.ts`

`approval_queue` is a parallel table with its own UI. The publishing path never reads it. `scheduled_posts` transitions `draft → scheduled → publishing → published` with no reference to an approval record. The "MANDATORY APPROVAL" and draft-first rules documented in `CLAUDE.md` and stated in the MCP `quick_start` prompt (`src/lib/mcp/server.ts:159-163`) are **prompt instructions to an LLM, not code**.

- **Impact:** The owner's stated safety model ("Director shows the final content, waits for approval, then publishes") holds only as long as the model complies. There is no enforcement.
- **Fix approach:** Add `approved_by` / `approved_at` columns to `scheduled_posts`; make the cron publisher skip any row for a regulated brand without them.

### 1.6 `save_output` records violations and saves anyway

**File:** `src/lib/agents/tools/save-output.ts:40-53`

The Guardian runs, its result is written to `metadata.compliance`, and the insert proceeds regardless of `isValid`. The catch block comment is explicit: `// Non-blocking — save proceeds even if compliance check fails`.

`save_output` is on the **direct MCP allowlist** (`src/lib/agents/tools/../mcp/director-only-tools.ts:32`), so any plugged-in AI client can write arbitrary, unvetted marketing copy into the outputs library — the same library that `query_outputs` later feeds back to agents as prior work to learn from.

- **Impact:** Non-compliant copy enters the corpus that cross-agent learning draws on, and can be surfaced later as an approved example.
- **Fix approach:** Block the insert when `isValid === false` for regulated brands, or quarantine to a `status: 'blocked'` state that `query_outputs` excludes.

### 1.7 Compliance is only as good as a manually-set boolean

**File:** `src/lib/agents/compliance-filter.ts:95-97`

```ts
if (!flags.ahpra && !flags.tga) {
  return result
}
```

Every regulatory check in the system hinges on two booleans on the `brands` row, set by hand at brand creation. There is no validation, no inference from the brand's niche, and no periodic audit. A new health brand created without ticking the boxes receives **zero** regulatory review, silently.

- **Impact:** One missed checkbox disables the entire control surface for a brand, with no warning anywhere in the UI or logs.
- **Fix approach:** Infer a candidate flag from `niche` / website scan and require explicit confirmation to turn it off; log an audit entry whenever a compliance flag is cleared.

### 1.8 The Guardian's regulatory prompt is thin, stale, and running on a small model

**File:** `src/lib/agents/compliance-filter.ts:122-153, 156`

The AHPRA/TGA rule set is six hardcoded bullet points, one of which is `AHPRA: Reddit posts are now publicly visible — all content is subject to AHPRA scrutiny` — a note about one platform sitting alongside the actual statutory rules, with no equivalent for the National Law s133 prohibitions, testimonial rules, or TGA Therapeutic Goods Advertising Code sections.

The judge model is `anthropic('claude-3-5-haiku-latest')` — imported **directly from `@ai-sdk/anthropic`, bypassing the AI Gateway** that `CLAUDE.md` mandates and that every other model call in the repo uses (`gateway(...)` via `src/lib/ai/model-routing.ts`). This means the compliance path has a different auth dependency (`ANTHROPIC_API_KEY`), different failure modes, no gateway fallback chain, and no gateway spend tracking.

`src/lib/agents/tools/review-content.ts:13` has the same direct import.

- **Impact:** The lowest-capability model in the stack, on the least-resilient transport, with the thinnest prompt, is doing the highest-stakes judgement in the business.
- **Fix approach:** Route through the gateway with a fallback chain; raise the model tier for regulated brands; move the rules into a versioned reference file so they can be reviewed by a human and cited in the output.

### 1.9 Zero tests on the compliance path

**Evidence:** 52 test files under `src/`. None are `compliance-filter.test.ts`, `publish-to-social.test.ts`, `save-output.test.ts`, `manage-posts.test.ts`, or `blotato.test.ts`. Twelve test files cover Telegram; eleven cover scoping and project access.

CI (`.github/workflows/quality.yml`) runs `npm test`, `npm run lint`, `npm run build` on every push to `main` — a good gate, testing nothing that matters most.

- **Impact:** All eight findings above could be introduced or reintroduced by any future change without a single failing test.
- **Priority:** High. A regression test asserting "Guardian throws → nothing publishes" would have caught 1.1 and 1.2 on the day they were written.

---

## Severity 2 — Fails the stated purpose (passive, not proactive)

### 2.1 Nothing autonomously populates the 21 proforma sections

The Master Marketing Proforma is the structure that is supposed to make a plugged-in AI brand-aware. It does not fill itself.

**Seeding:** `src/lib/proforma/auto-populate.ts:20-171` seeds all 21 sections from whatever is already on the `brands` row. **Fourteen of the 21 seed to `rag: 'red'` with an empty or near-empty `section_data`** — `market_context`, `business_goals`, `funnel_map`, `channel_seo`, `channel_paid`, `channel_email`, `kpi_dashboard`, `gaps_opportunities`, `thirty_sixty_ninety` and more receive literally `{}`. Several are annotated in-code: `rag = 'red' // needs research`, `rag = 'red' // needs user input`. The seeding is honest about being a stub. Nothing ever comes back to fill it.

**Writing:** `update_proforma` exists (`src/lib/agents/tools/proforma.ts:142-229`) but is registered in **exactly one toolset — `overall`** (`src/lib/agents/tools/index.ts:239`). The thirteen departments that would actually produce the research — SEO for `channel_seo`, Market Intelligence for `competitors`, Analytics for `kpi_dashboard`, Paid Ads for `channel_paid` — can `read_proforma` (via `managementTools`, `index.ts:211`) but **cannot write to it**. Their findings return to the Director as prose, and persist only if the Director voluntarily calls `update_proforma` afterwards.

**Triggering:** `ensureProforma` is called from two places only — `src/app/api/chat/route.ts:135` and `src/lib/mcp/director-job.ts:183`. Both are inside a request handler. Both require a human to send a message first.

**Staleness:** `isStale()` is computed (`proforma.ts:17-21`) and rendered in the prompt summary and the `read_proforma` output. **Nothing acts on it.** No job scans for stale sections, no task is created, no alert fires. `review_cadence` is stored on every row and consumed by nothing but a display string.

- **Impact:** This is the core failure against the stated purpose. A connected AI client that asks "what do you know about this brand?" gets a table that is mostly `[RED] (updated <seed date>)`. The system cannot guide because it does not know, and it has no mechanism to find out.
- **Fix approach:** A `proforma-refresh` cron that finds sections past their cadence, dispatches the owning department via `runAgentWorker`, and grants `update_proforma` to departments scoped to the sections they own. The execution machinery (`runAgentWorker`, `runParallelAgents`) already exists and works — only the scheduler and the write permission are missing.

### 2.2 The heartbeat does nothing unless a human created a goal first

**File:** `src/app/api/heartbeat/route.ts:133-145`

The only autonomous execution loop in the system is scheduled every 15 minutes (`vercel.json`). Its task query is:

```ts
.eq('status', 'assigned')
.not('assigned_agent_id', 'is', null)
.not('goal_id', 'is', null)
.eq('goals.status', 'active')
.eq('goals.level', 'objective')
```

Work only runs if it is attached to an **active objective-level goal**. Goals are created in exactly one place: `src/lib/agents/tools/manage-goal.ts:50`, via the `set_active_goal` tool, which is registered **only in the `overall` toolset** and only fires when the Director decides to call it mid-conversation. There is no onboarding step that seeds a goal, and no fallback path.

**With no objective goal on a brand, the heartbeat is a no-op that costs a function invocation every 15 minutes.** The comment at lines 130-132 states this is deliberate ("Legacy unscoped tasks... cannot create background activity") — a reasonable safety decision that has the side effect of making the whole system inert by default.

- **Impact:** The platform's only self-starting behaviour is gated behind an LLM choosing to call one tool in one conversation. For most brands, nothing ever runs.
- **Fix approach:** Seed a default objective at brand creation ("Establish baseline marketing intelligence"), or add a second heartbeat lane for maintenance work (proforma refresh, discovery refresh, staleness sweeps) that does not require a goal.

### 2.3 Three proactive cron routes are written but never scheduled

**Files:** `src/app/api/cron/monitor-alerts/route.ts`, `src/app/api/cron/performance-learn/route.ts`, `src/app/api/cron/consolidate-memories/route.ts` vs `vercel.json`

`vercel.json` registers **three** crons: `/api/heartbeat` (15 min), `/api/cron/daily-intel` (daily 20:00), `/api/cron/publish-posts` (5 min).

Five cron routes exist. The three unregistered ones each carry a docstring stating a schedule that was never wired:

| Route | Docstring claim | Actually scheduled |
|---|---|---|
| `monitor-alerts` | "Designed to be called by Vercel Cron every 60 minutes" | **No** |
| `performance-learn` | "Called every 6 hours via Vercel Cron" | **No** |
| `consolidate-memories` | "weekly memory consolidation" | **No** |

`monitor-alerts` is the most painful. It is the *only* code in the repository that proactively looks for barriers, gaps and risks — failed posts in the last 24h, content gaps in the next 3 days, platforms neglected for 7 days — and writes them to `audit_log` as `performance_alert`. It has never run.

`performance-learn` is the feedback loop that would make the Director learn what actually works per brand. It has never run.

- **Impact:** The exact capability the owner describes — "surface enablers, barriers, risks and gaps" — is **already written and simply not turned on.** This is the cheapest high-value fix in the repository.
- **Fix approach:** Add three entries to `vercel.json`. Note Vercel Hobby plans cap cron frequency; confirm the plan tier before committing to hourly. Verify each route against live data before enabling `monitor-alerts`, since it writes to `audit_log` for every brand.

### 2.4 Discovery runs once, on GitHub connect, and never again

**Files:** `src/lib/discovery/project-discovery-run.ts`, `src/app/api/integrations/github/callback/route.ts:322`

`runProjectDiscovery` performs the full first-pass grounding — GitHub product context, website scan, sitemap discovery, social scan. `grep -rn "runProjectDiscovery" src/` returns exactly **one** call site: the GitHub App connect callback.

Consequences:

- A brand that **never connects GitHub never gets discovery at all.** The website scan, the sitemap, and the social scan are all inside this one function, behind a GitHub-only trigger. There is no website-only discovery path.
- Once run, `brands.github_context` is a **frozen 16KB string** (`project-discovery-run.ts:42`) that never refreshes. It ages out silently as the product changes.
- `project_scans` rows accumulate but nothing reads them on a schedule to detect drift.

- **Impact:** "Know the brand, scan the site, know the socials" degrades to a single snapshot taken at an arbitrary past moment, for the subset of brands that happened to connect a repo.
- **Fix approach:** Decouple website/social discovery from the GitHub binding so it can run for any brand with a `website_url`; schedule a monthly re-run and diff the result into `project_scans` so change is detectable.

### 2.5 The MCP surface answers questions but leads nothing

**Files:** `src/lib/mcp/server.ts:38-101`, `src/lib/mcp/director-only-tools.ts`

`list_projects` — the first call every connected client makes, and the entry point to everything else — returns six fields:

```ts
.select('id, name, slug, description, niche, website_url')
```

Rendered as name, slug, ID, description, URL (`server.ts:85-87`). No proforma status. No RAG summary. No stale-section count. No open risks. No suggested next action. No indication that any of that exists.

The `quick_start` prompt (`server.ts:138-189`) is 50 lines of **routing policy** — "you are the messenger, not the marketer", which tools are Director-only, how to poll a job. It tells the client what it may not do. It never tells the client what the brand needs.

The design is coherent and the security is sound (`assertProjectCapability` in `tool-adapter.ts:45` correctly scopes every call to granted projects). But it is a **pull** interface in a system whose stated purpose is **push**. A connected Claude Code instance has no way to discover that DownscaleDerm's `channel_seo` section is red and 90 days stale, short of guessing to call `chat_with_director` and asking.

- **Impact:** Directly defeats the stated purpose. The AI client cannot be led because nothing offers to lead it.
- **Fix approach:** Add a `get_project_brief(brand_id)` tool to `DIRECT_MCP_TOOLS` returning: proforma RAG roll-up, the N stalest sections, open `performance_alert` rows from `monitor-alerts` (once 2.3 is fixed), connected socials, last discovery date, and 3 concrete suggested next actions. Extend `list_projects` with a one-line health summary per project. Rewrite `quick_start` to open with "call `get_project_brief` first".

### 2.6 Proactivity exists only as prompt text on a user-initiated turn

**File:** `src/lib/agents/prompt-builder.ts:96, 108, 151, 162`

The Director is instructed to "proactively flag", "proactively adapt", "proactively suggest competitive angles". Every one of these is inside a system prompt assembled inside a request handler, in response to a human message. There is no code path where the system speaks first.

- **Impact:** "Proactive" in this codebase means "responds helpfully when asked". That is a materially different product from the one described.

---

## Severity 3 — Repository, legal and supply-chain risk

### 3.1 A 9.5 MB file named `anthropic-leaked-source-code-main.zip` is committed to git history

**Evidence:** `git ls-files` lists `anthropic-leaked-source-code-main.zip` as tracked at HEAD (deleted in the working tree but not in the index). Introduced in commit `aa2d6b1` (2026-04-06). Size: **9.5 MB**.

- **Impact:** IP and legal exposure on a repository owned by a trading company (Black Health Intelligence Pty Ltd, ABN 23 693 026 112) and pushed to GitHub. Deleting the working-tree copy does not remove it — it remains in every clone and every fetch of the history.
- **Fix approach:** `git rm --cached` for HEAD, then a history rewrite (`git filter-repo`) and a force-push, coordinated with anyone holding a clone. Confirm the repository's visibility setting first. **This is a decision for the owner, not an autonomous cleanup** — history rewrites are destructive and this one touches the shared `main`.

### 3.2 Three untracked, un-ignored zip archives sit in the repo root

**Evidence:** `agency-agents-main.zip` (968 KB), `agency-agents-main (1).zip` (968 KB), `paperclip-master.zip` (4.1 MB). `git check-ignore` returns nothing for any of them — they are **not** covered by `.gitignore`.

- **Impact:** 6 MB one `git add -A` away from entering history permanently, exactly as 3.1 did.
- **Fix approach:** Delete them and add `*.zip` to `.gitignore`.

### 3.3 `agency-agents-main-EXAMPLE/` is a vendored third-party repo, modified in place

**Evidence:** 212 files tracked, 2.7 MB. MIT-licensed, "Copyright (c) 2025 AgentLand Contributors". Ships its own `.github/workflows/lint-agents.yml`, issue templates, PR template, FUNDING.yml, `.gitattributes` and `.gitignore` into the NRS repo. **27 of its files are currently modified** in the working tree (design, engineering, marketing, testing, project-management agent definitions).

- **Impact:** Three distinct problems. (a) A second GitHub Actions workflow file lives in a subdirectory of a production repo. (b) Upstream MIT-licensed content has been edited in place, so it can never be cleanly updated and the provenance of the edits is unclear against the licence's attribution requirement. (c) 212 files of unrelated agent markdown dilute every repo-wide grep, every `find`, and every future codebase map — including this one.
- **Fix approach:** It is reference material, per `reference_agency_agents_repo.md` in the memory index. Move it out of the repo (to `~/Obsidian/Reference/` or a sibling directory) and reference it by path. If the 27 local modifications are valuable NRS agent work, extract them into `src/lib/agents/` first. Confirm with the owner before deleting — the modifications are uncommitted and unreviewed.

### 3.4 Three high-severity dependency advisories, unfixable without a breaking change

**Evidence:** `npm audit --omit=dev`:

- `postcss <=8.5.17` — XSS via unescaped `</style>`; arbitrary file read via attacker-controlled `sourceMappingURL`; path traversal in source-map auto-loading. Reached through `next`.
- `sharp <0.35.0` — inherited libvips vulnerabilities CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591. Reached through `next`.

`npm audit fix --force` proposes `next@9.3.3` — a downgrade of six major versions. Not viable.

- **Impact:** Build-time and image-processing exposure. `sharp` processes user-uploaded media in this app, which makes the libvips advisories more than theoretical.
- **Fix approach:** Track the Next.js release that bumps its bundled `postcss` and `sharp` (currently pinned at `next: 15.5.21`) and upgrade. Meanwhile document the accepted risk — do not let `npm audit` noise train the team to ignore it.

### 3.5 Two direct-provider imports bypass the AI Gateway

**Files:** `src/lib/agents/compliance-filter.ts:11`, `src/lib/agents/tools/review-content.ts:13`

Both import `anthropic` from `@ai-sdk/anthropic` directly. `CLAUDE.md` states the AI Gateway is auto-injected and must never be configured manually; every other model call routes through `gateway()` and `src/lib/ai/model-routing.ts`.

- **Impact:** Two model calls with a separate credential dependency (`ANTHROPIC_API_KEY`), no gateway fallback chain, and no gateway-side spend attribution. Both happen to be the *compliance* and *review* paths — the two that most need resilience.
- **Fix approach:** Route both through `getGatewayModel()` like the rest of the codebase.

### 3.6 Three.js remains a production dependency despite a standing prohibition

**Evidence:** `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` in `dependencies`. Used by `src/components/landing/WaterRippleHero.tsx` and `src/components/auth/LoginPageClient.tsx`. `next.config.ts` carries `transpilePackages: ['three']` for it.

This is a documented, accepted exception (the landing hero is explicitly protected in `CLAUDE.md`) — flagged here only for bundle weight and because `LoginPageClient.tsx` puts a WebGL scene on the auth path.

- **Fix approach:** No action on the hero. Consider whether the login page needs WebGL.

---

## Severity 4 — Maintainability and drift

### 4.1 `CLAUDE.md` documents an MCP mechanism that no longer exists

`CLAUDE.md` devotes a section to `HIDDEN_FROM_MCP: ReadonlySet<string>` in `src/lib/mcp/server.ts`, and instructs future work to "add to `HIDDEN_FROM_MCP` in `src/lib/mcp/server.ts`".

`grep -rn "HIDDEN_FROM_MCP" src/` returns **nothing**. The mechanism was replaced by the inverted `DIRECT_MCP_TOOLS` allowlist in `src/lib/mcp/director-only-tools.ts`. The polarity is reversed — a new tool is now Director-only *by default* and must be explicitly allowed, which is the safer design, but the documentation says the opposite.

The same section lists `publish_to_social` and `manage_posts` as "Still exposed on MCP". Neither is in `DIRECT_MCP_TOOLS`. Both are Director-only in reality.

- **Impact:** `CLAUDE.md` is loaded into every session in this project. An agent following it will edit a constant that does not exist, or reason about the MCP surface from an inverted model of it. Given the security-sensitive nature of that boundary, this is worse than having no documentation.
- **Fix approach:** Rewrite that section against `director-only-tools.ts`.

### 4.2 The MCP `quick_start` prompt hardcodes a tool list that must be manually synced

**File:** `src/lib/mcp/server.ts:175-179`

A literal string lists 15 Director-only tools. `DIRECT_MCP_TOOLS` is the actual source of truth. Nothing keeps them in sync, and they have already diverged — the prompt does not mention `get_brand_kit`, `upload_media`, `export_design`, `search_designs`, `list_brand_kits` or `get_export_formats`, all of which are directly callable.

- **Fix approach:** Generate the list from `DIRECT_MCP_TOOLS` at prompt-build time.

### 4.3 The proforma summary builder is duplicated verbatim

**Files:** `src/app/api/chat/route.ts:137-169` and `src/lib/mcp/director-job.ts:185-212`

Roughly 35 lines — executive-snapshot extraction, staleness calculation, RAG formatting, date formatting — copied between the web Director and the MCP/Telegram Director. `director-job.ts:186` even labels it `// Build proforma summary (same shape as web Director)`.

- **Impact:** The two Directors will drift. A fix applied to what the web Director knows about a brand will silently not apply to what a plugged-in Claude Code instance knows — which is precisely the surface this system exists to serve.
- **Fix approach:** Extract to `src/lib/proforma/summary.ts` and call it from both.

### 4.4 The Director's toolset is roughly 90 tools in a 5-step loop

**File:** `src/lib/agents/tools/index.ts:221-305`

The `overall` set holds approximately 90 tools, over 30 of which are Canva design primitives (`start_editing_transaction`, `perform_editing_operations`, `commit_editing_transaction`, `get_design_pages`, `resolve_shortlink`…). The chat route runs `stopWhen: stepCountIs(5)`; `runAgentWorker` runs `stepCountIs(3)`.

- **Impact:** Large fixed token cost on every single Director turn, and measurably degraded tool selection at this cardinality — which is the likely mechanism behind the Director choosing `blotato_publish` over `publish_to_social` (finding 1.3). Five steps is also tight for any genuinely multi-step task.
- **Fix approach:** Collapse the Canva primitives behind a single `canva_design` tool with an `operation` discriminator, or load them lazily only when the intent router detects design intent.

### 4.5 `src/lib/agents/tools/canva.ts` is 1,731 lines

The largest file in the repository by a factor of two. `src/types/database.ts` (935) and `src/lib/mixpost/client.ts` (899) follow.

- **Fix approach:** Split `canva.ts` by concern (designs / folders / editing transactions / exports). Low urgency, high friction cost on every touch.

### 4.6 The `martech` agent type has no management tools

**File:** `src/lib/agents/tools/index.ts:305`

```ts
martech: { save_output: saveOutput, scan_github: scanGithub },
```

Every other agent type spreads `...managementTools`. `martech` does not, so it lacks `read_proforma`, `query_outputs`, `get_brand_kit`, `create_task`, `request_approval` and `handoff_to_department`. It is documented as archived-for-backward-compat, but old conversations resuming on it get an agent that cannot read the brand contract or hand off.

- **Fix approach:** Add `...managementTools`, or route `martech` to `content` at load time.

---

## Test Coverage Gaps

| Area | Files | Risk if broken | Priority |
|---|---|---|---|
| AHPRA/TGA Guardian | `src/lib/agents/compliance-filter.ts` | $60K+ per published offence | **Critical** |
| Publishing gate | `src/lib/agents/tools/publish-to-social.ts`, `src/lib/agents/tools/blotato.ts` | Ungated publication to live accounts | **Critical** |
| Cron publisher | `src/app/api/cron/publish-posts/route.ts` | Silent publish failures; no gate | High |
| Proforma seed + update | `src/lib/proforma/auto-populate.ts`, `src/lib/agents/tools/proforma.ts` | Brand knowledge silently empty | High |
| Post scheduling | `src/lib/agents/tools/manage-posts.ts` (561 lines) | Wrong-time / wrong-platform publication | Medium |
| Media pipeline | `src/lib/media/process-pipeline.ts` | Known PGRST204 class of silent-drop bugs (see `CLAUDE.md`) | Medium |

Well covered by contrast: project access and scoping (`project-access`, `route-scope`, `execution-scope`, `store-scope`, `mcp-scope-wiring`, `marketing-data-boundary`), Telegram (12 files), goal loop, Mixpost signature verification. The security boundary work is genuinely solid. The regulatory boundary has nothing.

---

## What Is Actually Solid

Stated for balance, because the risks above are concentrated rather than pervasive:

- **MCP project scoping** — `src/lib/mcp/tool-adapter.ts:44-67` enforces `assertProjectCapability` before every tool call and re-verifies brand existence. Backed by six test files. This is done properly.
- **Telegram webhook hardening** — `src/app/api/webhooks/telegram/route.ts:45-48` uses `timingSafeEqual` with a length pre-check, and accepts only private human messages or private callback presses.
- **Cron authentication** — all five cron routes verify `Bearer ${process.env.CRON_SECRET}` before doing anything.
- **The Director-only allowlist design** — `director-only-tools.ts` defaults new tools to Director-only. Correct polarity, clearly reasoned in its own comments.
- **CI gate** — `.github/workflows/quality.yml` runs test, lint and build on every push to `main` with non-secret placeholder env vars.
- **Secrets hygiene in source** — no hardcoded keys found in `src/`; `.env.github-app` and `.env*.local` are correctly gitignored. The only `sk_live` string in the codebase is a fixture inside a redaction test.
- **The execution machinery** — `runAgentWorker` / `runParallelAgents` with per-agent budgets, step limits, concurrency caps and audit logging is well built. Finding 2.1 is not that the engine is bad; it is that nothing turns the key.

---

## Suggested Order of Work

1. **Fix the Guardian's fail-open default** (1.1, 1.2) and write the regression test (1.9). Nothing else on this list carries comparable downside.
2. **Close or gate `blotato_publish`** (1.3). One line removes the bypass today; a proper fix takes an afternoon.
3. **Move the compliance gate to the publisher** (1.4) and add approval columns to `scheduled_posts` (1.5).
4. **Schedule the three dormant crons** (2.3). Highest value per line changed in the entire repository — the proactive risk-surfacing code already exists.
5. **Add `get_project_brief` to the MCP allowlist** (2.5). This is the single change that most directly delivers the stated purpose.
6. **Build the proforma refresh loop** (2.1) — grant departments scoped `update_proforma`, add a staleness-driven cron. This is the largest piece of work and the one that makes NRS actually know its brands.
7. **Decide on the leaked-source zip in git history** (3.1) with the owner. Legal exposure, destructive fix, not an autonomous call.
8. **Correct `CLAUDE.md`'s MCP section** (4.1) before another session builds on the wrong model of the security boundary.

---

*Concerns audit: 2026-07-30*
