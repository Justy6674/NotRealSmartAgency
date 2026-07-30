# Requirements

**Authored 2026-07-30. Not extracted.**

The ingest set contains eight SPECs and three DOCs and **zero PRDs**, so
`.planning/intel/requirements.md` deliberately holds no `REQ-` entries. Back-filling
requirements from SPEC build steps would lock in drift that has already been proven
wrong three times this session — a confident document disagreed with the repository,
and the repository was right each time.

These requirements are written from two sources only:

1. **The owner's stated purpose**, recorded verbatim in `.planning/intel/owner-decisions.md`
   §D-C and `.planning/intel/context.md`.
2. **The Macro Board specification**, `.planning/OPTIONS-publishing-and-interface.md` §1.

Where a requirement encodes a verified fact about the current code, the evidence is
named. Nothing here describes how something is built — only what must be true for the
owner and for an AI plugged into NRS.

---

## The owner's purpose, restated

> "NRS must keep plugged-in AI clients brand-aware and structured — always suggest a
> plan, guide the AI, know my site, scan it, suggest optimisations, my social media,
> enablers, barriers, risks, gaps. And do fast things fast."

> "I need an interface — that's what Mixpost or Canva is — so visually I always see
> what's needed, macro."

Two halves. **Push** — the system knows and surfaces without being asked. **Macro** —
one screen showing state across all eleven projects. NRS today does neither.

---

## v1 Requirements

### BOARD — the macro interface

- **BOARD-01** — One screen shows the operational state of all eleven projects at once,
  without selecting a project. Today `/agency` redirects to a chat box scoped to one
  project, and assembling the portfolio picture costs 23 clicks and 11 page loads.
- **BOARD-02** — Everything needing a decision from the owner appears in **one** ranked
  list, capped at eight rows, so he never has to read three lists and work out which is
  worse. Blocked outranks waiting; regulated outranks unregulated.
- **BOARD-03** — Each project tile carries only: logo, name, four gap pips (colours,
  logo, accounts, strategy), "next 7 days: N", and one plain-English suggested next
  action.
- **BOARD-04** — Unknown is shown as unknown, never as absence. If the accounts check
  cannot reach its source the tile shows `?`, never "no accounts connected". Showing
  "no accounts" on a project with eighteen connected accounts would destroy trust in
  every other number on the board.
- **BOARD-05** — Colour is reserved for things that need an action. Healthy projects are
  silver, not green. Regulated status is shown with shape (a solid left rule), not
  colour, because it is a permanent fact and must not compete with today's alerts.
- **BOARD-06** — A week ribbon shows what is going out across all projects over the next
  seven days, one glance, no project switching.
- **BOARD-07** — Clicking a project tile sets that project active and opens the Director
  with the suggested action pre-filled.
- **BOARD-08** — Changing the active project never throws the owner back to a different
  screen. Today the sidebar forces a return to chat, which is what doubles the click
  cost of every project after the first.
- **BOARD-09** — Nothing the owner sees names a department, an agent, or a piece of
  publishing plumbing. Mixpost, VPS, nginx, Docker, OAuth, webhook, ffmpeg and HTTP
  status codes are banned from rendered text. A dead connection reads "Instagram needs
  reconnecting — nothing can go out on it".
- **BOARD-10** — Every approval shown to the owner says which project it belongs to.
  Today the approvals screen cannot, because the table has no project column.
- **BOARD-11** — A regulated project with content scheduled to publish that has not
  passed a regulatory review is visible on the board **before** it goes out. Nine of
  eleven projects are AHPRA or TGA flagged and no screen answers this today.
- **BOARD-12** — The owner can ask a question about the whole portfolio from the board
  itself, without first choosing a project.

### DATA — attribution the interface cannot fake

- **DATA-01** — Every approval and every unit of AI spend is attributed to a project, so
  "what is Downscale costing me versus ScentSell" is answerable.
- **DATA-02** — Cost writes reach the database. `ai_usage` has **0 rows**: both writers
  include a `metadata` column that does not exist on the table, so PostgREST rejects
  each insert whole. Every cost row since launch has been dropped.
- **DATA-03** — A scheduled post records whether it has been regulatory-reviewed, by
  whom, and when — so both the board and the publisher can act on it.

