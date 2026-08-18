# Social department — Mixpost parity on a Zernio engine

**Written** 2026-08-18 · **Repo HEAD** `51a89df2` · **Graph** `graphify-out/` built from the same commit.

The ask, in the owner's words: *"make my social media area EXACTLY the UI and functionality of Mixpost, but use the FULL force and documentation of Zernio."*

Read literally. **Mixpost is the shape and the feature set. Zernio is the engine.** Where Zernio does more than Mixpost — engagement inbox, comments, mentions, reviews, best-time-to-post, pre-flight validation, content decay — that is upside to surface, but never at the cost of the shape he asked for.

## Sources this matrix is built from

| Source | What it is | How current |
|---|---|---|
| `mixpost-pro-team/resources/js` on the VPS (`docker exec mixpost-mixpost-1`) | 50,638 lines of live Vue. The Mixpost column below is read from it, not from memory or from `~/Obsidian/Reference/nrs-mixpost-visual-parity-inventory.md` | 2026-08-18 |
| `node_modules/@zernio/node@0.2.587/dist/index.d.ts` | 678 methods, 64 namespaces, **568 distinct operations** | installed; npm latest is 0.2.590 |
| `https://zernio.com/openapi.yaml` (`info.version 1.0.4`, 2.27 MB) | 568 path operations + 49 webhook payloads. **Set-diff against the SDK is zero both ways** | fetched 2026-08-18 |
| `DESIGN.md` (455 lines) + `.mockups/dept-social.html` | the locked visual contract | 2026-08-17 |

**NRS reaches 13 of 568 Zernio operations today (2.3%)** — four through the SDK (`accounts.listAccounts`, `posts.createPost`, `posts.listPosts`, `posts.getPost`), nine as hand-rolled `fetch`.

---

## Five traps that must be designed around, not discovered

Every implementer reads these before writing a line.

1. **A wrong path returns HTTP 200 with an HTML page.** `GET https://zernio.com/api/v1/anything-wrong` → `200 text/html` (the Zernio Next.js shell), not 404. Proven live against `/v1/validate/post` (real path `/v1/tools/validate/post`) and `/v1/analytics/best-time-to-post` (real path `/v1/analytics/best-time`). Every hand-rolled call site in NRS guards with `if (!res.ok) throw` — `src/lib/zernio/client.ts:283`, `:449`, `:497`, `src/lib/agents/tools/zernio-ads.ts:20/31/68`, `src/app/api/inbox/route.ts:66` — and **that guard cannot fire**. The failure surfaces later as a JSON parse throw or, worse, as an empty-but-successful payload. This is the single strongest argument for routing everything through the SDK, which owns the path strings. Slice 1 adds `assertZernioJson()` for the few places raw fetch must remain.
2. **`listPosts` defaults to `source: 'zernio'` and hides all history.** `GET /v1/posts` returns **0 posts** on the live account while `GET /v1/analytics` reports `totalPosts: 210, publishedPosts: 210`. The 210 are only reachable with `?source=external`. `fetchZernioPosts` (`src/lib/zernio/client.ts:370-376`) never sets `source`, so a Posts list built on it shows an empty screen for a brand with 210 published posts.
3. **`getPost` 404s on external post ids.** `posts.getPost` resolves Zernio-authored posts only. The cross-resolver is `analytics.getAnalytics({query:{postId}})` — documented as *"Accepts both Zernio Post IDs and External Post IDs"* — and `analytics.getPostTimeline({query:{postId}})` also accepts an external `_id`.
4. **`_id` not `id`, and it is not uniform.** Mongo-backed resources (accounts, posts, profiles, account groups, queues, webhooks) carry `_id`; the inbox and contacts projections carry `id`. **Accept both, always.** Population is per-field and per-endpoint: on one live post `platforms[0].accountId` came back as a populated `{_id, platform, profileId, displayName, …}` object and `userId` as `{_id, name, email, image}`, while `profileId` on the same response was a plain string. The SDK types declare the unions honestly (`PlatformTarget.accountId?: (string | SocialAccount)`, `index.d.ts:5546`).
5. **Pagination params travel as a pair.** `GET /v1/accounts?limit=3` alone → **HTTP 400** `page and limit must be provided together`. `listPosts` behaves differently and always returns pagination, defaulting to limit 10.

### Tenant isolation — behaviour unchanged, rationale corrected

`CLAUDE.md` and `src/lib/zernio/client.ts:51-72` state that `listAccounts({profileId})` accepts the filter and ignores it. **Measured live on 2026-08-18 against the same account, it filters correctly**: unfiltered 10 accounts across 3 profiles; `?profileId=6a824168f61b88239335dd0c` → 4 accounts, 1 profile; a bogus profile id → 404, not everything. The sentence that was misread — *"Posts validate `accountId` against your whole team, not against a profile"* — is about `POST /v1/posts` account validation, which is a genuinely separate and **still real** risk.

**Therefore: no behaviour changes.** `fetchZernioAccounts()` keeps filtering in our code after `normaliseAccount`, because a Zernio profile is an organisational boundary and never a security one, and because the post-creation risk is unaffected by what listAccounts does. **`src/lib/zernio/account-scoping.test.ts` is not touched by any slice.** What is owed is a comment and a `CLAUDE.md` line that stop asserting a measurement that no longer reproduces — flagged here, deliberately not folded into a build slice, because it is a documentation decision for the owner, not a code change.

---

## The matrix

Legend for **NRS today**: **REAL** = built and working · **PARTIAL** = built, load-bearing piece missing · **COSMETIC** = renders, does nothing · **ABSENT**.

### A. Chrome and navigation

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Left sidebar, 240px fixed | `@utility aside { w-[240px] }`, main is `calc(100% - 240px)`; three groups — unheaded (Dashboard, Engagement), `Content`, `Configuration` | none (chrome) | **REAL at 236px** — `nav-sections.ts:184-212` declares Social first with Content/Setup/Results and 8 live children. DESIGN.md locks 236px; the mockup's own sidebar omits "Waiting on you" that DESIGN.md:290 and `nav-sections.ts:197-202` both carry | Keep 236px (DESIGN.md wins over the Mixpost pixel). Add the Engagement child that Mixpost has and NRS lacks | **S2** |
| Sidebar count badges | Mixpost has none; NRS's own contract does | `posts.listPosts({query:{status,profileId}})` for counts | **DEAD** — `AgencySidebar.tsx` consumes `counts` at `:128,157,243,380,456`, `layout.tsx:247-254` never passes it. No badge, including "Waiting on you", can ever render | Wire `counts` + `businessSubtitle` from a new `/api/social/nav-counts` | **S2** |
| Full-width dark "Create post" under the logo | `DarkButtonLink`, editor role only, `href: mixpost.posts.create` | none | **REAL** — locked in DESIGN.md at 13px/600, +0.02em, radius 10 | none | — |
| `MenuItem` active affordance | text `gray-400 → gray-900`. No pill, no accent bar, no icon colour change | none | **REAL** and better specified in DESIGN.md | none | — |
| Mobile `NavBar` | `xl:hidden`, h-12, hamburger + an empty `#navRightButton` that pages teleport into | none | **PARTIAL** — layout drops to `grid-cols-[minmax(0,1fr)_auto]` below lg | Keep. Do not build a teleport target; the composer's action bar is a chrome slot instead | **S2** |
| Inner tab strip | Not a Mixpost pattern — Mixpost puts each page at its own route | none | **PARTIAL** — `SocialDepartmentChrome.tsx:107-120` renders 7 tabs; the `SocialTabId` union at `:23-32` declares `accounts` and `waiting` which are never in the array, so `/agency/social/accounts` renders `aria-labelledby="social-tab-accounts"` pointing at a button that does not exist | Fix the ARIA orphan; add Inbox; add tab icons (`DepartmentTabs.tsx:36,171-175` already reserves a 16px box); add quiet inventory badges | **S2** |
| Department leaks back to `/agency/studio/*` | — | none | **BROKEN** — `EnhancedCalendar.tsx:204` pushes `/agency/studio/create`; `TemplatesIndex.tsx:67,72,218,295` pushes `/agency/studio/templates/{id}`; every OAuth callback redirects to `/agency/studio/accounts` (`oauth/youtube/callback/route.ts:64,201`, `zernio/callback/route.ts:70`). All drop the Social chrome | Repoint every one. `/agency/studio/post` stays a 307 | **S2** (callbacks), **S4** (calendar), **S5** (templates) |
| `UserMenu` at sidebar foot, workspace switcher | avatar + name + workspace, workspace grid, Settings/Billing/Admin/Tokens/Sign out | `profiles.listProfiles`, `createProfile`, `updateProfile` | **PARTIAL** — business selector exists; a Zernio profile is hand-linked into `brands.social_urls.zernio_profile_id` | Out of scope for parity. Note `profiles.*` (5 ops) is the honest place to create a profile per brand rather than hand-linking | — |
| Brand Voice page (551 LOC) | Mixpost's AI voice config | none — Zernio has no brand-voice resource | **ABSENT**, and correctly so | **Do not build.** NRS already owns brand voice (`branding/voice`, brand kit, memory). Duplicating it inside Social would split the source of truth | — |

