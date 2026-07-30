# The Plan

*Written 30 July 2026. One plan. It fits inside the roadmap already in this folder — it does not replace it.*

---

## In one sentence

NRS becomes the single place that knows what all eleven businesses are doing and what each one needs next, gbrain becomes the single place that remembers why, Obsidian stays the only place you write, and Hermes reads all of it aloud to you at 7am — so there is one screen to look at, one assistant to talk to, and no fact stored in two places.

---

## The shape of it

```
                          YOU
                           |
        +------------------+------------------+
        |                                     |
   one screen                          one conversation
   (the Board)                            (Hermes)
        |                                     |
        +------------------+------------------+
                           |
                  +--------v--------+
                  |   ONE ANSWER    |   <-- the daily state of all eleven
                  |  computed once  |       businesses, computed in NRS,
                  +--------+--------+       read by every surface
                           |
        +------------------+------------------+
        |                  |                  |
   +----v----+      +------v------+     +-----v-----+
   |   NRS   |      |   gbrain    |     |  graphify |
   |         |      |             |     |           |
   | what is |      | remembers   |     | how the   |
   | true &  |      | everything  |     | code fits |
   | what is |      | you and it  |     | together  |
   | planned |      | have written|     |           |
   +----+----+      +------^------+     +-----------+
        |                  |
        | nightly export   | indexes, never authors
        |                  |
        +---------> +------+------+
                    |  OBSIDIAN   |
                    | what YOU    |
                    | wrote:      |
                    | decisions,  |
                    | strategy,   |
                    | reference   |
                    +-------------+

   Plugged-in AIs (Claude desktop, Cowork, Claude Code, Hermes)
   all connect to the SAME answer. None of them improvise a number.
```

Two rules hold the whole picture up:

1. **NRS answers. Hermes reads it aloud.** The Board on screen and the 7am message on your phone are the same object, computed once. They can never disagree.
2. **gbrain owns nothing. It indexes everything.** The moment gbrain starts authoring facts, we are back to three systems half-remembering.

---

## Where every fact lives

This is the heart of it. Today the same fact can sit in three places. After this, each kind of fact has exactly one owner, and everything else is a view.

| Kind of fact | Lives in | Who caches it | Who writes it |
|---|---|---|---|
| Who a business is — voice, audience, regulator, colours, handles | NRS | gbrain indexes it read-only | You, or the Director with your yes |
| The plan for a business — position, channels, market, 90 days | NRS, as the twenty-one section plan it already has | gbrain indexes it | Nightly refresh, capped at amber; you make it green |
| Competitor findings, site scans, gaps | NRS, with the source link attached | gbrain indexes it | The nightly scan |
| Drafts, media, schedule, what published, what failed | NRS only | nothing | NRS |
| Compliance verdicts | NRS only | nothing | The review, in code, never in a prompt |
| Numbers — reach, spend, click-through | NRS, queried live | nothing | Measured, never stored as prose |
| A decision you made and why | Obsidian | gbrain indexes it | **You. Never a machine.** |
| Durable thinking across businesses — strategy, research, reference | Obsidian | gbrain indexes it | You |
| Session logs | Obsidian, out of sight | gbrain still indexes them | The tooling, and it stops writing empties |
| How the code fits together | graphify, thrown away and rebuilt | nothing | Regenerated on change |
| What is being built and in what order | This planning folder | gbrain indexes it | GSD |
| Retrieval across all of the above | **gbrain** | — | **Nothing. It owns no facts.** |
| What Hermes said on Tuesday | Hermes | — | Hermes — and it is never a source for a number |

**What this deletes.** NRS's own memory store stops being a brain. It is 441 fragments matched by substring, with no meaning attached, and it has been quietly failing to build its index for months. We do not fix it by building a second index alongside gbrain's working one. Brand facts move into the section of the plan they describe, where they have a status and a review date. Everything else is retrieval, and retrieval is gbrain's job.

**One thing we make loud before we switch it off.** The reason nobody noticed the index was empty is that the code catches the failure and carries on silently. Make it shout first. A system that degrades in silence is how you lose six months.

**The empty project folder in your vault stays empty.** It is documented as holding a copy of every project and it holds nothing. That is exactly where a fourth copy of brand truth would grow. Leave it — except for one narrow, one-way export described below, which writes findings *out* and never reads them back as truth.

---

## What you'd see

One screen. It is the first thing NRS opens on. Nothing has to be chosen first.

**Top strip — what needs you today.** One list. Never more than eight rows. Ranked so that regulated-and-unreviewed sits above broken, and broken sits above waiting. Every row names its business. Every row is one plain sentence and a button.

> ▌ Downscale — a post about weight-loss medication goes out at 4pm and nobody has reviewed it. **Review**
> ▌ DownscaleDerm — Instagram needs reconnecting. Nothing can go out on it. **Fix**
> Scent Sell — six drafts have been waiting nine days. **Open**
> TeleScribe — nothing planned for next week. **Plan it**

