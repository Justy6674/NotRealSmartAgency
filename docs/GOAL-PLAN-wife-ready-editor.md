# Goal: wife-ready editor (health businesses first)

Justin and his wife use NRS every day on their own health businesses. If she can blog and social-post quickly, on-plan, on-brand, with the restrictions handled, that is the product. Monetising comes later. Do not add Stripe, pricing, or subscriber tiers.

## Goal state (her words)

- Pick the business. Open **Blogging**. See posts in tabs. Copy the text the Director already wrote. Download the images. See the health checklist (only on a health business). Paste onto **their** site. Tick “I’ve put this on my site.” NRS never publishes the blog.
- Open **Social**. Caption and hashtags are already filled (Director). She reviews, crops, picks accounts, then **Save draft**, **Pick a time**, **Next free slot**, or **Post now**. Works with the Director rail collapsed.
- Work follows a **plan**: content pillars, “what to write next,” calendar / next free slot — not a blank page.
- Plumbing stays hidden. Zernio for linked brands, Mixpost as fallback, never named in the UI.
- AbeAI grounds the health check **inside NRS** (`use_abe_ai` / corpus on regulated brands). If AbeAI is unverified, the existing NRS compliance filter and publish/save gates still block. Do not migrate AbeAI’s database. Do not push other repos.

## Settled (do not re-litigate)

The ten interface decisions in `HANDOFF-2026-08-17.md` §5 and `docs/ARCHITECTURE.md`. Human drives; Director writes the words.

## Current → actions she will notice

| Now | Next click |
|---|---|
| Blogging is “not set up” | Tabs, copy-paste card, images, health checklist, what to write next |
| Compose is Save draft only; Post now talks to the Director | Post now / Pick a time / Next free slot / Save draft — real buttons |
| Image crop unused, carousel no reorder | After A/B: crop in compose, drag-reorder |
| Video “edit” talks to Director | Honest: post this clip as-is from compose |
| Dashboard chrome | After A/B: waiting-on-you counts that are real |

## Order

1. **Blogging** (this slice) — copy-paste workflow on `outputs` `blog_article`. No website publish. Health checklist only when `ahpra` or `tga`.
2. **Social compose** — Post now goes through `publishToPlatform`; pick a time; next free slot from posting schedule.
3. Image crop + carousel reorder in compose.
4. Video: upload as-is; no fake trimmer.
5. Dashboard to-do counts.

## Out of scope until he says yes

Billing, AbeAI production migrations, secret rotation, other repos, live NRS schema migrations.

## Director vs human

Director: captions, hashtags, blog drafts, “what to write next,” memory of the business (brand DNA, proforma, session memory).  
Human: review, tweak, crop, pick accounts, pick a time, copy blog text, approve, Post now.