### PUB — publishing that works and cannot cross projects

- **PUB-01** — Scheduled and immediate publishing runs from a host the owner has not
  withdrawn, with no re-authorisation of the seventeen authorised accounts.
- **PUB-02** — A video that previously timed out on upload publishes, and the owner can
  see upload progress while it happens.
- **PUB-03** — An account that has lost its authorisation is visible in NRS before it
  silently stops content going out. The TeleScribe Facebook Page is de-authorised right
  now and nothing tells him.
- **PUB-04** — Each connected social account belongs to exactly one project, and content
  publishes only to accounts of its own project. Verified hazard: one Meta sign-in files
  every Facebook Page the owner administers under a single project, and the publisher
  then picks a target by "most recently updated" — a Downscale weight-loss post can
  publish to the Man Clinic Page.
- **PUB-05** — A connection approaching expiry is renewed without the owner re-signing
  in; where it cannot be, he is told before it stops working. LinkedIn currently dies
  silently at ~60 days and TikTok overnight, with no retry.
- **PUB-06** — A publish that fails is retried, and if it keeps failing it appears on the
  board. Today failures enter a queue that nothing drains and no screen shows.
- **PUB-07** — Meta (12 of 18 accounts), then YouTube (2), then LinkedIn (3) publish
  directly to the platform with no middleware in between.
- **PUB-08** — The rented publishing host is retired once every connected account
  publishes natively.

### GUARD — the regulatory boundary

- **GUARD-01** — Every route that can reach a live social account passes the one shared
  regulatory gate, and a regression test fails if a new route bypasses it.
- **GUARD-02** — No publishing tool exists that cannot say which project it is posting
  for. `blotato_publish` takes a user and no project, cannot load compliance flags, and
  sits in the Director's toolset beside the safe path.
- **GUARD-03** — Content that fails a regulatory review never enters the outputs library
  that agents later learn from. `save_output` currently records the violation and saves
  anyway, and is directly callable over MCP.
- **GUARD-04** — A regulated post cannot publish without a recorded review. Approval is
  enforced in code, not by asking a language model to behave.
- **GUARD-05** — The regulatory review runs on the same resilient model transport as
  every other model call, with a fallback chain and attributed spend. It currently
  bypasses the gateway with a direct provider import on the highest-stakes judgement in
  the business.
- **GUARD-06** — A health project cannot silently be created without its regulatory flags
  set. One missed checkbox disables the entire control surface for that project today,
  with no warning anywhere.
- **GUARD-07** — The compliance path has regression tests that fail if any of the above
  is undone.

### PROACT — the system knows without being asked

- **PROACT-01** — Barriers, gaps and risks are found on a schedule and surfaced without
  the owner asking: posts that failed, days with nothing planned, platforms gone quiet.
  The code that does this exists and has never run — it is not scheduled.
- **PROACT-02** — Each project's twenty-one strategic sections are populated and kept
  current by the department that owns them. Fourteen of twenty-one seed empty and red,
  and the thirteen departments that would produce the research cannot write to them.
- **PROACT-03** — A section past its review cadence causes work to happen, not just a
  display string. Staleness is computed today and acted on by nothing.
- **PROACT-04** — Website, sitemap and social discovery runs for any project with a
  website, independent of whether a code repository was ever connected, and refreshes on
  a schedule. Discovery has exactly one trigger today and has run once.
- **PROACT-05** — When a re-scan finds the site or the socials have changed, that change
  is detectable as a change rather than silently overwriting what was known.
- **PROACT-06** — What actually worked for a project feeds back into what the system
  suggests next.
- **PROACT-07** — Proactive work runs without the owner, or a language model, having
  first created a goal. The only autonomous loop is a no-op for any project without an
  active objective-level goal.

### BRIEF — a plugged-in AI arrives already briefed

- **BRIEF-01** — In one call, a connected AI client gets a project's brand contract, its
  health roll-up, what is stale, what is at risk, and three concrete suggested next
  actions.
- **BRIEF-02** — The project list a client sees carries a one-line health summary per
  project. It returns six bare fields today — no status, no risk, no suggestion.