### B. Posts list

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Status tabs | Up to seven: All · Drafts · **Needs approval*** · Scheduled · Published · **Failed*** · Trash. The starred two render only when such posts exist; Failed carries `text-red-500`. Throttled 300ms Inertia GET, `only:['posts','filter']` | `posts.listPosts({query:{status:'draft'\|'scheduled'\|'published'\|'failed', profileId, source, page, limit}})` — **note the enum has no `needs_approval` or `trash`**; those are NRS/Mixpost concepts | **REAL** — six tabs with live counts, `PostsIndex.tsx:25-32`, `usePostsList.ts:96` | Add the conditional-render rule and the red Failed tab. **Needs approval and Trash stay NRS-owned** (`scheduled_posts` + `save-gate`), because Zernio has no approval or soft-delete concept — this is the correct Build-First split | **S4** |
| Seven table columns | checkbox `w-10` · Status `w-44` · Content `pl-0! text-left` · Media `w-48` · Labels · Accounts · actions. `divide-y divide-gray-200`, cells `px-lg py-sm` | — | **PARTIAL** — `PostsTable.tsx` (407 lines) has no Labels column and no tag surface anywhere in NRS | Add all seven. Labels are NRS-owned (see D) | **S4** |
| Status dots | `PostStatus.vue`: draft `bg-gray-500`, published `bg-lime-500`, publishing `bg-violet-500`, scheduled `bg-cyan-500`, needs_approval `bg-orange-500`, failed `bg-red-500` — theme redefines cyan-500 `#84e9f5`, orange-500 `#ffab4c` | `Post.status` is a confirmed enum `'draft'\|'scheduled'\|'publishing'\|'published'\|'failed'\|'partial'` (`index.d.ts:5626`) | **PARTIAL** — DESIGN.md already locks the five `--st-*` tokens (`globals.css:97-102`) and they are the right ones | Map to `--st-draft/--st-sending/--st-sched/--st-pub/--st-fail`. **Add a sixth for `'partial'`** — `zernioPostState` (`client.ts:548-554`) maps neither `'publishing'` nor `'partial'` and `'partial'` is a real terminal state. Never copy Mixpost's Tailwind hex | **S4** |
| Row click opens a preview modal | Clicking Status/Content/Media/Labels sets `preview=true` and opens a `DialogModal` with `PostPreviewProviders`; editing is only via the pencil | previews are ours — **Zernio has no render/preview operation.** The only `preview` paths in the whole spec are `/v1/queue/preview`, `/v1/whatsapp/flows/{id}/preview`, `/v1/ads/preview`, `/v1/ads/{adId}/preview` | **ABSENT** — the row navigates | Build the modal, reusing `studio/preview/` mockups | **S4** (modal) + **S3** (owns the mockups) |
| Status + Content + Media cells | Status: dot + label + `scheduled_at.human`/`published_at.human`. Content: `w-96 break-words` excerpt of the FIRST account's version. Media: one thumbnail + a `+N` badge at `top-0 -right-5` | `PlatformTarget.publishedAt`, `platformPostUrl` | **PARTIAL** | Match. Use `thumbnail_url` for video so the frame is real | **S4** |
| Accounts cell | up to 3 avatars overlapping at `-ml-6` with name tooltips; `+N` opens a `w-64` dropdown of the rest | `listAccounts` (already wrapped) | **PARTIAL** | Match | **S4** |
| Per-row dropdown | pencil (Edit for editors / Eye for read-only), then `⋮` → Restore (trashed only) · Duplicate · [Usage API group: Copy UUID] · Delete (red) → confirmation modal choosing `app_only`/`app_and_social`/`social_only` | `posts.deletePost({path:{postId}})` = app-side. **`posts.unpublishPost({path:{postId},body:{platform}})` is the live-platform delete** — supported on threads, facebook, twitter, linkedin, youtube, pinterest, reddit, bluesky, googlebusiness, telegram. `posts.retryPost({path:{postId}})`. `posts.editPost({path:{postId},body:{platform:'twitter'\|'discord'\|'facebook'\|'reddit', content}})` | **PARTIAL** — Edit/Duplicate/Reschedule/Delete/Ask-Director exist at `PostsIndex.tsx:182-257` | Add the three-way delete modal, Retry on failed rows, and Unpublish. **`unpublishPost` is the correct answer to an AHPRA/TGA takedown** and NRS has no equivalent today | **S4** |
| Bulk actions | `SelectableBar` — fixed bottom pill, `bg-alert text-alert-context`, count chip + "items selected". On Posts the **only** action is a Trash button | `posts.deletePost` per id | **BROKEN** — `PostsBulkActions.tsx:78-84` GETs `/api/scheduled-posts?ids=${id}` which 400s without `brandId` (`scheduled-posts/route.ts:29-30`), so every fetch returns null, zero POSTs fire, `failed.length === 0`, and the component **reports success having created nothing** | Fix the query, then keep only what Mixpost keeps. Do not invent bulk reschedule | **S4** |
| Search + filter | `SearchInput` on `filter.keyword`, then a `w-72` dropdown (Labels checkboxes · Accounts checkboxes) with a count chip and Clear filter. Reused verbatim on the Calendar toolbar | `posts.listPosts({query:{search, accountId, platform, dateFrom, dateTo, sortBy}})` — `sortBy` is `'scheduled-desc'\|'scheduled-asc'\|'created-desc'\|'created-asc'\|'status'\|'platform'` | **PARTIAL** — `PostsFilters.tsx` has search/platform/date/sort, **no label filter** | Add labels; share the component with the Calendar toolbar as Mixpost does | **S4** |
| Reschedule | Mixpost has no reschedule action on the list at all | `posts.updatePost({path:{postId},body:{scheduledFor}})` | **REAL but hostile** — `PostsIndex.tsx:213` uses a raw `prompt('Reschedule to (YYYY-MM-DDTHH:mm)')`. A date format string put in front of a non-technical owner | Replace with the Choose-a-time control from the composer | **S4** |
| Pagination / NoResult | pagination only when `meta.links.length > 3`; "No posts found" under the table | `pagination:{page,limit,total,pages}` on `listPosts` | **PARTIAL** — client-side | Server-side via `listPosts` page/limit for external history | **S4** |
| Post duplication | `Duplicate` in the row dropdown | **none — there is no `duplicatePost`.** The only duplicate ops in all 568 are `duplicateAd`, `duplicateAdCampaign`, `duplicateAdSet`, `duplicateWorkflow` | broken (above) | Read-then-`createDraftPost()`. **Honest fallback: ours.** Never raw-insert `scheduled_posts` | **S4** |

