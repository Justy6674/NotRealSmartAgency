# Plan: make the Social desk honest, then make the Director drive it

Owner: Justin (non-technical). Author: Claude. Started 2026-08-18 from HEAD `6547f0e`.
**This file lives in the repo on purpose.** The previous three attempts kept their
plans in hidden folders the owner could not open. He asked "where is the plan" four
times in one day. Tick the boxes here as things land.

## The rule that governs this plan

Three attempts (Claude, Codex, Cursor) each began a large rebuild, reached halfway,
ran out of room and wrote a handover. Nothing landed. So: **one landable unit at a
time, each verified live before the next starts.** If a unit cannot land, stop and
write why in this file rather than pressing on.

Owner rule, 2026-08-18: *"we must always be up to date and current, and adapt to
versions ALWAYS."* Being behind breaks things and costs money.

Owner rule, 2026-08-18: the desk being unusable to the person who uses it daily is a
first-class fault, not cosmetics. An outside review called the visual work a "vanity
sink"; the owner overruled it. He is the user.

For this work DESIGN.md wins on the desk: buttons do the work; the Director is an
extra pair of hands. CLAUDE.md's "Director is the only face" does not override that.

---

## Job A — Stop production accepting broken code  ☑

Done 2026-08-18. Quality detectors follow `publishTickedAccounts`. Vercel
production runs the test suite before `next build` and skips a SHA whose
Quality check already failed. Live `publisher_runs` on `uyhtrwlotoriblicqqrl`
already has `brand_id`, `account_id`, `idempotency_key`; `lock_scheduled_post`
exists (fake id returns `scheduled_post not found`). No live migration needed.
Branch protection on `main` was **not** turned on — it would block push-to-main.
The deploy gate is the protection.

**This is the root cause and it goes first.** `main` has no branch protection. The
quality check (`npm test`, `lint`, `build`) has been **red on 14 consecutive pushes**
from `bd1d307` (17 Aug 09:21) through `6547f0e` (18 Aug 01:57). Every one deployed.
Five of the last thirteen production deploys failed to build. The 46 runs before that
window were green.

Every other job in this plan is decoration until this is true: a red check cannot ship.

- [ ] A1. Branch protection on `main` requiring the `Quality` check to pass.
- [ ] A2. Vercel Ignored Build Step fails the production build when the check is red.
- [ ] A3. **Read-only** check against live Supabase: does `publisher_runs` actually
      have `brand_id`, `account_id`, `idempotency_key`, and does `lock_scheduled_post`
      exist? Migration `20260818000000_zernio_publisher_spine.sql` was committed on
      17 Aug but committing is not applying, and nothing in CI or Vercel applies it.
      **If unapplied, every publish failure is silent by construction:** the lock RPC
      error is swallowed, `successfulAccountIds` discards its error and returns empty
      so every cron retry re-publishes to every ticked account (every 5 minutes), and
      `logRun` is rejected so **no audit row is written for any publish at all**.
      For four AHPRA/TGA brands, an absent audit trail plus possible duplicate
      advertising is worse than any red test. Applying it needs Justin's explicit yes.

**Exit:** a deliberately broken commit is refused by production. A3 answered either way.

---

## Job B — Stop the app offering controls it ignores  ☑

Done 2026-08-18. Inventory lives in `src/lib/publishers/zernio-platform-data.ts`
(`COMPOSER_FIELDS`). Compose shows Account options for every ticked network.
A switch the pipe cannot send is shown as off, with the reason in plain English.
Mastodon / Pinterest / Threads / Bluesky say they are not on the publishing list.

## Job D — Make the owner's choices reach the platform  ☑

Done 2026-08-18 in code. Cron and Publish now both put `post_type` and
`platform_options` on the request. `createZernioPost` sends SDK
`platformSpecificData`. Idempotency is `${scheduledPostId}:${accountId}`.
Unsent results are `publisher: 'unsent'`. `publisher_runs.request_payload`
records caption, media count, options chosen, and the payload sent.

**Live proof still needs you:** one controlled Scent Sell post, with the
platform URL and the setting visible on the live post. This run did not
publish to a live account.

## Job E — One colour system on the Social desk  ☑

Done 2026-08-18. `[data-nrs-shell]` aliases `--background/--card/--muted/--border`
to `--bg/--panel/--panel-2/--line`. Social analytics no longer says "Connect Mixpost".
The command-bus migration file is **not applied** to live Supabase.

The owner's actual complaint is "it tells me it did something it didn't do." This job
is the direct answer, it carries no live-publish risk, and it needs no migration.

