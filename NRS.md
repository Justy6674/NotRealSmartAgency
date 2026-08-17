# NRS.md — what every AI must do for every business

This is the onboarding contract for NotRealSmart Agency. It applies to **new** businesses and to a **catch-up pass** on businesses already in the account.

The person using the app is a non-technical business owner (and his wife). They talk. The Director does the work. They never see plumbing, never pick departments, and never open developer tools.

Read the flag on the business. Do not guess from the name.

---

## The rule

When a business is added, or when this file says a current business is incomplete, the AI must **find, store, and then use** what is true about that business. If a fact is missing, say it is missing. Never invent a colour, a logo, a GitHub repo, a product name, a social handle, or a health claim.

Same treatment for every business. Justin’s own brands are not a special class that can stay hollow.

---

## What “done” looks like for one business

A business is ready for the Director only when all of these are true, or explicitly marked unavailable with a reason:

1. **Name** is stored exactly as the owner writes it.
2. **Website** is scanned (real pages, not a guessed summary).
3. **Sitemap / page list** is stored (or “no sitemap found”).
4. **Colours, fonts, voice, tagline, key messages** come from the live site, not from the model’s memory.
5. **Logo** is a real file URL the Director can show. A relative path like `/brand-logos/…` is not done.
6. **Code & hosting** is linked if a GitHub repo exists. The product README and recent commits are stored as `github_context`.
7. **Connections** the owner actually has are linked: social accounts, website, Canva, Google, Code & hosting, Email.
8. **Health toggle** is set by the owner. If it is on, the health rules below are injected. If it is off, do not add them.
9. The 21-section marketing profile exists (even if some sections are still thin).
10. Nothing in the profile was invented to look complete.

If any of 1–8 failed, the Director’s first job is to finish that, not to write posts.

---

## What to do, in order

### 1. Ask only what the site cannot tell you

Need: business name, website if they have one, whether it is healthcare (the Health toggle).

Do not show a blank form. Chat is enough.

### 2. Scan the website

Use the existing website scan. It must render the live page. Do not parse raw HTML and guess.

Store:

- what the business actually says it does
- pages found (home, about, services, contact, blog if any)
- screenshot evidence of the live site
- unknowns, labelled as unknowns

If there is no website, say so and skip. Do not invent one.

### 3. Read the sitemap

Use the existing sitemap discovery (`robots.txt` + `sitemap.xml`). Store the page list on the business. Cap the crawl. Do not wander the whole internet.

This is how the Director knows the site’s shape: services pages, locations, blog, legal pages. Without it, later “website” and “Google searchability” work is guessing.

### 4. Pull branding from the site, not from memory

Use the existing brand-kit extraction.

- **Colours** come from the site’s CSS. The model must not pick a palette.
- **Fonts** come from the site.
- **Voice, words to avoid, tagline, key messages** come from copy that is actually on the site.
- **Logo** is downloaded from the live site (favicon / header logo). If it cannot be loaded as a public URL, it is not stored as done.

Never fill a gap with a “close enough” colour or a generated logo unless the owner asked for a new one.

### 5. Connect GitHub if there is code

If a repo URL is known, bind it through the existing GitHub App (read-only product docs and commit metadata). Store `github_context`.

If the URL is wrong, or the App cannot see the repo (different GitHub organisation), say that plainly. Do not point at a dead or renamed repo and pretend it is current.

Git is optional. A florist with no code is still a complete business. A software product with no Git link is incomplete.

### 6. Link the connections the owner actually uses

Connections already listed in the app: Social accounts, website, Canva, Google, Code & hosting, Email.

- Link what they have. Do not nag them to connect things they do not use.
- Social publishing goes through NRS’s own “post” door. The owner sees Save draft / Pick a time / Next free slot / Post now. They never see vendor names.
- One social account belongs to one business. Never cross-post between businesses.

### 7. Build the living marketing profile

The 21-section profile is filled from what was scanned, not from a blank questionnaire. Thin sections stay thin until there is evidence.

### 8. Then, and only then, advise

Strategy, posts, blogs, ads, and “what to do this week” come after the facts are stored. A confident Director with an empty brand kit is the failure this file exists to stop.

---

## Catch-up on businesses already in the account

New businesses are not enough. Every current business gets the same pass.

Checked live 2026-08-17 against the `brands` table:

