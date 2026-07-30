# Options: The Interface, and Where Publishing Lives

You are running 11 businesses through NRS, and there is no single screen that shows you the state of all 11 — the app opens on a chat box scoped to whichever project you clicked last, and finding out what needs doing across the portfolio takes 23 clicks and 11 page loads. Separately, everything you publish currently goes through one rented server that is timing out on video uploads, and you have said you don't want that server any more.

Those are two problems, not one. This document treats them separately, because the interface can be fixed in days and the publishing move cannot.

---

## Section 1: The Interface

### Does NRS have a macro view today? No.

Not a weak one. Not a partial one. There is no screen anywhere in the product that shows more than one project's operational state at a time.

Here is what was checked and what was found:

| Screen | What it shows | Scope |
|---|---|---|
| `/agency` (the landing page) | Nothing — it redirects straight to chat | none |
| Director's Office (chat) | One project's conversation | 1 project |
| Creative Studio dashboard | The richest screen in the app — drafts, week ahead, failures, connections, strategy | 1 project |
| All 20 Studio sub-pages | Calendar, media, review, analytics, accounts, templates… | 1 project each |
| Command Centre → Tasks | Tasks across projects — but a flat list of 50, not grouped or counted | all projects |
| Command Centre → Approvals | Pending approvals — **but does not display which project each belongs to** | all projects |
| Command Centre → Costs | Spend by department, never by project | global |
| Activity feed | Raw event log, newest 100 | all projects |
| Brands page | All 11 projects — name, tagline, a status word, a "Regulated" pill | all projects |

The Brands page is the only screen that deliberately shows every project, and it carries no operational signal at all. It cannot tell you that ScentSell has drafts waiting, that TeleScribe hasn't posted in weeks, or that a Downscale post failed.

**The 23 clicks.** Land on `/agency` (bounces to chat, project 1). Click Creative Studio — that's 1 click to see project 1's real state. Every other project costs 2 clicks, because switching project in the sidebar forcibly throws you back to chat, so you have to click Studio again. That's 20 more. Then Tasks, then Approvals. Twenty-three clicks and eleven page loads to assemble in your head what should be one screen.

**Three specific things that make this worse than it sounds:**

1. **The logic already exists and runs 11 times a day in isolation.** There is a function inside the Studio dashboard that turns one project's data into exactly the list you want — "you haven't posted in N days", "N drafts waiting for review", "N posts failed to publish", "no strategy yet". It is deterministic, costs nothing to run, and is called once, for one project. Making it run for all 11 is a loop.

2. **There is a finished brand-switcher dropdown sitting in the codebase that nothing uses.** `src/components/agency/BrandSelector.tsx` is a complete, working, in-place project switcher that changes project *without* navigating away. Verified: nothing in the entire repo imports it. Wiring it into the header would cut the 23-click sweep to roughly 13 with no new code written.

3. **For a portfolio with seven AHPRA-flagged projects and two TGA-flagged ones, there is no screen anywhere that answers "which regulated project has unreviewed content right now".** The compliance signal stops at a badge on a card.

---

### The Macro Board

One screen at `/agency`, replacing the redirect. Two zones plus a status line.

The governing idea: your six questions split into two kinds of thing.

- **Events that need a decision from you** (broken, regulated-and-unreviewed, waiting on sign-off). These must be ranked against each other in **one** list, so you never have to read three lists and work out which is worse.
- **States that describe a project** (gaps, what's scheduled, what's suggested next). These belong on a per-project tile.

So: an **Attention Rail** on the left (ranked, capped at 8 rows) and a **Project Grid** on the right (all 11 projects, silent by default).

**The noise control is the whole design:** a project tile only gets colour if that project has a live item in the rail. On a normal day two tiles are coloured and nine are plain silver. Your eye lands where the work is.

#### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  3 things are broken · 2 waiting on you · 1 regulated post unreviewed        │
│  [Broken 3] [Waiting 2] [Unreviewed 1] [Out this week 14] [Gaps 6]           │  ← click a chip to filter
├───────────────────────────────┬──────────────────────────────────────────────┤
│  NEEDS YOU                    │  YOUR 11 PROJECTS                            │
│                               │                                              │
│ ┃ Downscale · AHPRA           │ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ ┃ A post about GLP-1 is       │ │▌Downscale│ │ScentSell │ │TeleScribe│      │
│ ┃ queued but was never        │ │ ● ● ○ ○  │ │ ● ● ● ○  │ │ ● ○ ○ ○  │      │
│ ┃ compliance-reviewed         │ │ Next 7: 3│ │ Next 7: 8│ │ Next 7: 0│      │
│ ┃ Goes out in 40 min          │ │ Review   │ │ Add pillar│ │ Nothing  │      │
│ ┃           [Review] [Hold]   │ │ the GLP-1│ │ for spring│ │ scheduled│      │
│ ├─────────────────────────────│ └──────────┘ └──────────┘ └──────────┘      │
│ ┃ ScentSell                   │ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ ┃ Instagram needs             │ │▌TeleCheck│ │NotRealSm.│ │EndorseMe │      │
│ ┃ reconnecting — nothing can  │ │ ● ● ○ ○  │ │ ● ● ● ●  │ │▌● ○ ○ ○  │      │
│ ┃ go out on it                │ │ Next 7: 1│ │ Next 7: 2│ │ Next 7: 0│      │
│ ┃              [Reconnect]    │ │ Connect  │ │ All good │ │ No socials│     │
│ ├─────────────────────────────│ └──────────┘ └──────────┘ └──────────┘      │
│ ┋ TeleScribe                  │ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ ┋ 3 drafts written, none      │ │Do Today  │ │Undergr.P.│ │Sniffopot.│      │
│ ┋ dated — going nowhere       │ │ ● ● ○ ○  │ │ ● ○ ○ ○  │ │ ● ○ ○ ○  │      │
│ ┋                [Read them]  │ │ Next 7: 0│ │ Next 7: 0│ │ Next 7: 0│      │
│ ├─────────────────────────────│ └──────────┘ └──────────┘ └──────────┘      │
│ ┋ Underground Parfums         │ ┌──────────┐ ┌──────────┐                   │
│ ┋ Approval waiting since      │ │▌Black H.I│ │▌TC Clinic│                   │
│ ┋ Tuesday                     │ │ ● ○ ○ ○  │ │ ● ● ○ ○  │                   │
│ ┋       [Approve]  [Hold]     │ │ Next 7: 0│ │ Next 7: 0│                   │
│ │                             │ └──────────┘ └──────────┘                   │
│ │  + 2 more                   │  ● = set   ○ = missing   ▌= regulated       │
├───────────────────────────────┴──────────────────────────────────────────────┤
│  GOING OUT THIS WEEK                                                         │
│  Wed        Thu        Fri        Sat        Sun        Mon        Tue       │
│  [SS·IG]    [DS·FB]    —          [SS·TT]    —          [SS·IG]    [TS·LI]   │
│  [SS·FB]    [DS·IG]               [SS·IG]               [SS·FB]              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Ask about anything — all 11 projects…                              [Send]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### What each colour means

Colour is reserved for things that need an action. Healthy is silver, not green — if everything healthy were green, the board would be a wall of green and red would stop meaning anything.

| Colour / shape | Means | Where it appears |
|---|---|---|
| **Red** (solid left bar) | Blocked. Content is not going out, or regulated content will publish itself unreviewed. Needs you today. | Rail rows, tile top edge, status chip |
| **Amber** (solid left bar) | Waiting on you. Nothing is broken; it stalls until you decide. Approvals, drafts about to go, connections expiring. | Rail rows, status chip |
| **Silver** (the default) | Healthy. Running. Nothing needed. Nine of eleven tiles on a normal day. | Everything else |
| **Green** | Confirmed done. Used in exactly two places: the "published" tick, and the all-clear panel. Its rarity is what makes it readable. | Schedule ribbon only |
| **Dashed hollow circle** | Not set up — a gap, not an alarm. A missing logo must not compete visually with a failed publish. | Gap pips |
| **Hollow circle with `?`** | Unknown — we couldn't reach the source. Mandatory: if the accounts check fails, it shows `?`, never "no accounts". Showing "no accounts connected" on a project with 18 connected accounts would destroy trust in every other number on the board. | Gap pips |
| **`▌` solid left rule** (not a colour) | This project is AHPRA or TGA regulated. Permanent fact, so it uses shape rather than colour and doesn't compete with today's alerts. | Tiles, rail rows |

#### How 11 projects fit on one screen

Each tile is about 120px. Four columns on a desktop, three rows — all 11 visible without scrolling. Each tile carries only five things: logo, name, four gap pips (Colours · Logo · Accounts · Strategy), "Next 7 days: N", and one plain-English suggested next action. Clicking a tile sets that project active and opens the Director with the suggestion pre-filled.

On a phone the grid becomes a list of 11 slim rows — still one sweep, roughly 620px.

#### What is deliberately kept off this screen

