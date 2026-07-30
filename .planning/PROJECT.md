# NotRealSmart Agency

## What This Is

A self-owned agentic marketing platform that runs marketing for eleven Australian
businesses, four of which advertise regulated health services. Its job is to make
every AI that plugs into it — Claude Code, Hermes, Claude Desktop — work on-brand
and within AHPRA/TGA limits without being told how, and to show its owner one
screen that says what needs doing.

The owner is a nurse practitioner and product person, not a developer. He should
never be asked to read JSON, open developer tools, or run a command.

## Core Value

An AI plugged into NRS cannot go off-brand or off-compliance, and does not have
to ask how — NRS tells it, and shows the owner what still needs a decision.

## Business Context

- **Customer**: Black Health Intelligence Pty Ltd (ABN 23 693 026 112) — the
  owner's own eleven projects. Built because it was needed in-house.
- **Success metric**: Work published on-brand and compliant without the owner
  correcting it afterwards.
- **Regulatory exposure**: AHPRA and TGA penalties reach $60,000 per offence.
  Four active projects are flagged: Downscale Weight Loss, TeleCheck Clinic,
  Black Health Intelligence, EndorseMe.

## Requirements

### Validated

<!-- Shipped and confirmed working this session, with evidence. -->

- Brand palette, logo and typefaces reach every agent's system prompt
  (`c5d2906`) — previously only voice rules did, which is why copy came out
  on-brand and designs did not.
- `get_brand_kit` returns the whole brand contract to any plugged-in client in
  one call (`081d37b`), verified live over MCP.
- One shared regulatory gate covers the scheduled publisher and the direct
  dispatcher; the Meta sign-in no longer files another project's Pages
  (`6b9dd64`).
- Brand colours are read from the live site's CSS, not invented — 55 of 55
  stored values verified present in the real stylesheets (`a3b5bbd`).

### Active

- [ ] **Proactive project intelligence.** Something populates the 21 proforma
      sections per project — gaps, risks, barriers, KPIs, competitors, channel
      health — on a schedule, using the 13 department agents that already exist.
      Today nothing does, and most sections are empty.
- [ ] **The Macro Board.** One screen showing all eleven projects at once: what
      is blocked, what is unreviewed, what is waiting on the owner, what is
      scheduled, and what NRS suggests next. No such screen exists.
- [ ] **A brief on connect.** A plugged-in AI is handed the brand contract and
      the current state without having to know which tool to call.
- [ ] **Publishing off the retired VPS.** Move Mixpost to a rented host, then
      build direct platform publishing behind it and retire the middleware.
- [ ] **Left-sidebar Studio navigation**, per the parity inventory — ranked
      below the functional work above, at the owner's instruction.

### Out of Scope

- **Hosting anything on the owner's Mac** — Vercel's cron marks a post stuck ten
  minutes as failed, so a sleeping laptop marks real scheduled content failed
  rather than delaying it.
- **The BinaryLane VPS at 203.29.242.68** — withdrawn by the owner. Mixpost must
  move off it, not stay.
- **Switching to direct publishing before per-account project mapping is proven**
  — `social_oauth_tokens` has zero rows and the path has never run.
- **Three.js for new features** — standing prohibition; it survives only in the
  landing and about heroes.
- **Paid third-party AI APIs as a default** — build first, self-host second,
  free tier third.

## Constraints

- **Australian English throughout**, in code comments, UI copy and generated
  marketing.
- **Compliance is not optional and not per-route.** Any new publishing path goes
  through the shared gate in `src/lib/agents/publish-gate.ts`.
- **Departments stay invisible to the owner.** The Director is the only face;
  agent names and internal plumbing are never surfaced.
- **Never invent brand facts.** Colours, logos and typefaces come from the live
  site or the brand record. An empty field is correct; a plausible guess is not.
- **Verify against the code, not the specs.** Three times this session a
  confident document disagreed with the repository, and the repository was right
  each time.

## Current State

Brownfield, in production, publishing real marketing today through Mixpost.

- 173 tests, 172 passing. The single failure predates this work: a
  `brand-portfolio` assertion forbids the string `seggs.life` in copy that
  deliberately says "NOT seggs.life".
- Direct publishing for five platforms is built and has never run.
- Cost tracking has never recorded a row.
- Three proactive cron routes exist in the code and none are scheduled.