### C. Composer

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Two-pane shell | flexible left pane + **fixed 750px** right pane on `bg-stone-500` (`#fafafa`); below md the right pane is a full-screen slide-over | none | **ABSENT, deliberately** — `ComposerLayout.tsx:10-13` is a single scrolling column: *"Preview lives in the column under the caption, not a competing right pane."* `.mockups/dept-social.html` agrees and DESIGN.md locks it | **Do not build the split pane.** This is the one place where the locked mockup outranks "exactly Mixpost", and DESIGN.md is the authority on shape. `PostCreator.tsx:152-155` still claims a split pane in its docblock — delete that stale comment | **S3** |
| Right pane tabs Preview \| Activity \| Analytics | three tabs, the latter two `disabled` until the post exists | Activity is ours. Analytics: `analytics.getPostTimeline({query:{postId, fromDate, toDate}})` accepts an **external** `_id` | **PARTIAL** — activity thread is real (`usePostActivity.ts`, Realtime, optimistic add) but only reachable from `ReviewRoom`'s Activity tab | Surface Activity and per-post Analytics from the Posts row modal, not a competing pane | **S4** (modal) + **S6** (timeline data) |
| Autosave, no "Save as draft" | `watch(form, debounce(save, 300))`; lime/red dot + "Saved" in the header; 422 on `in_history`/`publishing` forces a page revisit | `posts.updatePost` for an existing post. `isDraft` on `createPost`: *"When none of scheduledFor, publishNow, or queuedFromProfile are provided, the post defaults to draft automatically"* | **ABSENT** — explicit Save draft button | Add 300ms debounce autosave with a saved-state dot. Drafts are still born only in `createDraftPost()` — autosave calls that, never a raw insert | **S3** |
| `PostErrors` band | full-width `text-red-500 bg-red-50` band above everything, `list-disc` of every validation error grouped | `validate.validatePost` returns `{valid, errors:[{platform,error}], warnings:[{platform,warning}]}` | **PARTIAL** — `PostContentValidator.tsx` | Feed it from Zernio's own validator so the copy matches what publishing will actually enforce | **S3** |
| Account selector strip | every workspace account as a clickable avatar; `grayscale` when unselected; provider icon bottom-right; disabled when `simultaneousPosting(false)` — **X and LinkedIn** block multi-account selection | `accounts.listAccounts({query:{profileId, status:'connected'}})` | **PARTIAL** — 6 platform pills (`PlatformSection.tsx:20-57`), not per-account avatars | Rebuild as per-account avatars. This is what unlocks two Instagram accounts on one post | **S3** |
| Per-account version tabs | `PostVersionsTab` renders only when >1 account: Original + one tab per account with its own version, `×` to remove behind a confirm, `+` dropdown "Create version for". Adding deep-clones the original | **`platforms[].customContent`** — *"Platform-specific text override. When set, this content is used instead of the top-level post content for this platform"* (`index.d.ts:11499-11512`). Plus `customMedia?: MediaItem[]` and per-platform `scheduledFor` | **REAL and better than Mixpost** — `PlatformVersionEditor.tsx:49-128` gives All Platforms + per-platform tabs, `*` markers, Reset to master, per-tab limits; `resolvePublishCaption` is used at save time (`PostCreator.tsx:821`) | **THE HEADLINE GAP: NRS sends none of `customContent`/`customMedia`/`scheduledFor`.** `createZernioPost` (`client.ts:127-134`) builds `platforms` from `{platform, accountId}` plus one shared `platformSpecificData` applied identically to every entry. Today per-platform variants only survive because NRS writes one `scheduled_posts` row per platform. Wire the fields, then per-**account** variants become possible | **S1** (wire) + **S3** (collect) |
| Per-provider option panels | Exactly **ten**: Mastodon, Pixelfed, Facebook Page, Instagram, Instagram standalone, YouTube, GBP, Pinterest, LinkedIn, TikTok. **There are no X/Twitter, Threads, Bluesky or Facebook Group option components at all.** TikTok's is 544 LOC and renders one group per TikTok account | **15** platform-data unions on `platforms[].platformSpecificData`. Zernio covers everything Mixpost does **plus** Twitter (`replyToTweetId`, `quoteTweetId`, `replySettings`, `threadItems[]`, `poll`, `paidPartnership`, `madeWithAi`, `sensitiveMedia`), Reddit, Discord, Telegram, Snapchat, Slack, Bluesky | **REAL and the most honest code in the area** — `PlatformOptions.tsx:43-49,352-357` replaces any undeliverable field with a plain-English reason instead of a silent no-op; options survive to the wire via `metadata.platform_options` → `platformOptionsOf` → `dispatcher.ts:490,1023-1039` | `zernio-platform-data.ts:18-62` maps 12 keys across 6 platforms against 15 available unions. Widen it. **`TwitterPlatformData.threadItems[]` disproves the thread refusal at `zernio-platform-data.ts:56-60`** — the reason given ("a yes/no switch cannot invent them") is correct about the switch and wrong about the field | **S1** (map) + **S3** (fields) |
| TikTok pre-flight | privacy level, comment/duet/stitch flags read per account, disclosure toggles, branded-content gating | `accounts.getTikTokCreatorInfo({path:{accountId}})` — required pre-flight for the privacy options | **ABSENT** — options are shown unconditionally | Fetch creator info and grey what that account cannot do, exactly as Mixpost does | **S1** (fetch) + **S3** (grey) |
| Thread vs first comment | provider `contentType` drives the `+` button: Meta and LinkedIn-with-community are **comments** type ("Add first comment", max 2 items); Twitter/Bluesky/Mastodon/Pixelfed/Threads are **thread** type | `threadItems[]` on Twitter/Threads/Bluesky; `firstComment` on Instagram, Facebook, LinkedIn, YouTube | **ABSENT** | Build. This is the largest genuine feature gap in the composer | **S3** |
| Character count | plain number of characters remaining, `text-stone-800` → orange under 20% → red when negative. **No ring** | `validate.validatePostLength({body:{text}})` returned **15 targets** live: twitter 280, twitterPremium 25000, instagram 2200, threads 500, facebook 63206, linkedin 3000, tiktok 2200, youtube 5000, bluesky 300, reddit 40000, pinterest 500, telegram 4096, telegramCaption 1024, snapchat 160, googlebusiness 1500 | **REAL** — `PlatformCharacterRing.tsx` measures the exact string the publisher assembles | Keep the measurement. Replace the local limit table with Zernio's, so the ceiling can never drift from what publishing enforces. DESIGN.md wants mono/tabular-nums counts, so drop the ring for the mockup's right-aligned numerals | **S1** (limits) + **S3** (display) |
| Headless validator | `PostContentValidator.vue` (586 LOC) renders `<div></div>`; computes char + media errors into two groups | `validate.validatePost` — **live-proven to honour `customContent`**: 300 chars + twitter → `"Twitter content is 300 characters, exceeds the 280 character limit"`; the same call with `customContent:'short'` on twitter → that error gone. `validate.validateMedia({body:{url}})` returns per-platform byte limits (13 platforms; bluesky 1 MB, twitter/googlebusiness 5 MB, instagram/threads/linkedin 8 MB, facebook/telegram 10 MB, tiktok/reddit/snapchat 20 MB, discord 26 MB, pinterest 33.5 MB) | **PARTIAL** — local tables | Pre-flight through Zernio's validator on a debounce. This is a **dry run of the exact rules publishing applies** and it is free | **S1** + **S3** |
| `PostActions` bottom bar | labels picker · schedule-time button group with an `×` to clear · **Approve** (green, when `userCanApprove && needsApproval`) · **Schedule** · **Post now** (confirmation listing target accounts) · **Add to queue** (amber, when `hasAvailableTimes`). `canSchedule = postId && accounts.length && editAllowed && validationPassed` | `createPost({scheduledFor})` / `{publishNow:true}` / `{queuedFromProfile, queueId}` | **PARTIAL** — `CreatorActionBar.tsx` is inside `PostCreator`, not a chrome slot. `.mockups/dept-social.html` locks it as a `.actbar` sibling of the pane with a care-washed `.actgate` strip above it for regulated businesses | Make the action bar a chrome-owned slot (S2) that the composer fills (S3). Approve stays NRS's gate | **S2** (slot) + **S3** (fill) |
| Transport honesty | — | — | **HONESTY GAP** — `PostCreator.tsx:242` decides deliverability with `brandIsPublisherLinked(social_urls)` (true whenever a `zernio_profile_id` exists); the publisher decides with `publisherTransportOf` (`transport.ts:17-22`) which **first honours an explicit `social_urls.publisher_transport` override**, and `AccountsPage.tsx:98-114` exposes exactly that override. A brand with a Zernio profile whose owner clicks "Post through the self-hosted backup" is shown every Zernio-only field as a live input and the fallback publisher drops them silently — the precise failure `PlatformOptions` was written to prevent | Composer must call `publisherTransportOf`, the same function the publisher calls | **S3** |

