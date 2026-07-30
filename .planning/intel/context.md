# Context

Running notes keyed by topic, with source attribution. DOC-class sources from the ingest set, plus the verified-reality evidence the ingest brief required be reconciled against.

---

## Topic: The owner's stated purpose

- source: ingest brief from team-lead, relaying the owner (2026-07-30)

> "NRS must keep plugged-in AI clients brand-aware and structured — always suggest a plan, guide the AI, know my site, scan it, suggest optimisations, my social media, enablers, barriers, risks, gaps."

> "I need an interface — that's what Mixpost or Canva is — so visually I always see what's needed, macro."

The owner is not a developer. This purpose is the frame every downstream plan is measured against. Two distinct asks sit inside it: a **push** capability (the system proactively knows and surfaces) and a **macro interface** (one screen showing state across all projects).

---

## Topic: Current state against that purpose — the headline finding

- source: /Users/jb-downscale/NotRealSmartAgency/.planning/codebase/CONCERNS.md (authoritative on current state per the ingest brief)

> "NRS is a well-built **reactive tool server**. It is not a proactive marketing brain. Nothing in the codebase runs on its own to learn a brand, refresh what it knows, or surface a risk."

Supporting detail from the same source:

- **Nothing autonomously fills the 21-section proforma.** Seeding sets 14 of 21 sections to `rag: 'red'` with empty `section_data`. `update_proforma` is registered in exactly one toolset (`overall`) — the thirteen departments that would produce the research can read the proforma but cannot write to it. `ensureProforma` is only ever called from inside a request handler, so it requires a human to send a message first. `isStale()` is computed, rendered, and acted on by nothing.
- **The heartbeat is inert by default.** Its task query requires an active objective-level goal; goals are created only by `set_active_goal`, registered only in the `overall` toolset, and fired only when the Director chooses to call it. With no objective goal on a brand, the 15-minute heartbeat is a no-op.
- **Three proactive cron routes are written but never scheduled.** `monitor-alerts`, `performance-learn` and `consolidate-memories` exist with docstrings claiming schedules that were never wired into `vercel.json`. `monitor-alerts` is the only code in the repository that proactively looks for barriers, gaps and risks — failed posts in 24h, content gaps in the next 3 days, platforms neglected for 7 days — and it has never run. CONCERNS calls scheduling them "the cheapest high-value fix in the repository".
- **Discovery runs once, on GitHub connect, and never again.** `runProjectDiscovery` has exactly one call site: the GitHub App callback. A brand that never connects GitHub gets no website scan, no sitemap, no social scan at all. Once run, `brands.github_context` is a frozen 16 KB string.
- **The MCP surface answers but never leads.** `list_projects` returns six fields — no proforma status, no RAG summary, no stale-section count, no open risks, no suggested next action. The `quick_start` prompt is 50 lines of routing policy telling the client what it may not do, and never what the brand needs.

---

## Topic: There is no macro view today

- source: /Users/jb-downscale/NotRealSmartAgency/.planning/OPTIONS-publishing-and-interface.md, Section 1

No screen in the product shows more than one project's operational state at a time. `/agency` redirects straight to chat. The Studio dashboard is the richest screen and is single-project. Command Centre → Approvals lists approvals across projects **but does not display which project each belongs to**. Costs are by department, never by project. The Brands page is the only deliberately all-project screen and carries no operational signal.

**The 23 clicks.** Switching project in the sidebar forcibly returns the user to chat, so every project after the first costs 2 clicks to reach its real state. Twenty-three clicks and eleven page loads to assemble what should be one screen.

Three aggravating facts:
1. The per-project logic already exists inside the Studio dashboard, is deterministic and free to run, and is called once for one project. Making it run for all 11 is a loop.
2. `src/components/agency/BrandSelector.tsx` is a complete working in-place project switcher that **nothing in the repo imports**. Wiring it into the header cuts the sweep to ~13 clicks with no new code.
3. For seven AHPRA-flagged and two TGA-flagged projects, no screen anywhere answers "which regulated project has unreviewed content right now".

**The Macro Board** is specified in full in that document — one screen at `/agency` replacing the redirect, an Attention Rail (ranked, capped at 8 rows) plus a Project Grid (all 11, silent by default), a week ribbon and a portfolio-wide chat bar. Colour is reserved for things needing action; healthy is silver, not green. Explicitly excluded: department/agent names, AI cost, engagement analytics, media thumbnails, and every publishing implementation word (Mixpost, VPS, nginx, Docker, OAuth, webhook, ffmpeg, 504 are banned from anything rendered).

Two items in it need a database change, not a screen: approvals have no project column, and AI spend has no project column.