| What | State now |
|---|---|
| Name, website, logo URL, colours, voice rules | Present on all 14 rows |
| GitHub URL stored | Most rows have a URL |
| GitHub actually read into `github_context` | Only **Do Today** and **TeleScribe**. The other twelve are still unread |
| Social publisher profile linked | Only **Scent Sell** and **EndorseMe** |
| Logo that an outside AI can load | **Tele360** is still a relative path (`/brand-logos/tele360.png`) |

Catch-up order:

1. Run the existing project setup pass (`scripts/setup-projects.ts`) so GitHub + sitemap + brand kit run on every current business. Dry-run first.
2. Fix Tele360’s logo to a public URL, or mark the business inactive and leave it.
3. Confirm each GitHub URL still points at the live repo (Tele360 and Scent Sell have been wrong before).
4. Do not re-invent colours or voice that are already stored from the live site.

The 29 July 2026 audit that said “no palettes at all” is **stale**. Trust the live row, then fill what is still empty.

---

## If this business is healthcare

This section is **conditional**. It runs only when the business Health toggle is on (`compliance_flags.ahpra` and/or `tga`). Read the flag. Do not infer healthcare from the name.

Live on 2026-08-17:

- Health on, active: **Black Health Intelligence** (AHPRA), **Downscale Weight Loss** (AHPRA + TGA), **EndorseMe** (AHPRA), **TeleCheck Clinic** (AHPRA)
- Health on, currently inactive: **DownscaleDerm** (AHPRA + TGA), **Tele360** (AHPRA)
- Health **off** even though the product is health-adjacent: **TeleScribe**, **Do Today**, **TeleCheck**. Do not inject clinic rules there.

When health is on, the same rules are injected into the Director, blogging, ads, and the publish check. Failed copy never enters the library and never goes live.

In owner language, that means:

- No promises about results
- No patient stories or testimonials
- No before-and-after photos
- No naming of prescription medicines
- No “best”, “guaranteed”, or “number one” without evidence
- Individual results vary; a consult is required where treatment is mentioned
- AI-written copy carries the same legal risk as copy you typed yourself
- Penalties run to **$60,000 per offence**. If a health check cannot be completed, **stop**. Do not publish. Do not save the failed draft as an example for later.

The health checker stays inside NRS. The owner never sees vendor names for it. If the checker is down or unverified, fail closed.

Blogging for a health business shows **Checked before you publish** in red. That is a handover reminder, not a silent publish.

---

## Blogging

NRS writes the article and hands it over. **NRS never publishes the blog onto their website.**

What the owner does: copy the article (and images), paste it into their own site admin, then they click publish there. In NRS they can mark “I’ve put this on my site”.

For Justin’s own sites that already have a blog in the admin (EndorseMe is the example): NRS may place a **draft** into that admin queue. A person still opens the admin and publishes. That is not NRS publishing. Do not add an NRS button that goes live on their public blog.

---

## Social posts

Create post opens Social compose.

The owner can: Save draft, Pick a time, Next free slot, Post now.

Those four are enough. Do not add a second composer. Do not reverse the copy-paste blogging desk.

---

## Video

NRS already: uploads the clip, makes a thumbnail, transcribes it, writes captions, can shorten dead air, and can post it.

What the wife needs next is **trim this clip and post it**, inside compose. Not a new video-editor product.

Do not wrap an external editor into the app as the product. Desktop cutters and research video-agents can stay on the Mac for Justin. They are not the NRS screen.

---

## What never to invent

- Product names, fragrance notes, houses, perfumers (check first; if unverified, ask or write around it)
- Social handles that were not scanned or connected
- Colours, logos, fonts
- Health claims, item numbers, medicine names
- “Your Instagram is connected” when the account list for this business is empty
- A GitHub repo that was not actually read
- A publish success when the publisher returned pending or failed

---

## Connections and vendors — AI only

The owner never sees these names. AIs working in this repo must:

- Publish through `publishToPlatform` (one door). Do not call a vendor from a new route.
- Filter social accounts in **our** code after normalisation. The publisher does not isolate customers for us.
- Keep Mixpost as the live fallback for Justin’s own brands. Do not show it in the UI.
- Default new Director tools to Director-only. External AIs (Claude Desktop, Cowork, Codex) hand intent to the Director; they do not publish.

---

## First slice (do this next, not the whole wishlist)

Fill GitHub + sitemap on every current business using the pipelines that already exist. Then keep this file as the checklist the Director follows for every new business.

Do not, in that slice: build a new onboarding wizard, a video editor, a blog CMS, billing, or a full publisher-feature dump.