### D. Previews, labels, activity

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Preview renderers | 43 `.vue` files, 13 provider keys → 11 components; a parallel `ProviderGallery` of 31 files does the OneImage/TwoImage/ThreeImage/FourImage/Video layouts | **none — Zernio has no render endpoint.** Previews are ours permanently | **REAL** — 11 mockups, ~1,570 lines in `studio/preview/`, resolving through `resolvePublishCaption` so preview and saved row cannot disagree; uses `thumbnail_url` for video | Add the multi-image gallery layouts (1/2/3/4-up + video) Mixpost has and NRS does not. **Honest fallback: build it, there is nothing to buy** | **S3** |
| Labels / tags | tag chips with `hex_color`, filter by label, label picker in `PostActions`, coloured stripes on calendar cards | **none.** There is no post tag taxonomy. `Post.tags`/`hashtags` are plain `string[]` (YouTube constraints: each ≤100 chars, combined ≤500). The only `template` paths are WhatsApp; `/v1/ads/labels` is Meta ad labels | **ABSENT** — no tag surface in the UI at all | Build NRS-owned labels on `scheduled_posts`. **This is Build-First by necessity, not by choice** | **S4** |
| Post activity feed | nine renderers (COMMENT, CREATED, SET_DRAFT, UPDATED_SCHEDULE_TIME, SCHEDULED, SCHEDULE_PROCESSING, PUBLISHED, PUBLISHED_FAILED, DELETED_FROM_SOCIAL_PLATFORMS), a pinned `NewComment`, a subscription bell, scroll persisted across tab switches | webhooks supply the system events | **PARTIAL and lopsided** — table, API, Realtime, optimistic add, count badges all real. But system events are inserted **only** by the Mixpost webhook (`webhooks/mixpost/route.ts:147,177,218`); `webhooks/zernio/route.ts` writes `publisher_runs` and inbox rows and **never** `post_activity`. So for exactly the subscriber brands Zernio serves, the timeline shows comments and nothing else | Write `post_activity` from the Zernio webhook. Subscribe the missing events (below) | **S4** |
| Webhook coverage | — | spec documents **49 event types**; `CreateWebhookSettingsData.events` enumerates 47 subscribable | **7 subscribed** on the live subscription (`_id 6a8245842abfbb58d459454a`, "NRS desk", `lastFiredAt 2026-08-18T04:53:29Z`): post.published, post.failed, post.partial, account.connected, account.disconnected, message.received, comment.received | Add `post.scheduled`, `post.cancelled`, `post.platform.published/.failed/.deleted`, `post.external.created/.updated/.deleted`, `review.new`, `conversation.started`. **`post.platform.deleted` pairs with `PlatformTarget.removedFromPlatformAt` and is the signal that a published health post vanished from the platform** | **S1** |
| Security note | — | `GET /v1/webhooks/settings` returns the HMAC `secret` in plaintext to any API key | unassessed | Flag to `/gstack-cso`. **Not a build slice** — do not paper over it | — |

### E. Calendar

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Month / Week | `CalendarMonth` (181) / `CalendarWeek` (164); heights fixed by `calc(100vh - 139px)` | `listPosts({query:{dateFrom, dateTo, profileId, source}})` | **PARTIAL** — FullCalendar month/week | Match the two views; keep the pane as the only scroller | **S4** |
| View switch | a **dropdown** (`SecondaryButton` sm reading Month/Week + chevron), **not** a segmented toggle | — | segmented | Match | **S4** |
| Toolbar | `CalendarSwitchType` + the *same* `PostsFilter` component | — | separate | Share the component | **S4** |
| Post card | `rounded-md border-gray-200 hover:border-primary-500`; a left column of `w-sm` full-height stripes, one per label in `tag.hex_color`; excerpt; deduplicated provider icons; ClockIcon + time left, status dot right | — | **PARTIAL** — `CalendarPostPill` | Add label stripes once labels exist | **S4** |
| Drag to reschedule | **Mixpost cannot do this.** `grep -rn 'draggable\|dragstart\|VueDraggable\|drop=' Components/Calendar/` returns **zero**. The only day affordance is a `+` on hover that prefills `schedule_at` | `posts.updatePost({path:{postId},body:{scheduledFor}})` | **REAL — NRS is ahead** (`EnhancedCalendar.tsx:154,176-191`, optimistic with revert) | **Keep it.** "Exactly Mixpost" does not mean removing something better that already works | **S4** |
| Content-type filter chips | not a Mixpost feature | — | **COSMETIC** — `CalendarActions.tsx:89-98` early-returns when `onFilterChange` is undefined, and `calendar/page.tsx:11` renders `<CalendarActions />` with no props. Four chips that can never highlight and never filter | Wire them or delete them. Do not ship a dead control | **S4** |

### F. Media library

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Source tabs | **four**, conditional: Uploads · Stock · GIFs (unless mime-restricted) · New design (only when `adobe_express` configured) | — | **REAL and richer** — Library / GIFs / Stock, plus collections, tag filters, smart re-tag, usage counts, all over NRS's own `media_items` | Add the fourth tab as **Canva**, which NRS already integrates, in place of Adobe Express | **S5** |
| Upload | `UploadMedia` 632 LOC, chunked with progress, max-selection 4 | `media.getMediaPresignedUrl({body:{filename, contentType, size}})` → `{uploadUrl (PUT, 3600s), publicUrl, key}`, contentType a closed 20-value enum, size pre-validated to 5 GB. Or `messages.uploadMediaDirect({body:{file}})` — **max 25 MB**, and note it is filed under `messages` despite being general media | **REAL** — `useChunkedUpload.ts`, `UploadQueuePanel` | Keep NRS uploads. Use presign only to hand Zernio a URL at publish time | **S5** |
| Media library storage | Mixpost owns a media library | **none — there is no `GET /v1/media`, no list, browse or delete.** Upload + reference only | **REAL, ours** | **The media library stays ours permanently.** Not a gap | — |
| Alt text | `AltTextDialog` | `MediaItem.altText` — applied on Instagram feed images (not Reels/Stories), Facebook, Threads, X (max 1000), LinkedIn, Bluesky, Pinterest (max 500); ignored elsewhere | **PARTIAL** — `AltTextDialog.tsx` exists; alt text does not reach the wire | Thread `altText` through `mediaItems[]` | **S1** (wire) + **S5** (capture) |
| Video thumbnails | `enableVideoThumb` for YouTube, LinkedIn, Pinterest, Instagram reels | `MediaItem.thumbnail` (FB video/reel + LinkedIn video, max 10 MB), `MediaItem.instagramThumbnail` (Reel cover, four-level resolution order) | **PARTIAL** | Wire both | **S1** + **S5** |
| Upload from URL / AI generate | `MediaUploadFromUrl`, `MediaUploadAiGenerate` are first-class | — | **REAL** (`generate_image` tool, Canva import) | none | — |
| Giphy key | — | — | **FRAGILE** — `giphy/search/route.ts:3,10` falls back to Giphy's retired public beta key `dc6zaTOxFJmzC` when `GIPHY_API_KEY` is unset. `pexels`/`unsplash` return "API key not configured" with **HTTP 200** | Fail loudly, in owner language | **S5** |