---

## Topic: Direct publishing exists, has never run, and carries verified defects

- source: verified code + live DB, 2026-07-30 (ingest brief + independent confirmation this session)

The capability was built — `src/lib/publishers/` with `dispatcher.ts`, `token-store.ts`, `meta.ts`, `linkedin.ts`, `tiktok.ts`, `twitter.ts`, `youtube.ts`, `media-validator.ts`, `rate-limiter.ts`, `retry-queue.ts`, `types.ts`, plus OAuth callbacks at `src/app/api/oauth/{meta,linkedin,tiktok,twitter,youtube}`.

It has **never executed**. `social_oauth_tokens` has 0 rows. Everything currently publishing goes through Mixpost. Confirmed this session: nothing outside `src/lib/publishers/` imports the dispatcher — only the four OAuth callbacks import `saveToken`. The path has no production caller.

Four defects, all verified:

1. **Cross-brand publishing hazard.** `src/app/api/oauth/meta/callback/route.ts:114` loops `for (const page of pages)` and writes every Facebook Page the user administers under the single `brandId` taken from the OAuth state (line 119). `token-store.ts:getToken()` then filters on `brand_id` + `platform` and resolves the account with `.order('updated_at', {ascending:false}).limit(1)` — an arbitrary pick. With 7 Facebook Pages and 5 Instagram accounts across Downscale, Downscale-Derm, TeleScribe, Scent Sell, Man Clinic and EndorseMe, one sign-in files all twelve under one project and **a Downscale weight-loss post can publish to the Man Clinic Page.** This is an AHPRA/TGA hazard.
2. **No compliance check on the direct path.** Confirmed: zero compliance references anywhere in `src/lib/publishers/`. The only working AHPRA/TGA gate is on the Mixpost path.
3. **Token renewal is not wired.** `dispatcher.ts:194` never passes a renewal function through. LinkedIn dies silently after ~60 days; TikTok dies overnight on a 24-hour token. The code writes "expired" and will not retry — only a human re-signing in fixes it.
4. **The retry queue fills and never drains.** `processRetries()` is referenced in a comment but does not exist anywhere in the codebase. No screen shows the queue.

Also verified: `ai_usage` has 0 rows. Cost tracking has never recorded anything.

---

## Topic: The compliance gate — current true state

- source: verified code, 2026-07-30 (`src/lib/agents/tools/publish-to-social.ts`, `src/lib/agents/compliance-filter.ts`)

`publish-to-social.ts` **now fails closed correctly**, covering both AHPRA and TGA via an explicit `check.checkCompleted` flag, with an in-code comment naming Downscale-Derm as the TGA-only case. This supersedes CONCERNS findings 1.1 and 1.2, which describe an earlier fail-open state.

Still open, and unaffected by that fix:
- The scheduled cron publisher runs **no compliance check at all** (CONCERNS 1.4). Content approved as a draft can be edited in the Review UI afterwards and published unreviewed — a time-of-check/time-of-use gap. `manage_posts` sets `status: 'scheduled'` in four places with no Guardian call.
- `blotato_publish` takes `userId` only, no `brandId`, so it cannot load compliance flags or run the Guardian, and is registered in the Director's toolset alongside `publish_to_social` (CONCERNS 1.3).
- `approval_queue` gates nothing — the publishing path never reads it (CONCERNS 1.5).
- `save_output` records violations and saves anyway, and is on the direct MCP allowlist (CONCERNS 1.6).
- Compliance hinges on two hand-set booleans on the `brands` row, with no validation or inference (CONCERNS 1.7).
- The Guardian still runs on `anthropic('claude-3-5-haiku-latest')` imported **directly from `@ai-sdk/anthropic`**, bypassing the AI Gateway that every other model call uses — confirmed this session. Separate credential dependency, no gateway fallback, no gateway spend attribution, on the highest-stakes judgement in the business (CONCERNS 1.8, 3.5).
- Zero tests on the compliance path (CONCERNS 1.9).

---

## Topic: Mixpost operational runbooks (DOC-class sources)

### Upload limits — 2 GB
- source: docs/specs/nrs-mixpost-upload-limits.md

Five layers had to be raised in sync; any one left at the old value blocks uploads. The Laravel validator layer is the one most people forget — it defaults to 200 MB regardless of nginx and PHP, producing Mixpost's own typo'd error `"The video must no be greater than 200 MB"`. The Horizon default queue timeout was the hidden fifth constraint: `DownloadRemoteMediaJob` runs on the `default` queue whose supervisor had `timeout: 60`, SIGKILLing a 5–10 minute transcode at 60 seconds with `MaxAttemptsExceededException`.