- Department and agent names, the org chart, agent activity. Departments are invisible; the Director presents all work as its own.
- AI cost and token spend. Real data, wrong screen — it never answers "what needs doing". It stays in Command Centre → Costs.
- Engagement analytics, follower counts, charts. This is a to-do surface, not a reporting surface.
- Canva thumbnails and the media grid. Assets to browse, not decisions to make.
- **Every publishing implementation word.** Mixpost, VPS, nginx, Docker, OAuth, webhook, ffmpeg, 504 — banned from anything rendered. A dead connection reads "Instagram needs reconnecting — nothing can go out on it".
- A sortable table of all 11 projects. It's the obvious solution and it's wrong: a table gives all 11 rows equal weight, which is the exact opposite of a macro view. The grid-plus-rail split exists so two projects can shout while nine stay quiet.

#### Two things that need a database change, not a screen

These cannot be fixed in the interface and should be flagged now:

1. **Approvals have no project attached.** The approvals table has no project column at all. That is why the approvals screen can't tell you which of 11 projects an item belongs to. Needs a one-line migration plus a backfill.
2. **AI spend has no project attached.** Same problem — the cost table has no project column, so "what is Downscale costing me versus ScentSell" is currently unanswerable. Separately, **the cost table is empty**: both places that write to it include a column that doesn't exist, so the database silently rejects every write. Every cost row since launch has been dropped. Any spend panel is dead until that's fixed.

---

## Section 2: Publishing Options

### Comparison

| | **A. Mixpost on your Mac** | **B. Mixpost on a different rented server** | **C. Postiz** | **D. Blotato** | **E. Direct to the platforms, built into NRS** |
|---|---|---|---|---|---|
| **Effort** | Half a day | An afternoon — least of all five | Highest — rebuild ~1,900 lines of existing integration | Low to first post, high to a *safe* post | Weeks, not days (see verification below) |
| **Re-authorise 18 accounts?** | **No** | **No** | **Yes, all 18** | **Yes, all 18** | **Yes, all 18** |
| **Cost** | $0/mo | ~$5–15/mo | $39–49/mo cloud, or $5–15/mo self-hosted | $97/mo realistic (credit-metered) | **$0/mo** |
| **Breaks when your Mac sleeps?** | **Yes — fatally** | No | No | No | No |
| **Do you get a screen?** | Yes (Mixpost's, in a second tab) | Yes (Mixpost's, in a second tab) | Yes (a second tab, not embeddable) | Yes (a second tab, not embeddable) | **Not yet — must be built** |
| **Matches NRS's own build-our-own rule** | No | No | No | No | **Yes** |
| **Platforms** | 10 | 10 | 30+ | 9 | 6 surfaces (FB, IG, YouTube, LinkedIn, TikTok, X) |

**Verified**: your 18 connected accounts are 7 Facebook Pages, 5 Instagram, 3 LinkedIn, 2 YouTube, 1 TikTok. Seventeen authorised — one Facebook Page (TeleScribe) is currently *de-authorised*, and nothing in NRS shows you that. There are **zero** Pinterest, Threads, Bluesky or Mastodon accounts, so moving to direct platform APIs strands nothing.

### Route A — Mixpost in Docker on your Mac

**Reject.** Scheduled publishing is a clock-driven service and a laptop is not a clock. Publishing at 7am Tuesday requires the machine awake, online, with Docker running, at 7am Tuesday. Docker suspends when the lid closes.

Worse than merely delaying posts: NRS runs on Vercel and checks for publishable content every five minutes. If it can't reach your Mac, its own safety sweep marks anything stuck for ten minutes as **failed**. A sleeping laptop actively marks real scheduled content as failed.

One honest upside: your `.mov` timeout is an ffmpeg transcode running past a server time limit, and your Mac transcodes far faster than a small rented box, so that specific symptom would probably disappear. That's a reason to run it locally to *debug*, not to let it publish for 11 businesses.

### Route B — Mixpost on a different rented server

**The correct bridge, not the destination.** Blunt version: you refused *that server*, not *all servers*. If the objection is to the specific box that's timing out with a broken upload-progress config, this fixes it in an afternoon with no re-authorisation and no code change — copy the database, start it on a new host, repoint the domain.

Note that **both current faults follow the software, not the hardware.** The broken upload progress is a configuration setting pointing at the wrong address; the timeout is a server time limit set too low for video. Moving hosts without fixing those two settings reproduces both faults on the new box.

If your objection is "I never want to think about a server again", B solves nothing.

### Route C — Postiz

**Reject.** A sideways move: same category of tool, but it costs you a full rebuild of the existing integration *and* 18 re-authorisations. Two specific traps. Its built-in AI connector would let an outside AI publish directly, bypassing the Director and the compliance check — precisely the thing NRS was designed to prevent. And its licence has a clause that would force you to publish your own modifications if NRS is ever sold as software to customers.