- [ ] B1. Inventory table: every control in the composer, what reads it, and what
      happens to it — ships / disabled with a plain-English reason / deleted.
- [ ] B2. Apply it. A control the pipeline cannot deliver is removed or visibly
      disabled saying why. No silent no-ops.

**Exit:** every switch on the Compose screen either works or says why it doesn't.

---

## Job C — Turn the alarms back on  ☐

Corrected diagnosis. These are **not** "stale detectors" as first written. All four
tracked guardrail tests passed at `f2d9aac`, 39/39. They went red at `bd1d307`/`b02859a`
when `publishTickedAccounts` was introduced and the direct `publishToPlatform(` call
the greps look for moved behind a helper. That is a regression, correctly detected,
then ignored through fourteen more deploys.

The runtime gates themselves are intact — `checkPublishAllowed` still sits ahead of
the send, and the test asserting that still passes. What is red are the detectors that
would tell you if someone removed them.

- [ ] C1. `auth-coverage.test.ts` — teach it `verifyZernioWebhook` is a real mechanism.
      Verified: that route is properly fail-closed (503 with no secret, 401 on a bad
      signature, HMAC with `timingSafeEqual`).
- [ ] C2. `compliance-filter.test.ts` + `regulatory-invariants.test.ts` — follow the
      one level of indirection to `publishTickedAccounts`. Because this *relaxes* the
      detector in the dimension that just failed, it only lands together with Job A.
- [ ] C3. `select-columns.test.ts` — fix the from()/select() pairing. It reports a
      phantom `scheduled_posts.social_urls` for a select that is on `brands`.
- [ ] C4. Runtime publish freeze: while any publish-gate or save-gate test is red,
      publishing for the four regulated brands fails closed, not just in CI.

**Exit:** `npm test` green. Each guard proven non-vacuous by a deliberate temporary
violation that makes it fail, then reverted.

---

## Job D — Make the owner's choices reach the platform  ☐

- [ ] D1. Cron and publish-now build identical requests. Cron never reads
      `metadata.platform_options`; publish-now does. Honest scope: this is an
      anti-drift fix, **not** delivery of the settings — both paths currently discard
      most of them downstream anyway.
- [ ] D2. `post_type` at the top level in cron, not nested in `metadata` where the
      dispatcher never reads it. Scheduled vertical video publishes pillarboxed today.
      This exact incident is already written up in `types.ts:180-188`.
- [ ] D3. The two dishonest receipts: `publish-ticked.ts:45-60` reports
      `publisher: 'zernio'` on paused/no-tick paths regardless of the real transport,
      and `:86` sets a fresh `idempotency_key` per attempt, defeating the unique index
      meant to stop double-posting.
- [ ] D4. Actually deliver the settings — widen `buildPlatformOptions`. Field names
      come from `node_modules/@zernio/node/dist/index.d.ts`, never from memory.
- [ ] D5. Evidence record. Every publish writes a row the owner can read: brand,
      platform, account, settings chosen, payload sent, platform URL and post id.
      This replaces "I checked and it works."

**Cut from this job, with reasons:**
- ~~TikTok privacy hardcoded to `SELF_ONLY`~~ — **my error.** `NATIVE_PUBLISHERS`
  registers only `linkedin`; nothing imports `publishers/tiktok.ts`. That code cannot
  run. Delete the four unreachable native publishers instead (~1,000 lines, and four
  platform API version pins leave the compliance surface for free).
- ~~Send `platforms[].customContent` to Zernio~~ — `dispatcher.ts:475-484` already
  contains a reasoned refusal. Do not overturn a comment that records an incident
  without arguing with it.

**Exit:** one controlled real post **on Scent Sell first** (non-regulated, already has
a Zernio profile), with the platform URL and the setting proven applied. No regulated
brand until Job A3 is answered.

---

## Job E — One colour system on the Social desk  ☐

Owner's call, kept against outside advice. Re-measured honestly: **148 files** in the
`/agency/social` import closure, **56 (37.8%)** carrying dark shadcn tokens, 623
occurrences over 458 lines, **177** bare `border` utilities. (My first numbers — 117 /
59 / 634 / 368 — were wrong. Corrected.)

Root cause confirmed: `brandThemeVars()` emits `--bg/--panel/--panel-2/--line/--ink*`
and never `--card/--muted/--muted-foreground/--border/--background`, so those keep
their dark values. `globals.css:136-138` applies `border-border` to every element.
`ThemeProvider` is `defaultTheme="dark"`, so **the collision fires by default**, not
only for someone who toggled.