**Middle — eleven tiles, all at once.** One per business. Silver by default; colour only where something needs you. Each tile carries: how healthy its plan is, how many posts go out this week, whether its accounts are reachable, and a compliance mark on the four regulated ones. Click a tile and the Director opens with the suggested message already typed.

**Bottom — the week.** A single ribbon, all eleven businesses overlaid, showing what publishes on which day. Empty days read as empty.

**Three rules about what it shows.**

- If something cannot be reached, it says **?**, never **0**. A business with eighteen connected accounts showing "no accounts connected" would poison every other number on the page.
- The board reports on itself. If the nightly work has not run in thirty-six hours, that is a row on the board, not a line in a log nobody reads. Four scheduled jobs died quietly for ten days because nothing watched the watchers.
- Nothing on screen names a department, an agent, a server, a hosting product, a sign-in protocol or an error code.

---

## What you'd say to Hermes

Hermes holds no facts. Every question re-reads the same answer the Board reads. That is why losing a chat thread costs you nothing.

| You say | What happens underneath |
|---|---|
| *(nothing — 7am, every day)* | A plain script fetches the day's state and sends it. No model involved, so it cannot drift or fail on a provider change. Quiet days are one line: "All eleven quiet. Fourteen posts out this week. Nothing needs you." |
| "What needs doing?" | Same fetch, read back ranked. Identical to the Board, to the row. |
| "How's Downscale doing?" | One call returns that business's brand contract, its plan health, the three weakest sections, what's scheduled, what's waiting, and three suggested next moves — plus anything you've written about it that gbrain can find. |
| "Approve the Scent Sell one." | Approves that item, and echoes back exactly what changed. Nothing publishes without you saying yes. |
| "Hold the Downscale post." | Moves it out of the queue and confirms it. |
| "Push Thursday's to Saturday." | Reschedules and confirms the new time. |
| "Why did we choose this publishing setup?" | Straight to gbrain, answered from what you wrote, with the note it came from. |
| "Where does publishing actually happen in the code?" | Straight to graphify. No grepping, no guessing. |
| "What's Juniper doing?" | Fetches the page fresh, tells you what changed since last time, and files the finding so the second time you ask is free. |

The routing table above is written into Hermes as a rule it reads before choosing a tool — operational state to NRS, judgement and history to gbrain, code to graphify, the outside world to the crawler. Short enough that it survives.

---

## What runs without you

| When | What runs | What it produces |
|---|---|---|
| 7am daily | The morning read | One message on your phone with the ranked list and the board image attached |
| Every 30 min, 7am–9pm | One alert, and only one | Silence — unless regulated content is scheduled inside 24 hours with no review. That is the sixty-thousand-dollar one. |
| Every 5 min | The publisher | Scheduled posts go out |
| Every 15 min | The worker | Anything you've assigned gets picked up |
| 8pm daily | The plan refresh | The eight most out-of-date sections across all eleven businesses get refreshed — each by the department that owns it, each with a source link, each capped at amber |
| Weekly | The site sweep | Each business's website and socials re-read from source, giving the nightly refresh real evidence instead of improvisation |
| Nightly | The export | Decisions, findings and plan changes written out to your vault, then indexed, so Hermes and Claude Code can read them tomorrow without any new integration |

**Two hard limits on the nightly refresh, and they are not negotiable.**

- **Amber ceiling.** A machine-written section can never go green. Green requires you. Without this, an agent obliged to produce something every night turns every red into a green off a website scrape, and those inventions then flow back in as prior work.
- **Source or it isn't written.** Every refreshed section carries the link it came from. No link, no write.

And the routing from section to department is fixed in code, not chosen by a model. A model picking its own router is a nightly source of drift.

---

## Build order

This maps onto the six phases already in the roadmap. It does not add a seventh.

| Phase | Status under this plan |
|---|---|
| **Phase 2 — publishing off the withdrawn host** | **Unchanged. Still runs first.** Nothing here touches it. |
| **Phase 1 — the Macro Board** | **Same goal, wider scope.** Gains the morning message and the Hermes skills, which were previously going to come later. Gains three repairs at the front. |
| **Phase 3 — closing the regulatory gaps** | **Unchanged, and promoted to a hard gate.** Nothing auto-fills a plan for a regulated business until Phase 3 is done. |
| **Phase 4 — proactive project intelligence** | **Same goal, now concrete.** This is where the nightly plan refresh, the weekly site sweep, the anti-invention gate, and the project briefing for plugged-in AIs live. |
| **Phase 5 — publishing direct to the platforms** | Unchanged. |
| **Phase 6 — the Studio workspace** | Unchanged, still last, at your instruction. |

**The one reorder.** Phase 1 was a screen. It is now a screen *and* a morning message, because they are the same work — the message is a few hours on top of the endpoint the screen already needs, and it is the half you will actually use every day. Deferring it to Phase 4 was wrong.