Persistence is via three host files mounted through `docker-compose.yml` (`zzz-uploads.ini`, `nginx-default.conf`, `horizon.php`), because container filesystem changes are lost on recreate. Timestamped `.bak` files exist on the VPS for rollback. Changing the limit later is a documented 7-step procedure.

### Webhook setup — one-off admin steps
- source: docs/specs/nrs-mixpost-webhook-setup.md

Registered manually once in the Mixpost admin UI (single-tenant, not worth programmatic registration). URL `https://www.notrealsmart.com.au/api/webhooks/mixpost`, POST, `application/json`, all nine events ticked, secret generated by Mixpost and stored as `MIXPOST_WEBHOOK_SECRET` in Vercel production and `.env.local`.

Named failure modes: `403 Invalid signature` (secret mismatch or trailing whitespace), `404 Not Found` (path must be exactly `/api/webhooks/mixpost`, not `/api/mixpost/webhook`), and no delivery at all (check Mixpost's Webhook Deliveries log for expired SSL, DNS).

### Webhook events and signing
- source: docs/specs/nrs-mixpost-webhooks.md
- note: this document is typed DOC but its classifier explicitly flagged that its content carries strong SPEC signals — exact event tables, wire format and a signature-verification contract. Its technical content is extracted as C-08 in `constraints.md`, which is where downstream work should read it.

The canonical event list is derived from Pro source inside the Docker container, because the public Mixpost docs do not publish it. Re-derive after any Mixpost Pro upgrade via `docker exec mixpost-mixpost-1 find .../src/Events -name "*.php"`.

---

## Topic: Studio build state as the specs left it

- source: docs/specs/nrs-creator-build-checklist.md, docs/specs/nrs-mixpost-visual-parity-inventory.md

The build checklist (2026-04-09) records PostCreator at "90% complete (541 lines, 7 StudioCards)" with 17 items built and 6 remaining: edit mode (`draftId`), media entry point (`mediaId`), Zustand navigation wiring (`pendingDraftId` / `pendingMediaId`), a schedule card, a "Create Post" button on media cards, and an "Alter" action on draft cards. It carries an explicit do-not-build list and a 10-item testing checklist, none of which is ticked.

The visual parity inventory (2026-04-10) maps Mixpost Pro's workspace UI component-by-component against NRS. Largest gaps: PostPreview (Mixpost 40 provider-specific renderers vs NRS 6 phone mockups), `ProviderVersionOptions` (13 per-platform metadata components, NRS has none), PostActivity inside the composer (19 files, NRS has none), Media Library Stock Photos and GIFs tabs, and real account avatars in place of initials. It reports PostCreator at 754 LOC — 213 lines above the checklist's 541, indicating work landed between the two documents.

Both are point-in-time snapshots from April 2026 and neither has been re-verified against the code in this ingest.

---

## Topic: Repository and supply-chain risk

- source: /Users/jb-downscale/NotRealSmartAgency/.planning/codebase/CONCERNS.md, Severity 3

- A 9.5 MB file named `anthropic-leaked-source-code-main.zip` is tracked in git history (introduced in `aa2d6b1`, 2026-04-06, deleted in the working tree but not the index). IP and legal exposure on a company-owned repository pushed to GitHub. The fix is a history rewrite — destructive, touches shared `main`, **explicitly flagged as an owner decision, not an autonomous cleanup**.
- Three untracked, un-ignored zip archives sit in the repo root (~6 MB), one `git add -A` away from repeating the above.
- `agency-agents-main-EXAMPLE/` is a vendored MIT-licensed third-party repo, 212 files, **modified in place** (27 files currently dirty), shipping its own GitHub Actions workflow into a production repo.
- Three high-severity dependency advisories (`postcss`, `sharp`, both reached through `next`) with no non-breaking fix — `npm audit fix --force` proposes a six-major-version downgrade. `sharp` processes user-uploaded media here, so the libvips CVEs are more than theoretical.

---

## Topic: What is solid — stated for balance

- source: /Users/jb-downscale/NotRealSmartAgency/.planning/codebase/CONCERNS.md

MCP project scoping (`assertProjectCapability` before every tool call, six test files). Telegram webhook hardening (`timingSafeEqual` with length pre-check). Cron authentication (all five routes verify `CRON_SECRET`). The Director-only allowlist polarity. CI running test + lint + build on every push to `main`. Secrets hygiene in source. The execution machinery — `runAgentWorker` / `runParallelAgents` with per-agent budgets, step limits, concurrency caps and audit logging — is well built. As CONCERNS puts it: "Finding 2.1 is not that the engine is bad; it is that nothing turns the key."