- [ ] E1. Fix the mechanism, not 56 files by hand. Redefine the shadcn surface tokens
      at brand-paper scope. Note the blast radius: that scope changes both themes.
- [ ] E2. Sweep what the token fix cannot reach — hardcoded colours, and the
      DepartmentTabs / AccountsPage ternaries that mix both systems in one string.
- [ ] E3. Use the `impeccable` craft skill. Verify against DESIGN.md.

**Sequencing caveat:** six of the nine Social routes still read from Mixpost while
writes go to Zernio, so they can display "no posts" while posts are live. Recolouring
a screen showing wrong data is polish on a lie. Either fix the read path first, or do
E on compose and media only and defer the rest. **Owner's call.**

---

## Job F — The Director actually drives the desk  ☑

Done 2026-08-18. `fill_compose_desk` puts caption, media, accounts, title, first
comment, privacy and time on Compose. The same reducer is the door for Director
fills and Account options. Undo sits above Save. `pendingCaptionApply` is gone.
The social_compositions migration is **not applied** to live Supabase.

**Asked for by the owner, 2026-08-18.** This is the product. It was parked; it is back.

What works today: `propose_post` takes selected media and returns a hook, caption,
hashtags, post type and rationale, and genuinely iterates on feedback. `manage_posts`
can create, edit, schedule, approve, cancel and delete drafts.

What does not: the only things the Director can put on the Compose screen are caption,
hashtags and platforms, via a one-way one-shot bridge (`pendingCaptionApply`). It
cannot place media, choose accounts, set a title, cover, first comment or schedule,
and it cannot change anything already on screen.

- [ ] F1. Typed action set covering everything on the desk, from the real Zernio
      contract.
- [ ] F2. One path for both the Director and the buttons, so a manual change and a
      Director change go through the same door with the same checks.
- [ ] F3. The Director asks for what is missing instead of guessing, in plain
      language, and never names a department or a vendor.
- [ ] F4. Undo, and a receipt for every change.
- [ ] F5. Retire the `pendingCaptionApply` bridge. Do not leave a second path.

Seven files of prior work on this are preserved at
`~/.gstack/projects/Justy6674-NotRealSmartAgency/preserved-slice1-social/` with a
written list of eight known defects. Read that before rebuilding. They were moved out
of `src/` because they broke `npm run build` outright.

---

## Job G — Stay current  ☐

Audited 2026-08-18 against live sources.

- [x] G1. `@zernio/node` 0.2.580 → 0.2.587, `@supabase/supabase-js` 2.99.3 → 2.112.3,
      `zod` 4.3.6 → 4.4.3. Build, lint and tests verified unchanged.
- [ ] G2. **Meta Graph v21.0 → v26.0. Hard deadline: v21.0 is switched off on
      21 January 2027.** On that date Facebook and Instagram publishing stops for all
      eight brands. Read the changelog for every breaking change between v21 and v26.
- [ ] G3. LinkedIn — verify against a live call first. Calls go to `/v2/` (unversioned
      legacy) so the `LinkedIn-Version: 202401` header may be inert. Do not change blind.
- [ ] G4. `ai` v6 → v7, `next` 15 → 16, `stripe` 20 → 22. Each its own unit with its
      own verification, after Jobs A–F. Sequenced, not skipped.
- [ ] G5. Replace the truncated Zernio corpus in `~/Obsidian/Reference/`. It is cut
      off mid-word at 1,001,597 bytes and is labelled as complete. Source hierarchy:
      1. `node_modules/@zernio/node/dist/index.d.ts` (1.31 MB) — **the contract**
      2. github.com/zernio-dev/zernio-node, /openapi-specs
      3. the official `zernio-api` Claude skill — 9.4 KB, and `customContent` appears
         **zero times** in its `posts.md` and `platforms.md`. A convenience, never
         the contract.

---

## Job H — Settle the contradiction that keeps sending AIs in circles  ☐

`CLAUDE.md` (committed): *"Conversation-first, never form-first. The Director is the
only face. Departments are invisible."*
`DESIGN.md` (committed `50cc332`, 17 Aug): *"Conversation is optional. Buttons do the
work."* `nav-sections.ts`: twelve flat sections, 19 `/agency/*` routes.

Neither is marked superseded. Every AI that reads both diverges. One commit, a dated
line saying which wins.

---

## Not in scope

Analytics, inbox, ads, calendar and templates beyond what Job E touches. The Mixpost
read-path migration unless pulled in ahead of Job E.