Only wins if you genuinely need Reddit, Discord or Bluesky reach. That's a marketing question, not an infrastructure one.

### Route D — Blotato

**Reject as your publisher; keep it as the creative tool it already is.** The connection is already built and eight of its tools are already available to the Director. But there are three gaps to make it your main publisher, and one of them is dangerous: its publish tool takes no project and runs **no compliance check at all**, while its own description actively invites the AI to pick it over the safe path. For five regulated brands at $60,000 per offence, that's an open door. Making it primary would make that structural.

Where it genuinely earns its place — and where it's already correctly positioned — is the things Mixpost can't do: pulling content out of a URL, generating carousels and visuals from templates, repurposing.

### Route E — Direct to the platforms, built into NRS

**The right destination, but not as close as it looks.** This is the only route that matches NRS's own rule ("Direct platform APIs. No middleware dependencies"), the only one that's free forever, and the only one with no third party sitting between a regulated brand and a published claim.

There is real code already written — roughly 2,700 lines of platform code, ten sign-in routes, and the database tables. **But see the next section: the honest state of it is worse than "70% done".**

---

## Section 3: The Recommendation

### The original recommendation was partly refuted. Here is the revised one.

**Original:** Go direct-to-platform now, because it's "already 70% written — the gap is wiring and a screen, not a build."

**That was checked against the live database and the actual code, and it does not hold.** The strongest argument against it, stated fairly, because it's correct:

> The direct-publishing code compiles and has **never run once**. All three of its database tables are empty — zero rows. The screen you asked for cannot be built on them, because they contain nothing and will contain nothing for weeks. Completing this route doesn't fill your accounts screen; it **empties it**, because everything you can see today comes from the current server.

And four specific defects were verified in that code, any one of which would bite you weeks after you thought it was working:

| Defect | What actually happens to you |
|---|---|
| **Token renewal is not wired up** — confirmed at `src/lib/publishers/dispatcher.ts:194`, which never passes a renewal function through | LinkedIn works for about 60 days, then **silently and permanently dies** — the code writes "expired" to the database and won't retry. TikTok dies **overnight** (24-hour token). One-way door: only you re-signing in fixes it. |
| **All Facebook Pages get filed under one project** — confirmed at `src/app/api/oauth/meta/callback/route.ts:114`, which loops every Page into a single project | You have 7 Facebook Pages and 5 Instagram accounts across Downscale, Downscale-Derm, TeleScribe, Scent Sell, Man Clinic and EndorseMe. One sign-in files **all twelve** under whichever project you started from. Then the publisher picks a target by "most recently updated" — arbitrary. **A Downscale weight-loss post can publish to the Man Clinic Page.** |
| **The retry queue fills and never drains** — `processRetries()` is referenced in a comment but does not exist anywhere in the codebase | Failures pile up in a queue nothing reads. No screen shows them. You find out when a client mentions the posts stopped. |
| **The direct path has no compliance check** — verified: zero compliance references in the dispatcher, and zero in the scheduled publisher | Today's compliance gate lives only on the current publishing path. Switching to direct **removes it**. |

One correction the other way, in fairness: the earlier claim that the compliance gate "fails open on AHPRA and misses TGA-only brands" is **out of date**. That has already been fixed — the code now blocks unreviewed content for both AHPRA *and* TGA, with an explicit comment naming Downscale-Derm. Confirmed at `src/lib/agents/tools/publish-to-social.ts:99–106`. The remaining real hole is that the *scheduled* publisher runs no compliance check at all.

### Revised recommendation

**Destination: E (direct to the platforms). Bridge: B (move Mixpost to a different rented host, this week). And build the Macro Board against the data you have today, not against the empty tables.**

Three parts, and the ordering is the important bit:

**1. Move the publishing server, don't kill it yet.** Copy it to a new host (~$5–15/mo), repoint the domain, and **fix the two configuration faults during the move** — the upload-progress address and the video timeout. No re-authorisation, no code change, an afternoon. This buys the runway for everything else.

**2. Build the Macro Board now, against the current data.** This is the flip from the original plan. The original said to build it against the direct-publishing tables "because it's the same work either way". It isn't — one source has data and the other has none. Build it against what exists today (the live accounts list, scheduled posts, drafts, outputs, scan results), and design it so the direct-publishing data can be merged in later without a rewrite. This is the screen you actually asked for, and it can exist this week.

**3. Then go direct, in a different order than originally proposed.** Do the account-to-project mapping and the token management **first** — it's a prerequisite for every platform *and* it's the accounts half of the screen. Then Meta, because that's 12 of your 18 accounts and it's what actually shortens the bridge. Then YouTube (2), then LinkedIn (3). "LinkedIn first because it's safest" optimises for the safest change rather than the useful one — LinkedIn is 17% of your surface. TikTok waits regardless, for a reason outside your control.