### G. Templates, accounts, schedule, webhooks

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Templates index | masonry `:columns=3` of cards; each has **Use** plus a dropdown with exactly **Edit and Delete — no duplicate** | **none.** Zernio has no post template resource; the only `/template` paths are WhatsApp message templates | **PARTIAL** — real CRUD over NRS `post_templates` (`useTemplates.ts:54`, migration 029), but the editor lives only at `/agency/studio/templates/[id]`, so creating one ejects the owner from the Social chrome. Separately, `fetchMixpostTemplates`/`createMixpostTemplate` have **no UI at all** and exist purely as Director tools | Add `/agency/social/templates/[templateId]`. **Templates stay ours** — Build-First by necessity | **S5** |
| Accounts grid | `grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5`; the **Add account tile leads** the grid; each panel has a red dot tooltipped "Unauthorized" when `!authorized`, name, "Added {date}" | `accounts.listAccounts({query:{profileId, status:'connected'\|'disconnected'}})`. `SocialAccount` fields NRS drops: `profilePicture`, `profileUrl`, `isActive`, `needsReconnection`, `followersCount`, `followersLastUpdated`, `enabled` (*"Posting UI and scheduler ignore accounts with enabled:false"*), `parentAccountId` | **PARTIAL** — list is Zernio-first (`useSocialAccounts.ts:70-86`) but **every account is stamped `status:'active'` in both branches** — the health indicator is a constant, never a token check | `accounts.getAllAccountsHealth()` → `{summary:{total,healthy,warning,error,needsReconnect}, accounts:[{accountId, platform, status, canPost, canFetchAnalytics, tokenValid, tokenExpiresAt, needsReconnect, issues[]}]}`. Live: 10 total, 8 healthy, 2 warning. **Two accounts are in warning right now and the desk says everything is fine** | **S5** |
| Account dropdown | View profile · Update · Reauthenticate · Edit suffix · [Copy ID, Copy UUID] · Delete | `accounts.updateAccount`, `moveAccountToProfile`, `deleteAccount`, `connect.*` (30 ops + 14 nested) | **PARTIAL** | Add Reauthenticate and Delete in owner language ("Reconnect", "Remove") | **S5** |
| Add-account modal | 14 platform entries, service-gated; Mastodon/Pixelfed/Bluesky carry credential forms | `connect.*` per platform; NRS already calls `GET /connect/{platform}` | **PARTIAL** — `ConnectAccountDialog.tsx:38` | Match the 14 | **S5** |
| `AccountEntities` | the post-OAuth **entity chooser** — pick which Facebook Pages / LinkedIn Pages / GBP locations to attach. Checkbox rows, 32px avatars, "Connected" sub-label, "Finish connection" disabled until one is chosen | part of the connect flow | **MISATTRIBUTED + WRITE-ONLY** — the Obsidian inventory calls this "per-account hashtags"; NRS built exactly that instead. `AccountsPage.tsx:51-53` tells the owner hashtags/mentions/variables "get injected into every post". **They are not.** `account_entities` is written and read back only by `AccountEntitiesEditor` — zero hits in `src/lib/publishers`, `api/scheduled-posts` or `api/cron`. The publish path never sees them | Either inject them at compose time or delete the promise. **Shipping a claim the code does not honour is the worst outcome** | **S5** |
| Client-side account leak | — | — | **BROKEN** — `BusinessSelector.tsx:164`, `ConnectionsPanel.tsx:55`, `ChatInterface.tsx:62`, `useConnectedPlatforms.ts:22` all hit `/api/mixpost/accounts` with **no `brandId`**, so they receive the entire fallback workspace with no per-brand scoping and no Zernio branch. For a Zernio-linked brand the chrome describes another publisher's accounts | Route through the Zernio-first service | **S5** (hook) + **S2** (chrome) |
| Posting schedule | Panel 1 "Add new posting time" (weekday select + FlatPickr wheel honouring 12/24h + TimezoneInfo); Panel 2 seven day cards, each with an On/Off switch and times as `HH : MM` with hover-`×`, plus "Clear all posting times" | `queue.listQueueSlots({query:{profileId, queueId?, all?}})` → `{exists, schedule, nextSlots[]}`; `createQueueSlot({body:{profileId, name, timezone (IANA), slots:[{dayOfWeek:0-6 Sun=0, time:'HH:mm'}], active}})`; `updateQueueSlot({…, setAsDefault, reshuffleExisting})`; `deleteQueueSlot({query:{profileId, queueId?}})` — **omitting `queueId` deletes ALL queues for the profile**; `previewQueue({query:{profileId,count,queueId}})`; `getNextQueueSlot`. Docs warn: *"Do not call /v1/queue/next-slot and use that time in scheduledFor, that bypasses queue locking"* — use `createPost({queuedFromProfile})` | **COSMETIC** — grid + `SlotEditor` + `/api/posting-schedule` all work, but the page promises *"Drop drafts into the queue and they will publish at the next open slot"* and `assignToSlot`/`unassignFromSlot` (`assign-to-slot.ts:137,226`) have **zero callers**, so `queue_slot_id` is never written, per-slot counts are permanently 0, and the cron never consults a slot. The only live consumer of the whole feature is `earliestNextSlot`, printing one hint string | Back the grid with Zernio's real queue. **Live: no queue is configured on any NRS profile** (`{exists:false, schedule:null, nextSlots:[]}`) so this is greenfield, not a migration | **S1** (wrap) + **S4** (page) |
| Webhooks UI | index table (6 columns), create/edit (Details · Security · Events), deliveries log | `webhooks.getWebhookSettings`, `updateWebhookSettings`, `deleteWebhookSettings`, `testWebhook({body:{webhookId}})`, `getWebhookLogs({query:{event, webhookId, status, limit, skip}})` — logs return the full `requestPayload`, a replay surface NRS is not using | **ORPHANED** — full API (`/api/user-webhooks` + `[id]` + `deliveries`) and a three-component UI at `/agency/studio/webhooks`, but `nav-sections.ts` has no row and the chrome has no tab. The only referrer is the dead `StudioSidebar.tsx:137`. Reachable by typing the URL and nothing else | **Out of the six slices.** Webhooks are plumbing and the owner is non-technical; Mixpost's webhook page is for developers. Leave orphaned deliberately rather than surfacing an API concept | — |

### H. Analytics — Mixpost's "Dashboard"

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| The Dashboard route **is** Analytics | there is **no** `Pages/Workspace/Dashboard.vue`; the sidebar's Dashboard item is active when `$page.component === 'Workspace/Analytics'`. `Components/Analytics` holds 28 files, a surface the Obsidian inventory does not mention at all | — | NRS's `/agency` dashboard is its own thing and is **REAL** (`useStudioData.ts:91` → `/api/studio/overview`, Zernio-first at `overview-accounts.ts`) | Keep NRS's dashboard. Put Mixpost's analytics under the Social department's Analytics tab where it belongs | **S6** |
| Account selector row | a `w-12 h-12` ChartBar button for cross-platform **Summary**, then one avatar per account with `support_analytics` | `listAccounts` + `getAllAccountsHealth().accounts[].canFetchAnalytics` | **ABSENT** | Build | **S6** |
| Metric tabs | server-supplied: overview, engagement, audience, reach, video, content, hashtags, insights, competitors, search_terms, reviews | `analytics.getAnalytics({query:{profileId, fromDate, toDate, sortBy, postId?}})` → `{overview:{totalPosts, publishedPosts, scheduledPosts, lastSync, dataStaleness}, posts:[{_id, content, publishedAt, analytics, platforms, platformPostUrl, isExternal, thumbnailUrl, mediaType, mediaItems}], pagination, accounts, hasAnalyticsAccess}`; `sortBy` ∈ date\|engagement\|impressions\|reach\|likes\|comments\|shares\|saves\|clicks\|views\|follows; max 366-day range. Plus 15 platform-native insight calls (IG account insights / follower history / demographics, YouTube channel / daily-views / retention / demographics, FB page insights / post earnings / reactions, TikTok account insights, LinkedIn aggregate / org-aggregate / post analytics / reactions, GMB performance + search keywords) | **COSMETIC** — metric cards are real; **every timeseries chart and top-posts table can never render** because all three sources in `platform-metrics.ts:121-122, 204-205, 259-260` return `timeseries: {}` and `topPosts: []` as literals, and `PlatformReportShell.tsx:115-121,199` filters to "only those that have data", which is always none. Ten report components, 40 lines each, showing nothing | Fill from `getAnalytics` + `getDailyMetrics`. **Note the live `daily-metrics` response carries a per-day `platformMetrics:{instagram:{impressions,reach,likes,comments,shares,saves,clicks,views,postCount}}` that the SDK's `GetDailyMetricsResponse` type omits — `parseDailyMetrics` (`client.ts:193-226`) drops it. Trust the SDK for the request; introspect the live response for fields** | **S6** |
| Period picker + syncing progress | `AnalyticsPeriodPicker`; `AnalyticsSyncingProgress` polls every 10s while `initial_analytics_status === 0` | `overview.dataStaleness`, `lastSync`; `analytics.syncExternalPosts({body:{accountId, url?, postId?}})` pulls a post published outside NRS into the store | **ABSENT** | Build both | **S6** |
| Best time to post | **Mixpost has none** | `analytics.getBestTimeToPost({query:{profileId, accountId?, platform?, source?}})` → `{slots:[{day_of_week (0=Monday), hour (UTC), avg_engagement, post_count}]}`. **Live and populated** for Scent Sell: top slot Monday 09:00 UTC, 124.7 avg engagement over 3 posts | **ABSENT** | **Upside.** Feed it into the composer's "Add to next free time" and the schedule grid | **S6** |
| Content decay | none | `analytics.getContentDecay()` → `{buckets:[{bucket_order, bucket_label:'0-6h'…'7-30d', avg_pct_of_final, post_count}]}`. Live and populated | **ABSENT** | **Upside** | **S6** |
| Posting frequency | none | `analytics.getPostingFrequency()` → `{frequency:[{platform, posts_per_week, avg_engagement_rate, avg_engagement, weeks_count}]}`. Live and populated — it answers *"how often should we post"* with this brand's own data | **ABSENT** | **Upside** | **S6** |
| Follower history | none | `accounts.getFollowerStats()` → `{accounts[], stats:{[accountId]:[{date,followers}]}, dateRange, granularity}` | **ABSENT** | **Upside** | **S6** |