**Three repairs go at the very front of Phase 1, before any screen.** They are small, they are all currently broken, and everything else reads better once they are done:

1. Restart the four scheduled checks that have failed every day for ten days after a settings drift. Ten minutes. It restores automation you already paid for.
2. Fix the cost record that has been rejected on every single write since launch, so the table is empty and every spend figure in the product is currently fiction. The Board is meant to show cost.
3. Make approvals say which business they belong to. They currently cannot, and "every row names its project" is a stated requirement of Phase 1.

**Then the load-bearing step.** The logic that decides "you haven't posted in nine days", "drafts are waiting", "this one failed" already exists and is already correct — but it runs inside the browser, on one business's page, so no schedule, no assistant and no plugged-in AI can ever reach it. Moving it to the server changes no behaviour and unlocks the Board, the morning message and every AI client at once. Do that before anything else is built on top.

---

## Where the judges disagreed, and the call

Three independent reviews. Two picked this shape. One argued for making the morning message the whole product and skipping the screen.

**The disagreement:** does a screen you must open beat a message that comes to you?

**The call: both, in one phase — but build the answer first, then the message, then the screen.** The argument for message-only is strong and I am taking most of it: you live in Telegram, you do not open dashboards, and the evidence on your own machine is that the automated jobs which need a model to run have been failing while the plain scripted ones have run clean every time. So the morning message is a plain script with no model in it. But message-only loses on two things that matter here: a message reports only what its ranking chose, so you cannot tell "TeleScribe is fine" from "TeleScribe was never checked" — and comparing eleven businesses is something your eye does in one sweep and a list of eleven lines does not. The screen costs little once the answer exists, and it is the thing you asked for twice today.

**A second disagreement:** should NRS keep its own memory. One review made a good case that it is nearly working and worth five lines of repair. **The call: repair it loudly, then retire it.** Make the silent failure shout so we learn what actually broke, keep the structured facts in NRS where they have a status and a review date, and send everything else to the brain that already has twenty-five thousand indexed pieces of your thinking. We are not building a second index next to a working one.

**Known weakness, said plainly.** The nightly plan refresh is the part most likely to hurt you. Machine-written sections, unread, across four businesses carrying sixty-thousand-dollar exposure, is a machine for producing confident nonsense at scale. The amber ceiling and the mandatory source link are real protections but they are not proof. Watch the first week by hand, on one business. A red section that tells the truth beats a green one that does not.

---

## What we're deliberately not doing

| Not doing | Why |
|---|---|
| **Building a second index inside NRS** | gbrain already has your whole vault indexed and working. Building a parallel one is a week spent duplicating something that already answers. |
| **Importing the 441 stored fragments** | They came from pattern-matching with no de-duplication and a known high miss rate. Dropping them into a brain with twenty-five thousand good pieces makes it worse, not better. Read them once, hand-pick the handful that actually constrain output, drop the rest. |
| **Deleting session notes** | Nine in ten notes in your vault are auto-written session logs, and they drown the three hundred you actually wrote. We hide them from your own search — one setting, nothing lost, gbrain still reads them. We also stop the tooling writing an empty one every time a session ends, which is the actual source. |
| **Writing plans out to your vault as editable copies** | You would edit the copy, because it is the one that is open, and then two versions disagree and you trust the wrong one. Every one-way copy between two editable surfaces rots. Findings export out; nothing reads back in as truth. |
| **Storing performance numbers as text** | They change hourly. A written file holding last month's click-through is worse than no file. Numbers stay measured and queried live. The section of the plan that tried to hold them gets deleted rather than refreshed forever. |
| **Standing graphify up as a third code map** | gbrain already indexes this codebase. One code map, kept current, thrown away and rebuilt. |
| **The nine video tools the project instructions claim exist** | They do not exist. No code, nothing registered, nothing to call. Delete the claim from the instructions rather than build to it. Documentation that lies about what exists corrupts every decision an assistant makes about what to call — it costs more than documentation that is simply missing. |
| **Three scheduled jobs written but never turned on** | Either schedule them or delete them. Leaving written-but-dormant code is exactly how four other jobs died unnoticed for ten days. |
| **Any new planning round** | The roadmap in this folder is good and was written against the live code. This document says which fact lives where — the thing the roadmap did not answer. The next move is planning Phase 1, not planning again. |

---

## First thing, tomorrow

**Restart the four dead scheduled checks, and hide the session logs from your vault search.**

Ten minutes and one setting. By tomorrow morning the automation you already paid for is running again, and the vault you open holds roughly three hundred notes you actually wrote instead of eleven thousand, nine in ten of which are machine transcripts. Nothing is deleted. Nothing is irreversible. gbrain still sees every page.

That is the smallest thing that produces something you can see the same day. Everything else in this plan is built on the step after it — moving the "what needs doing" logic off the browser and onto the server, where a screen, a 7am message and every AI you plug in can all read the same answer.