- **BRIEF-03** — On connect, the client is told what to do first, not only what it may
  not do. The current opening prompt is fifty lines of routing policy.
- **BRIEF-04** — A plugged-in AI and the web Director know the same things about a
  project. The two Directors currently carry duplicated prompt logic that will drift.

### STUDIO — the working surface

- **STUDIO-01** — Studio navigation is a left sidebar grouping content and configuration.
  Ranked below everything above, at the owner's instruction.
- **STUDIO-02** — One Creator handles both a new post and an existing draft, reachable
  from the media library, a fresh create, and a draft in review. There is never a
  separate edit screen.
- **STUDIO-03** — The Creator carries the sections the redesign specification defines,
  including scheduling, so a post can be taken from idea to scheduled without leaving it.

---

## Deferred to v2

Recorded so they are not silently lost.

| Item | Why deferred |
|---|---|
| TikTok direct publishing | Unaudited app credentials are restricted by TikTok to private-only posting until their review passes. Gated externally, not by us. |
| X/Twitter direct publishing | Write access requires a paid tier; 2026 pricing unverified. One account is not worth the exposure. |
| Per-platform metadata parity (13 provider option sets) | Mixpost parity item. Below the functional work by owner instruction. |
| Platform-accurate preview renderers (Mixpost has ~40, NRS has 6) | Same. |
| Media library stock photos and GIFs | Same. |
| Replacing the keyword memory store with semantic memory | Real, but not what the owner asked for. |
| Rewriting git history to remove `anthropic-leaked-source-code-main.zip` | Destructive, touches shared `main`, and is explicitly the owner's decision — not autonomous cleanup. Raise it, do not schedule it. |
| Vendored `agency-agents-main-EXAMPLE/` (212 files, 27 modified in place) | Needs an owner call on whether the local modifications are wanted before anything moves. |
| `postcss` / `sharp` advisories reached through `next` | No non-breaking fix exists; the only path is a future Next.js release. Track, do not plan. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOARD-01 | Phase 1 | Pending |
| BOARD-02 | Phase 1 | Pending |
| BOARD-03 | Phase 1 | Pending |
| BOARD-04 | Phase 1 | Pending |
| BOARD-05 | Phase 1 | Pending |
| BOARD-06 | Phase 1 | Pending |
| BOARD-07 | Phase 1 | Pending |
| BOARD-08 | Phase 1 | Pending |
| BOARD-09 | Phase 1 | Pending |
| BOARD-10 | Phase 1 | Pending |
| BOARD-11 | Phase 1 | Pending |
| BOARD-12 | Phase 1 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| PUB-03 | Phase 1 | Pending |
| PUB-01 | Phase 2 | Pending |
| PUB-02 | Phase 2 | Pending |
| GUARD-01 | Phase 3 | Pending |
| GUARD-02 | Phase 3 | Pending |
| GUARD-03 | Phase 3 | Pending |
| GUARD-04 | Phase 3 | Pending |
| GUARD-05 | Phase 3 | Pending |
| GUARD-06 | Phase 3 | Pending |
| GUARD-07 | Phase 3 | Pending |
| PROACT-01 | Phase 4 | Pending |
| PROACT-02 | Phase 4 | Pending |
| PROACT-03 | Phase 4 | Pending |
| PROACT-04 | Phase 4 | Pending |
| PROACT-05 | Phase 4 | Pending |
| PROACT-06 | Phase 4 | Pending |
| PROACT-07 | Phase 4 | Pending |
| BRIEF-01 | Phase 4 | Pending |
| BRIEF-02 | Phase 4 | Pending |
| BRIEF-03 | Phase 4 | Pending |
| BRIEF-04 | Phase 4 | Pending |
| PUB-04 | Phase 5 | Pending |
| PUB-05 | Phase 5 | Pending |
| PUB-06 | Phase 5 | Pending |
| PUB-07 | Phase 5 | Pending |
| PUB-08 | Phase 5 | Pending |
| STUDIO-01 | Phase 6 | Pending |
| STUDIO-02 | Phase 6 | Pending |
| STUDIO-03 | Phase 6 | Pending |

**Coverage: 44 of 44 v1 requirements mapped, each to exactly one phase.**