### I. Engagement — where Zernio is far ahead

| Mixpost feature | What it does | Zernio operation(s) | NRS today | Action | Slice |
|---|---|---|---|---|---|
| Inbox / Engagement (Beta) | three columns — `ConversationList` (tabs, counts, filter groups, sentiment) · `ConversationThread` (reply, set status, like, mark unread) · `AuthorPanel`; plus an AI settings modal. 18 components | 15 `messages` ops. `listInboxConversations` rows carry `unreadCount`, `status:'active'\|'archived'`, `url`, `instagramProfile{isFollower,isFollowing,followerCount,isVerified}`, and a `metadata` block of Meta click attribution (`ctwa_*`, `meta_ad_*`) that **identifies which ad a DM came from** | **PARTIAL, hand-rolled** — 3 ops by raw fetch (`inbox/route.ts:74,118,167`, `zernio-reply.ts:24`). List rows do not carry direction, which is why `/api/inbox` does N+1 calls; **`unreadCount` is the cheaper proxy it is not using** | Rebuild on the SDK: `searchInboxConversations`, `getInboxConversation`, `updateInboxConversation` (archive), `markConversationRead`, `editInboxMessage`, `deleteInboxMessage`, `addMessageReaction`. Surface the ad attribution as "this message came from your ad" | **S6** |
| Comments moderation | Mixpost has no comment moderation at all | **13 ops, zero wrapped**, and live `GET /v1/inbox/comments?limit=2` returns real Scent Sell Facebook/Instagram rows **right now**. `comments.listInboxComments({query:{profileId, platform, since, minComments, sortBy:'date'\|'comments', cursor, limit}})` → rows `{id, platform, accountId, accountUsername, content, picture, permalink, createdTime, commentCount, likeCount, isAd, adId, placement}` + `meta.failedAccounts[{error,code,retryAfter}]`. `getInboxPostComments({path:{postId}, query:{accountId, cursor, limit, commentId?}})`. `replyToInboxPost({path:{postId}, body:{accountId, message, commentId?}})`. `hideInboxComment`/`unhide`, `like`/`unlike`, `deleteInboxComment`, `editInboxComment`, `setCommentModeration`, `sendPrivateReplyToComment({path:{commentId, postId}, body:{accountId, message, buttons?}})` — the comment-to-DM move | **ABSENT** | **The single biggest upside in the whole ask.** For four AHPRA/TGA brands, an unmoderated comment under a health post is a compliance exposure NRS currently cannot even see. **Every outbound reply passes `publish-gate.ts`** | **S6** |
| Mentions | none | `mentions.listInboxMentions({query:{profileId, accountId, cursor, limit, sortOrder}})` — `platform` is typed literally `'linkedin'`, so mention listing is **LinkedIn-only** today. `mentions.replyToMention({body:{accountId, mediaId, commentId?, message}})` is **Instagram-only** | **ABSENT** | Build, and label it honestly as LinkedIn | **S6** |
| Reviews | none | `reviews.listInboxReviews`, `replyToInboxReview`, `deleteInboxReviewReply`; duplicated on accounts as `getGoogleBusinessReviews`, `batchGet…`, `replyTo…`. Live: reachable and empty — `{status:'success', data:[], meta:{accountsQueried:3, accountsFailed:0}, summary:{totalReviews:0, averageRating:null}}` | **ABSENT** | Build. A Google review reply from a health brand **must** pass `publish-gate.ts` | **S6** |
| Inbox analytics | none | 7 ops. `getInboxVolume({query:{fromDate (required), accountId, platform, profileId, source}})` where `source` ∈ human\|workflow\|sequence\|broadcast\|comment_automation\|api\|contact\|platform — **so you can measure what the Director answered vs what a human did**. `getInboxResponseTime` → `{summary:{sampleSize, medianSeconds, p90Seconds, p99Seconds, meanSeconds, fastest, slowest}, histogram:[{bucket:'0-1m'…'1d+', count}]}` — a ready-made SLA report. Plus heatmap, source breakdown, top accounts, per-conversation analytics. **Every one requires `fromDate`** | **ABSENT** | Surface response time as "how fast you reply" | **S6** |

### J. Deliberately not built

| Capability | Why not |
|---|---|
| **Workflows (14 ops), sequences (10), comment automations (6)** | This is where Build-First bites hardest. All three are **outbound message automation with no AHPRA/TGA gate**. Routing them through Zernio puts a regulated health brand's outbound copy behind a third party's rules engine instead of `publish-gate.ts`. Live, all three are empty. **Read the logs; keep the rules.** |
| **Post recycling** (`recycling: RecyclingConfig` with `contentVariations[]`, `gap`, `gapFreq`, `expireCount`) | Recycling republishes copy **without passing back through `publish-gate.ts`**. Enabling it delegates a compliance decision to Zernio. Revisit only with an owner decision on record. |
| **Blogs (10 ops)** | `Blog.platform` is the literal `'shopify'`; every path is nested under an account. Live-confirmed: `GET /v1/accounts/{igAccountId}/blogs` → 400 *"Account platform 'instagram' does not support blogs. Supported: shopify."* No brand has Shopify connected. Inert, and no substitute for NRS blogging. |
| **WhatsApp / SMS / voice / calling / phone numbers (~130 ops)** | Out of product scope. |
| **The 110-op `ads` alias layer** beyond the two already used | Ads are their own department. |
| **Mixpost's Brand Voice page** | NRS already owns brand voice; duplicating it splits the source of truth. |
| **Webhooks UI** | Developer plumbing in front of a non-technical owner. |
| **Mixpost's two-pane composer** | `.mockups/dept-social.html` and DESIGN.md lock a single scrolling column. DESIGN.md is the authority on shape. |

### K. What stays on the self-hosted fallback

`publishToPlatform()` (`dispatcher.ts`) chooses **Zernio** when the brand has a `zernio_profile_id` **and** a matching Zernio account, else native, else self-hosted **Mixpost** — which is what Justin's own brands run on, so it stays exercised daily and is a genuine fallback rather than a dusty one. Nothing in this plan changes that order.

Reads still unconditionally on the fallback after these six slices, listed so nobody thinks they were missed: `api/cron/monitor-alerts/route.ts:50`, `lib/agents/performance-learner.ts:114`, `lib/agents/tools/get-brand-kit.ts:176`, `lib/agents/tools/query-social-analytics.ts:122`, `lib/mixpost/sync-draft.ts:524`, `api/brands/[brandId]/mixpost-accounts/route.ts:42`, `components/agency/settings/integrations-data.ts:279`. These are Director-tool and cron paths, not the Social desk. `fetchMixpostPosts`, `fetchMixpostMedia`, `fetchMixpostTags` and `fetchMixpostTemplates` have **no front-end caller at all** — Mixpost tags and templates have no user-facing surface whatsoever.

---

## Two things that must be fixed before any slice lands

