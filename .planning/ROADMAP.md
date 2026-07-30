# Roadmap: NotRealSmart Agency

## Overview

NRS is a well-built reactive tool server running real marketing for eleven Australian
businesses. It answers well when asked and does nothing when it isn't, and there is no
screen anywhere that shows more than one project at a time. The owner asked for two
things: a system that knows his projects and surfaces what needs doing, and one screen
that shows it.

The journey starts with the screen, because it is the thing he can look at and because
every signal it needs already exists in the database. It then moves publishing off the
host he has withdrawn, closes the regulatory gaps that survive on paths a language model
can still choose, turns on the proactive engine that is already written and simply not
running, and only then replaces the publishing middleware platform by platform. The
Studio's appearance comes last, at his instruction.

Each phase ships on its own. Nothing here needs the phase after it to be worth having.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Execution order: Phase 2 first**, then Phase 1, then 3-6. Phase 2 was moved
ahead because the withdrawn host is still the only thing publishing, and it has
no technical dependency on Phase 1.

- [ ] **Phase 2: Publishing off the withdrawn host** - Same accounts, same content, a host he has not refused *(runs first)*
- [x] **Phase 1: The Macro Board** - One screen showing all eleven projects, ranked by what needs him today *(shipped e92b2ae)*
- [x] **Phase 3: Closing the regulatory gaps** - No route to a live account escapes the review, and tests prove it *(shipped 1df233c)*
- [~] **Phase 4: Proactive project intelligence** - NRS learns each project on a schedule and briefs any AI that connects *(brief shipped 5d51ae8; the scheduled learning is the remaining half and needs the owner's yes — it spends on every run across eleven projects)*
- [ ] **Phase 5: Publishing direct to the platforms** - Each account bound to its own project, middleware retired
- [x] **Phase 6: The Studio workspace** - Left-sidebar navigation and one Creator from idea to scheduled *(already built; verified 2026-07-30, and the Creator's review fixed in 1b7b9e9)*

## Phase Details

### Phase 1: The Macro Board
**Goal**: The owner opens NRS and sees, in one sweep, what needs him across all eleven projects — what is broken, what is waiting on him, what regulated content is about to publish unreviewed, and what is going out this week.
**Depends on**: Nothing (first phase)
**Requirements**: BOARD-01, BOARD-02, BOARD-03, BOARD-04, BOARD-05, BOARD-06, BOARD-07, BOARD-08, BOARD-09, BOARD-10, BOARD-11, BOARD-12, DATA-01, DATA-02, DATA-03, PUB-03
**Success Criteria** (what must be TRUE):
  1. Opening NRS lands on a board showing all eleven projects at once; nothing has to be selected first, and the previous 23-click sweep is one screen.
  2. Everything needing a decision appears in a single ranked list capped at eight rows, with regulated and blocked items above waiting ones — and every approval says which project it belongs to.
  3. A regulated project with unreviewed content scheduled to go out is visible on the board before it publishes, and a de-authorised account reads as "needs reconnecting", not as silence.
  4. A source that cannot be reached shows as unknown, never as zero — the accounts pip renders `?` rather than "no accounts connected".
  5. Changing the active project keeps the owner where he is, and clicking a project tile opens the Director with the suggested action already written.
  6. Nothing rendered names a department, an agent, Mixpost, a server, OAuth or an HTTP code.
**Plans**: shipped directly — `src/lib/macro/board.ts` (logic, 20 tests), `/api/macro/board`, `/agency/board`
**UI hint**: yes

### Phase 2: Publishing off the withdrawn host
**Goal**: Everything the owner publishes today keeps publishing, from a host he has not refused, with the two faults that broke his video upload fixed on the way across — and none of the seventeen authorised accounts has to be signed in again.
**Depends on**: Nothing — runs first.

> Originally sequenced after Phase 1 to put something visible in front of the
> owner early. PUB-01 and PUB-02 have no technical dependency on the Macro Board,
> and the withdrawn host is the live problem: it is still the only thing
> publishing, and work kept being drawn back onto a machine the owner has ruled
> out. Executing this first ends that. Phase 1 follows.
**Requirements**: PUB-01, PUB-02
**Success Criteria** (what must be TRUE):
  1. A post scheduled through NRS publishes to Facebook, Instagram and LinkedIn from the new host, with no account re-authorised and no content re-created.
  2. The video that previously failed uploads and publishes, and the owner can watch its progress instead of seeing an error.
  3. Nothing in NRS had to change to point at the new host beyond configuration — no publishing code was rewritten for the move.
**Plans**: 1 plan, 19 tasks in 6 waves
Plans:
- [ ] `phase-2/PLAN.md` — Migrate Mixpost Pro to a managed Sydney host with the 17 OAuth grants intact and both upload faults carried across as day-one configuration

### Phase 3: Closing the regulatory gaps
**Goal**: There is no longer any way for content to reach a live social account, or to enter the library agents learn from, without passing the one regulatory review — including the routes a language model can choose on its own.
**Depends on**: Phase 2
**Requirements**: GUARD-01, GUARD-02, GUARD-03, GUARD-04, GUARD-05, GUARD-06, GUARD-07
**Depends on**: nothing — Phase 2 is a hosting decision the owner has not made, and none of this needed it.
**Success Criteria** (what must be TRUE):
  1. No publishing tool the Director can select is able to post without knowing which project it is posting for; the tool that could is either fixed or gone.
  2. Content that fails a review for a regulated project is not saved into the outputs library, and does not come back later as an example of prior work.
  3. A regulated post that has not been reviewed and approved does not publish, even if a model marks it scheduled — this is enforced in code, not requested in a prompt.
  4. A model outage cannot produce a pass; the review runs on the same transport and fallback chain as every other model call, and its spend is attributed.
  5. Creating a health project without its regulatory flags set is not silently possible.
  6. Tests fail if any of the above is undone by a later change.
**Plans**: TBD

### Phase 4: Proactive project intelligence
**Goal**: NRS learns each project on its own schedule — scanning the site, refreshing what it knows, and surfacing barriers, gaps and risks — and hands that knowledge to any AI that plugs in, unprompted.
**Depends on**: Phase 3
**Requirements**: PROACT-01, PROACT-02, PROACT-03, PROACT-04, PROACT-05, PROACT-06, PROACT-07, BRIEF-01, BRIEF-02, BRIEF-03, BRIEF-04
**Success Criteria** (what must be TRUE):
  1. Without anyone sending a message, risks and gaps appear on the Macro Board — a failed post, a week with nothing planned, a platform gone quiet.
  2. A project's strategic sections fill in over time and stop reading empty; a section past its review date causes the work to be done rather than a label to be shown.
  3. A project with a website gets scanned even if no code repository was ever connected, and gets re-scanned later; when the site changes, the change is visible as a change.
  4. A connected AI client asks once and receives the project's brand contract, what is stale, what is at risk, and three suggested next actions — without knowing which tool to call.
  5. The project list an AI client sees says how each project is doing, not just what it is called.
  6. A plugged-in AI and the web Director give the same answer about the same project.
**Plans**: TBD

### Phase 5: Publishing direct to the platforms
**Goal**: Each connected account belongs to exactly one project and publishes straight to the platform, connections renew themselves, failures are visible — and the rented host is switched off.
**Depends on**: Phase 4
**Requirements**: PUB-04, PUB-05, PUB-06, PUB-07, PUB-08
**Success Criteria** (what must be TRUE):
  1. Signing in to Meta files each Page and Instagram account against the project it actually belongs to, and a post for one project cannot publish to another project's account.
  2. Meta's twelve accounts publish directly, then YouTube's two, then LinkedIn's three — each verified with a real post before the next begins.
  3. A connection nearing expiry renews without the owner signing in again; if it cannot, he is told on the board before content stops going out.
  4. A failed publish is retried, and one that keeps failing shows up as something needing him rather than disappearing.
  5. The rented publishing host is switched off and everything still publishes.
**Plans**: TBD

### Phase 6: The Studio workspace
**Goal**: The Studio reads like the tools the owner already uses — content and configuration grouped down the left — and one Creator takes a post from idea to scheduled without ever opening a second screen.
**Depends on**: Phase 5
**Requirements**: STUDIO-01, STUDIO-02, STUDIO-03
**Success Criteria** (what must be TRUE):
  1. Studio navigation is a left sidebar grouping content and configuration, and the owner can find any surface without hunting through top tabs.
  2. Editing an existing draft opens the same Creator as writing a new post — from the media library, from a fresh start, or from a draft in review.
  3. A post can be written, checked, and scheduled inside the Creator without leaving it.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. The Macro Board | 1/1 | Complete | 2026-07-30 |
| 2. Publishing off the withdrawn host | 0/1 | Planned | - |
| 3. Closing the regulatory gaps | 1/1 | Complete | 2026-07-30 |
| 4. Proactive project intelligence | 1/2 | Brief done, scheduled learning pending owner | - |
| 5. Publishing direct to the platforms | 0/TBD | Not started | - |
| 6. The Studio workspace | 1/1 | Complete (was already built) | 2026-07-30 |

---

## Notes for planning

Carried forward so the next workflow does not have to re-derive them.

- **Phase 2 may need to move first.** Mixpost is still serving from the withdrawn host,
  and if it degrades further, publishing continuity outranks the board. The owner's own
  ordering in `OPTIONS-publishing-and-interface.md` put the host move before the board;
  the board is first here because he asked to see something early. His call.
- **Phase 6 was already built.** Verified 2026-07-30 against the code: `StudioSidebar.tsx`
  groups Content and Configuration down the left, and `PostCreator` already accepts a draft
  id, a media id, or neither — the three entry points — and saves as draft, scheduled or now
  without leaving. The roadmap had it as not started. Third time this session a planning
  document disagreed with the repository and the repository was right.
- **Superseded — re-verify before Phase 6.** `PostCreator.tsx` is recorded at 541 lines in one April
  snapshot and 754 in another, one day apart, and neither was checked against the code.
  `docs/2026-04-08-post-creator-redesign.md` — the authority on the Creator's sections —
  was never ingested. Read both before planning Phase 6.
- **Three external assumptions gate Phase 5 and are unverified.** Meta's current app
  permission level (check the dashboard before committing to any timeline), TikTok's
  2026 review policy, and X/Twitter's write-access pricing. Meta is the one to check
  first — it is twelve of eighteen accounts.
- **Four items in the video pipeline have never run live** (C-20 in
  `.planning/intel/constraints.md`). Do not let a phase depend on them without proving
  them first.
- **The already-fixed work is not scheduled here.** The brand-kit contract over MCP, the
  brand palette reaching agent prompts, and the shared publishing gate covering the
  scheduled publisher, the direct dispatcher and the Meta callback all landed this
  session and are recorded as validated in `PROJECT.md`.