### The honest answer on "no more servers"

Route E does eventually remove the server — but **not for months**, and until then something has to hold the sign-in grants for 17 authorised accounts.

So the real trade is:

- If your objection is *"this box is broken"* → move it (B) and it's solved this week.
- If your objection is *"I never want to think about a server again"* → accept 2–4 months of a managed box, **or** accept paid middleware and its compliance gap.

There is no option that is both server-free and available this month. Presenting E as if it were is the part of the original advice most likely to cost you.

### Two things marked uncertain

- **TikTok**: unaudited app credentials are restricted by TikTok to private-only posting with a hard daily cap until their review passes. Your notes already say "TikTok pending review". This restriction applies per app credential, so it blocks routes A, B and E identically — only the paid middleware routes dodge it by using their own approved credentials. *Not independently re-verified against TikTok's current 2026 policy.*
- **Meta**: publishing to Instagram and Pages in production normally needs an elevated permission level from Meta (2–4 weeks, first submissions often rejected). Because you own every Page and account and hold the app credentials, the standard level may be enough. **This has not been checked** — your app's current permission level needs looking at in the Meta dashboard before anyone commits to a timeline. Encouraging sign: the current server already required you to supply these same credentials, so the same app is reused and only a redirect address needs adding.
- **X/Twitter**: write access requires a paid tier and the free tier is heavily capped. *Current 2026 pricing not verified — treat as unknown.*

---

## Section 4: What Happens First

### Right now: your stuck `.mov` upload

The upload isn't failing because of the file or the network. Two separate faults are stacked:

1. **The timeout.** When you finish a chunked video upload, the server starts converting the video and the web server gives up before the conversion finishes. Fix: raise the two time limits on the publishing server (web server and PHP), or convert the video before uploading it.
2. **The progress bar never updates.** The live-progress connection is configured to point at `localhost`, which means "this same machine" — from your browser, that's your laptop, not the server. It can never connect, so no progress ever arrives and the page throws an error. Fix: one configuration value.

**Both faults are in the software's settings, not the hardware.** Moving to a new host without fixing them reproduces both. Do them as part of the move.

**Unblock today, in this order:**

1. **Convert the `.mov` to `.mp4` before uploading.** This sidesteps the conversion step entirely and is the only step that gets your video out today with no server work.
2. Raise the two time limits on the publishing server.
3. Fix the progress-connection address.
4. Surface de-authorised accounts in NRS — your TeleScribe Facebook Page is currently de-authorised and nothing tells you.

### Then, in order

| # | Step | Why here | Rough size |
|---|---|---|---|
| 1 | Convert the `.mov`, fix the two server settings | Gets you unblocked today | Under an hour |
| 2 | **Wire in the brand switcher that's already written** | It exists, nothing imports it. Cuts the portfolio sweep from 23 clicks to ~13. Immediate relief before the real fix. | Hours |
| 3 | Move the publishing server to a new host | Off the box you don't want; no re-authorisation; no code change | An afternoon |
| 4 | Add a project column to approvals and to AI spend, and fix the broken spend writes | Cannot be solved in the interface. Without these, the board can never say which project an approval belongs to, or what each project costs. | Small, but it's a database change |
| 5 | **Build the Macro Board** against today's data | The screen you asked for. Ranked attention rail, 11 tiles, compliance-first ordering. | The main piece of work |
| 6 | Add a compliance check to the scheduled publisher | Right now scheduled posts publish with no regulatory review at all. This is the one genuine live liability in the list and it is independent of every publishing decision. | Small |
| 7 | Build account-to-project mapping and token management for direct publishing | Prerequisite for every platform, and it's the accounts half of the board | Real work |
| 8 | Go direct on Meta (12 of 18 accounts) | The step that actually shortens the bridge | Real work, gated on Meta's permission level |
| 9 | Go direct on YouTube, then LinkedIn | Remaining 5 accounts | Real work |
| 10 | Retire the rented server | Only once the last platform is native | — |

**Step 6 is worth calling out separately.** It is not a publishing decision, it's a live gap: content scheduled to publish on a timer currently goes out with no AHPRA or TGA review. Changing publisher doesn't touch it either way. For five regulated brands at $60,000 per offence, it should be closed regardless of which route you pick, and it's small.

---

*Every claim about the code in this document was checked against the files in this repository and against the live database. Items marked uncertain were not verified and are labelled as such — they are the ones to check before committing to a timeline.*