1. **The working tree is red and would fail the Vercel production build.** `src/lib/desk/desk-ui-contract.test.ts:2` asserts `PostCreator.tsx` matches `/Canva/`; an uncommitted edit deleted the Canva button. `scripts/vercel-production-build.mjs:21-29` runs `npm test` before `npm run build` whenever `VERCEL_ENV === 'production'`, and `vercel.json:3` wires that as the build command. Slice 3 owns both files and resolves it.
2. **`brand-theme.ts` violates DESIGN.md's own retint rule.** `brandActionVarsFromPrimary()` takes `deepL = clampL(primary.l)` **straight from the stored colour** — the pale-brand-unreadable-button failure DESIGN.md:143-172 exists to prevent — and `brandSurfaceVarsFromBackground()` overwrites `--panel`, `--line`, `--ink`, `--ink-2`, `--ink-3` from the brand's stored background, where DESIGN.md:130-137 says the house chrome *"does not retint with the business. They are the silver furniture."* Both fire whenever a brand has a stored background, and when they do `accentDark` is forced false so dark mode is bypassed too. `--care` is untouched by both, so the care-vs-brand separation still holds. This appears to come from `ba84379` ("paint the signed-in desk as paper, then brand") and **DESIGN.md carries no decision-log entry for it**. Not folded into a slice: it is an owner decision about whether the paper retint was approved, not a bug to fix quietly.

---

## Slice map

Six slices, disjoint file sets, foundations first. No two slices name the same file. Later slices **read** Slice 1's service layer; none of them edit it.

| Slice | Owns | Depends on |
|---|---|---|
| **S1 — Zernio service layer + publishing engine** | `src/lib/zernio/*` (except `account-scoping.test.ts`), `zernio-platform-data.ts`, `dispatcher.ts`, `capabilities.ts`, the Zernio webhook | — |
| **S2 — Department shell** | sidebar, chrome, tab strip, action-bar slot, counts, OAuth redirects | S1 (types) |
| **S3 — Composer** | `studio/post/*`, `studio/preview/*`, compose routes, validation route | S1 |
| **S4 — Posts, calendar, schedule** | `studio/posts/*`, calendar, `posting-schedule/*`, post APIs, labels | S1, S2 |
| **S5 — Media, accounts, templates** | media library, accounts, templates, stock routes | S1, S2 |
| **S6 — Engagement + analytics** | inbox, comments, mentions, reviews, analytics reports | S1, S2 |

Ordering: **S1 → S2 → {S3, S4, S5, S6 in parallel}**.

---

## Slices in detail

Every slice below names a **disjoint** file set — 186 files across six slices, verified with no overlap. Later slices import from Slice 1; they must not edit it. Nothing edits `src/lib/zernio/account-scoping.test.ts`, `src/lib/posts/create-draft.ts`, `src/lib/agents/publish-gate.ts` or `src/lib/agents/save-gate.ts`.

Client construction everywhere: `new Zernio({ apiKey: process.env.ZERNIO_API_KEY })`, server-side only. Every SDK call returns `{ data, error }` — read `error` before `data`. Records carry `_id`, except inbox and contacts projections which carry `id`; accept both.

### S1 — Zernio service layer and publishing engine (foundation)

**Goal.** One typed module per Zernio surface, so no route, component or tool ever builds a URL or guesses a shape again. Everything else in this plan imports from here.

**Exact calls.**

```ts
// src/lib/zernio/validate.ts
zernio.validate.validatePost({ body: {
  content, mediaItems,                              // MediaItem[] = {type,url,title,altText,filename,size,mimeType,thumbnail,instagramThumbnail}
  platforms: [{ platform, accountId?, customContent?, customMedia?, platformSpecificData? }],
}})  // -> { valid, errors:[{platform,error}], warnings:[{platform,warning}] }
zernio.validate.validatePostLength({ body: { text } })
     // -> { text, platforms: { twitter:{count,limit,valid}, twitterPremium, instagram, threads,
     //      facebook, linkedin, tiktok, youtube, bluesky, reddit, pinterest, telegram,
     //      telegramCaption, snapchat, googlebusiness } }
zernio.validate.validateMedia({ body: { url } })
     // -> { valid, contentType, size, sizeFormatted, type, platformLimits:{[k]:{limit,withinLimit}} }
zernio.validate.validateSubreddit({ query: { name, accountId? } })

// src/lib/zernio/posts.ts
zernio.posts.updatePost({ path:{postId}, body:{ content?, platforms?, scheduledFor?, isDraft?, mediaItems? } })
     // A <platform>Settings namespace OMITTED is preserved; SENT replaces the whole namespace. Not deep-merged.
zernio.posts.deletePost({ path:{postId} })
zernio.posts.retryPost({ path:{postId} })
zernio.posts.unpublishPost({ path:{postId}, body:{ platform:
  'threads'|'facebook'|'twitter'|'linkedin'|'youtube'|'pinterest'|'reddit'|'bluesky'|'googlebusiness'|'telegram' }})
zernio.posts.editPost({ path:{postId}, body:{ platform:'twitter'|'discord'|'facebook'|'reddit', content } })
zernio.posts.updatePostMetadata({ path:{postId}, body:{ platform:'youtube', videoId?, accountId?, title?,
  description?, tags?, categoryId?, privacyStatus?, thumbnailUrl?, madeForKids?, playlistId? } })
zernio.posts.listPosts({ query:{ profileId, source:'zernio'|'external', status, search, platform,
  dateFrom, dateTo, sortBy:'scheduled-desc'|'scheduled-asc'|'created-desc'|'created-asc'|'status'|'platform',
  page, limit } })   // ALWAYS set source. Default 'zernio' returns 0 rows on a brand with 210 published posts.

// src/lib/zernio/queue.ts
zernio.queue.listQueueSlots({ query:{ profileId, queueId?, all?:'true'|'false' } })  // -> {exists, schedule, nextSlots[]}
zernio.queue.createQueueSlot({ body:{ profileId, name, timezone /* IANA */, active,
  slots:[{ dayOfWeek: 0..6 /* Sun=0 */, time:'HH:mm' }] } })
zernio.queue.updateQueueSlot({ body:{ profileId, queueId, slots, setAsDefault?, reshuffleExisting? } })
zernio.queue.deleteQueueSlot({ query:{ profileId, queueId } })  // omit queueId and it deletes EVERY queue
zernio.queue.previewQueue({ query:{ profileId, count, queueId? } })
zernio.queue.getNextQueueSlot({ query:{ profileId, queueId? } })  // display only — never copy into scheduledFor

// src/lib/zernio/media.ts
zernio.media.getMediaPresignedUrl({ body:{ filename, contentType /* closed 20-value enum */, size } })
zernio.messages.uploadMediaDirect({ body:{ file, contentType? } })   // max 25 MB, filed under `messages`

// src/lib/zernio/accounts.ts
zernio.accounts.listAccounts({ query:{ profileId, status:'connected'|'disconnected', page, limit } })
     // page and limit MUST travel together or 400. Filter by profile in OUR code after normalisation regardless.
zernio.accounts.getAllAccountsHealth()
zernio.accounts.getAccountHealth({ path:{ accountId } })
zernio.accounts.getTikTokCreatorInfo({ path:{ accountId } })
zernio.accounts.getFollowerStats()

// src/lib/zernio/errors.ts
assertZernioJson(res)  // throws when content-type is text/html — a 200 HTML shell means a WRONG PATH, not success
```

**`createZernioPost` (in `client.ts`) gains three fields per platform** — the headline change:

```ts
platforms: accounts.map(a => ({
  platform: a.platform,
  accountId: a.accountId,
  ...(a.customContent  ? { customContent: a.customContent } : {}),   // per-platform text override
  ...(a.customMedia    ? { customMedia: a.customMedia }     : {}),   // per-platform media swap
  ...(a.scheduledFor   ? { scheduledFor: a.scheduledFor }   : {}),   // stagger across networks
  ...(a.platformSpecificData ? { platformSpecificData: a.platformSpecificData } : {}),
})),
metadata: { nrsScheduledPostId },   // free-text bag — stamp our id for reconciliation
```

Leave the `x-request-id` idempotency header exactly as it is (`client.ts:112,151-154`) — that one is already right.

**Webhook events to add** to `scripts/register-zernio-webhook.ts` (7 subscribed of 47 available): `post.scheduled`, `post.cancelled`, `post.platform.published`, `post.platform.failed`, `post.platform.deleted`, `post.external.created`, `post.external.updated`, `review.new`, `conversation.started`. Then `webhooks/zernio/route.ts` writes `post_activity` rows the way the fallback handler already does at `webhooks/mixpost/route.ts:147,177,218`.

**Acceptance.** `npm test` green including `account-scoping.test.ts` untouched; a new test proves a `200 text/html` response throws; a new test proves `listPosts` without an explicit `source` is rejected by our wrapper; a per-platform `customContent` reaches the `createPost` body.

### S2 — Department shell: sidebar, tabs, action-bar slot

**Goal.** Mixpost's navigational clarity — which DESIGN.md says is the thing that was adopted — at NRS's locked measurements.

Sidebar stays **236px** (DESIGN.md, not Mixpost's 240px). Header `padding: 20px 26px 0`, tab strip nested inside it at `margin-top: 14px` with the hairline inset 26px, pane `18px 26px 26px` as the only scroller, action bar a `flex-shrink: 0` sibling pinned last — not the 24/12 the chrome currently uses, and not a `container mx-auto max-w-7xl`. Add the Engagement child and tab. Give every tab its leading icon (`DepartmentTabs.tsx:36,171-175` already reserves the box). Badges follow DESIGN.md's rule: **attention = queue, quiet = inventory** — so "Waiting on you" is attention, and Posts/Media/Templates carry quiet inventory counts. Delete the `accounts`/`waiting` entries from the rendered tab list or give them tabs; do not leave an `aria-labelledby` pointing at a button that does not exist. Header copy comes from the mockup, not from a brand-interpolated label.

**Zernio calls** (all through S1): `zernio.accounts.listAccounts({query:{profileId,status:'connected'}})` for the business subtitle; `zernio.posts.listPosts({query:{profileId,source:'external',status:'published',page:1,limit:1}})` for the published inventory count; NRS `scheduled_posts` for the waiting count.

**Acceptance.** Every Social URL keeps the chrome. No `/agency/studio/*` redirect survives a `grep -rn "agency/studio" src/app/api`. Sidebar badges render. A test asserts the tab id union and the rendered tab array agree.

### S3 — Composer

**Goal.** Mixpost's compose *capability* inside NRS's locked single-column shape.

Per-account avatar strip replacing the six platform pills, with X and LinkedIn disabled for multi-account selection (Mixpost's `simultaneousPosting(false)`). Per-account version tabs on top of the existing per-platform ones, delivering through `customContent`. Thread and first-comment items (`threadItems[]` for Twitter/Threads/Bluesky; `firstComment` for Instagram/Facebook/LinkedIn/YouTube). Provider option panels widened from 12 mapped keys to the 15 available unions. Character limits and validation from Zernio, not local tables. 300ms debounced autosave through `createDraftPost()` with a lime/red saved dot. Delete the eight orphaned components (~1,098 lines, 17% of the directory) and `PostCreator`'s own dead code. Fix the transport-honesty gap by calling `publisherTransportOf`.

**Zernio calls** (through S1): `validatePost`, `validatePostLength`, `validateMedia`, `getTikTokCreatorInfo`, `getBestTimeToPost` (for "Add to next free time"), `previewQueue`.

**Acceptance.** `npm test` green — including `desk-ui-contract.test.ts`, which is red on the current working tree and blocks the production build. Two Instagram accounts on one post can carry different words. A field the active transport cannot deliver is never rendered as a live input. `npm run build` passes.

### S4 — Posts list, calendar, posting schedule

**Goal.** Mixpost's Posts page, column for column.

Seven columns, seven conditional tabs, the six status dots plus `partial`, the row preview modal, the per-row dropdown with Retry and the three-way delete, working bulk actions, the shared label/account filter, NRS-owned labels with coloured calendar stripes. Keep drag-to-reschedule, which Mixpost cannot do. Back the posting-schedule grid with Zernio's real queue instead of the dead `assignToSlot`.

**Zernio calls** (through S1): `listPosts({source:'external'|'zernio', status, search, page, limit, sortBy})`, `updatePost({scheduledFor})`, `deletePost`, `retryPost`, `unpublishPost({body:{platform}})`, `getAnalytics({query:{postId}})` for external rows (`getPost` 404s on them), all six `queue.*`, and `createPost({queuedFromProfile, queueId})` for Add to queue.

**Acceptance.** A brand with 210 externally published posts shows 210. Selecting rows and pressing Duplicate creates drafts and says so. Deleting from the platform actually removes the live post. The calendar chips filter or are gone.

### S5 — Media library, accounts, templates

**Goal.** Mixpost's four media tabs, its accounts grid with real health, and templates that do not eject the owner.

Fourth media tab is Canva (NRS already integrates it) where Mixpost has Adobe Express. Alt text, video thumbnails and Instagram reel covers reach the wire. Accounts show **real** health instead of the hard-coded `status:'active'` at `useSocialAccounts.ts:70-86` — two accounts are in warning right now and the desk says everything is fine. The add-account tile leads the grid. `/agency/social/templates/[templateId]` exists. `account_entities` either injects at compose time or the promise at `AccountsPage.tsx:51-53` comes out. Client-side account fetches get a brandId.

**Zernio calls** (through S1): `getAllAccountsHealth()`, `getAccountHealth({path:{accountId}})`, `listAccounts({query:{profileId,status}})`, `updateAccount`, `deleteAccount`, `getMediaPresignedUrl`, `validateMedia({body:{url}})` for per-platform byte limits at upload time.

**Acceptance.** An expiring token shows as "needs reconnecting" before it fails a publish. No user-facing string names a vendor. Templates round-trip inside the Social chrome.

### S6 — Engagement and analytics

**Goal.** The surface Mixpost charges for and NRS is not using at all, plus analytics that currently render nothing.

Comments moderation is the headline: `listInboxComments` returns real Scent Sell Facebook and Instagram rows on the live account **today**, and for four AHPRA/TGA brands an unmoderated comment under a health post is a compliance exposure NRS cannot currently see. Every outbound reply — comment, DM, mention, review — passes `publish-gate.ts`. Then fill the ten analytics report components that can never render because `platform-metrics.ts:121-122,204-205,259-260` returns `{}` and `[]` as literals, and add best-time-to-post, content decay, posting frequency and follower history, none of which Mixpost has.

**Exact calls.**

```ts
zernio.comments.listInboxComments({ query:{ profileId, platform, since, minComments,
  sortBy:'date'|'comments', sortOrder, cursor, limit } })
zernio.comments.getInboxPostComments({ path:{ postId }, query:{ accountId, cursor, limit, commentId? } })
zernio.comments.replyToInboxPost({ path:{ postId }, body:{ accountId, message, commentId? } })
zernio.comments.hideInboxComment / unhideInboxComment / deleteInboxComment / likeInboxComment
zernio.comments.sendPrivateReplyToComment({ path:{ commentId, postId },
  body:{ accountId, message, buttons? } })   // quick-reply chips do NOT render in the IG Message Requests
                                             // folder where cold DMs land — use buttons there
zernio.mentions.listInboxMentions({ query:{ profileId, accountId, cursor, limit, sortOrder } })  // LinkedIn only
zernio.reviews.listInboxReviews({ query:{ profileId, accountId } })
zernio.reviews.replyToInboxReview({ path:{ reviewId }, body:{ accountId, message } })
zernio.messages.searchInboxConversations / getInboxConversation / updateInboxConversation
             / markConversationRead / sendInboxMessage
zernio.analytics.getAnalytics({ query:{ profileId, fromDate, toDate, sortBy, page, limit } })  // max 366 days
zernio.analytics.getBestTimeToPost({ query:{ profileId, accountId?, platform?, source? } })
zernio.analytics.getContentDecay({ query:{ profileId } })
zernio.analytics.getPostingFrequency({ query:{ profileId } })
zernio.analytics.getPostTimeline({ query:{ postId, fromDate, toDate } })   // accepts EXTERNAL _ids
zernio.analytics.syncExternalPosts({ body:{ accountId, url?, postId? } })
zernio.accounts.getFollowerStats()
zernio.inboxanalytics.getInboxResponseTime({ query:{ fromDate, toDate, profileId } })  // fromDate REQUIRED
zernio.inboxanalytics.getInboxVolume({ query:{ fromDate, toDate, profileId, source } })
```

Read `platformMetrics` off the live `daily-metrics` response even though `GetDailyMetricsResponse` omits it, and `follows` off `post-timeline` for the same reason. Drop the N+1 in `/api/inbox` by using `unreadCount` from the list rows.

**Acceptance.** A new comment on a health brand's post appears on the desk, and a reply to it is refused when it breaches AHPRA/TGA. Every analytics chart that renders a frame renders data or an honest empty state — never an invisible chart filtered out by `PlatformReportShell.tsx:115-121`.
