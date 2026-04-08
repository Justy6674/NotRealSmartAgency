---
created: 2026-04-08
tags: [notrealsmart, architecture, master-spec, creative-studio]
project: NotRealSmartAgency
status: approved
---

# NotRealSmart Agency — Complete Architecture Spec

## What NRS Is

NotRealSmart is a marketing agency replacement. Not a content creation tool. Not a social media scheduler. An AI-powered marketing agency that diagnoses why a business isn't growing and prescribes the fix.

**The customer** is a business owner — a mechanic, a SaaS founder, a healthcare clinic, a fragrance seller — who can't afford $5K/month for a human agency. They don't know what content type works where. They don't have time to learn 6 platforms. They just know their business is good and nobody's finding it.

**The Director** doesn't make posts. The Director diagnoses the business, builds a 30-60-90 plan, and coordinates 13 specialist departments to execute it. Posts are just one output. The real product is strategy + execution + learning.

**Human oversight** is mandatory at every publishing step. AI assists, human decides. Nothing goes live without human approval. Especially for healthcare brands where AHPRA/TGA violations cost $60K per offence.

---

## The Three Areas

```
DIRECTOR'S OFFICE          CREATIVE STUDIO              COMMAND CENTRE
(Strategy & Intelligence)  (Content Pipeline)           (Operations & Analytics)
                          
  Chat with Director        Create → Review → Schedule   Agents | Costs | Analytics
  Marketing audit           + Media Pantry               Activity | Approvals
  30-60-90 plans           
  Brand diagnosis           ← Director drives this →     ← Results feed back →
```

### 1. Director's Office (Entry Point)

The first thing every user sees. The Director greets them with intelligence, not a blank chat.

**First visit (new brand):**
- Director scans website, socials, competitors (automated during brand setup)
- Presents: "Here's what I found. Here's what's working. Here's what's broken."
- Builds initial 30-60-90 marketing plan
- User approves or adjusts the strategy

**Returning visits:**
- "You have 2 drafts waiting for review"
- "Your Instagram carousel from Tuesday got 3x your average engagement — want to repurpose it for LinkedIn?"
- "You haven't posted in 5 days — your strategy says 3x/week minimum"
- "Your competitor launched a new campaign — here's what they're doing"

**Via MCP (Cowork, Claude Desktop, any AI client):**
- "Tell my Director I want to promote my new service"
- Director creates draft → lands in Review on web UI
- Human approval step NEVER gets skipped

**What the Director knows (permanently, getting smarter):**
- Brand proforma (21 sections: audience, goals, competitors, compliance, channels)
- Platform algorithms and best practices (embedded knowledge, updated)
- What's worked before (performance data feeds back into strategy)
- Industry-specific context (researched during onboarding and ongoing)
- Compliance rules (AHPRA/TGA for healthcare, general advertising standards)

### 2. Creative Studio (Content Pipeline)

Four rooms. Content flows through them like a pipeline.

#### Room 1: CREATE

**Purpose:** Build content. Human leads, AI assists each section.

**Entry points:**
- User clicks "Create" tab
- Director suggests "You need an Instagram carousel" → user says "do it" → Director pre-fills the Create room
- User bypasses entirely: "I've got this one" → blank Create room
- Via MCP: Director creates draft → goes straight to Review (skips Create UI)

**Step 1: Pick content type** — the ENTIRE form changes based on selection:

| Content Type | Form Shows | Best Platforms |
|---|---|---|
| **Single Post** | 1 image slot + caption editor + hashtags | All platforms |
| **Carousel** | Slide builder (2-10 numbered slots) + text per slide + brand templates | Instagram, LinkedIn, Facebook |
| **Short Video** | Video upload/record + script editor + caption overlay + thumbnail | TikTok, Reels, Shorts |
| **Long Video** | Video upload + title + description + thumbnail + tags + categories | YouTube, LinkedIn, Facebook |
| **Story** | Image/video slot (9:16) + sticker/text overlay + poll/question tools | Instagram, Facebook |
| **Advertisement** | Ad creative + headline + body + CTA button + audience notes | Meta Ads, Google Ads, LinkedIn Ads |

Each content type opens a COMPLETELY DIFFERENT tailored form — like Scent Sell's form is built specifically for fragrances.

**Step 2: Pick platforms** — only shows platforms the brand has enabled (configured during brand setup):
- Scent Sell might have: Instagram, Facebook, YouTube (no TikTok)
- TeleScribe might have: LinkedIn, YouTube
- A mechanic might have: Facebook, Instagram, Google Business
- Incompatible platforms greyed out based on content type

**Step 3: Add media** — from the pantry:
- Upload from computer/phone (drag-drop)
- Pick from Media Pantry (tagged, organised library)
- Import from Canva
- AI generate (Director creates via image tools)
- Dashed-border slots with required/optional indicators (Scent Sell pattern)
- Aspect ratio guides per platform

**Step 4: Write content** — caption, description, script depending on type:
- "Use Template / Start Fresh" toggle
- AI generates draft caption → human edits
- AI action pills per section: "Make punchier", "Add a hook", "Shorten", "More professional"
- Per-platform version editor (if 2+ platforms — different caption per platform)
- Character count with platform limits
- Director Assist button on each section (not global — per section)

**Step 5: Preview** — see how it looks on each platform:
- Phone-frame mockups (Instagram, Facebook, LinkedIn, TikTok, YouTube, X)
- Live-updating as you type
- Desktop: right pane. Mobile: floating preview button → bottom sheet.

**Step 6: Save** — bottom action bar (Scent Sell sticky bar pattern):
- **Save Draft** → goes to Review room
- That's it. No "Publish Now" here. Publishing is in Schedule room after Review.

**AI interaction in Create:** Each section has its own Director Assist amber pill. The Director delegates to the right sub-agent:
- Caption section → Content & Copy agent
- Hashtag section → SEO agent
- Compliance section → Compliance agent
- Media section → Brand agent
- The user never sees departments. Just "Ask Director" per section.

#### Room 2: REVIEW

**Purpose:** Quality gate. All drafts land here — whether created by human in Create room, or by Director via chat/MCP.

**What it shows:**
- List of all drafts for the active brand
- Each draft as a card: platform icon, caption preview, media thumbnail, status, date
- Click a draft → full editor opens (can edit caption, swap media, change platforms)
- AI auto-review results shown per draft:
  - Compliance check (pass/fail/warnings) — for health brands, must pass before approve
  - Brand voice score (does it sound like your brand?)
  - Platform optimisation tips (character count, hashtag count, image ratio)

**Actions per draft:**
- **Approve** → moves to Schedule room
- **Edit** → modify anything, stays in Review
- **Reject** → archived, or send back with feedback note
- **Comment** → team discussion thread (for businesses with team members)
- **Ask Director to review** → Director runs full compliance + brand voice + competitor context check

**For healthcare brands:** Approve button is DISABLED until compliance passes. The system protects the user from $60K fines.

**Team workflow:** Team members (invited via email) can see drafts, comment, but only owners/admins can approve. Role-based: owner, admin, viewer.

#### Room 3: SCHEDULE

**Purpose:** Calendar view of approved content. Pick timing. Publish.

**What it shows:**
- Month/week calendar view with approved posts on each day
- Colour-coded by platform (Instagram pink, LinkedIn blue, YouTube red, etc.)
- Gaps visible — "Your strategy says 3x/week, you only have 1 scheduled this week"
- Director can suggest times: "Best time to post on Instagram for your audience: Tue/Thu 6pm AEST"

**Actions:**
- **Drag-drop** to reschedule
- **Click post** → see full details + preview
- **Publish Now** → immediate via Mixpost (self-hosted) / direct platform APIs
- **Schedule** → pick date/time, cron publisher handles it
- **Fill gaps** → Director auto-creates drafts for empty slots (go to Review first)

**Published posts → Analysis loop:**

Published posts don't disappear. They move to a "Published" state and gain:
- **Performance tracking** — likes, shares, saves, comments, reach, clicks (pulled from platform APIs)
- **Benchmarking** — "This got 3x your average engagement" or "Underperformed vs similar posts"
- **Director learning** — "Carousels about new arrivals outperform product shots by 200%"
- **Re-publish options:**
  - Repurpose for another platform (Instagram → LinkedIn with adjusted caption) → goes to Create pre-filled
  - Re-share evergreen content (worked 3 months ago, share again) → goes to Review
  - Create variation (same topic, different format: post → carousel → video) → goes to Create
- All re-published content goes through Review again before publishing

#### Media Pantry (Always Accessible)

**Purpose:** Your asset library. Upload, organise, tag, pull into any creation.

**Accessible from:**
- Its own tab in Creative Studio
- From inside Create room (Library button in media slots)
- Director can search it: "Show me fragrance photos tagged 'carousel'"

**Features:**
- Upload from computer/phone (drag-drop, batch)
- Import from Canva (existing integration)
- AI generate images (Director creates)
- Tags per brand (auto-tagged on upload, manually editable)
- Collections (group assets for campaigns)
- Search by filename, tags, transcription
- Filter by type (images, videos, audio)
- Usage tracking (which media used in which posts, how many times)
- Per-brand separation (Scent Sell assets never mix with TeleScribe)

---

### 3. Command Centre (Operations)

Existing rooms, kept as-is. The Director's performance data.

- **Agents** — see what the 14 departments are doing, org chart, budget per agent
- **Costs** — how much AI spend per brand, per agent, per month
- **Analytics** — what's working across all platforms, engagement trends, audience growth
- **Activity** — audit trail of everything (who created, who approved, when published)
- **Approvals** — legacy queue (folded into Review room going forward)

---

## Platform Configuration (Per Brand)

Each brand configures which platforms they use during brand setup. The Director and Create room only show relevant platforms.

**Supported platforms (launch):**
- Instagram (Feed, Reels, Stories, Carousels)
- Facebook (Feed, Reels, Stories, Groups)
- LinkedIn (Feed, Articles, Documents)
- YouTube (Videos, Shorts)
- X / Twitter (Tweets, Threads)

**Supported platforms (later):**
- TikTok (pending app review)
- Reddit
- Google Business Profile
- Pinterest

**Per-brand settings:**
- Which platforms are active
- Connected accounts per platform (via Mixpost OAuth or direct)
- Post signature (mandatory attribution per brand)
- Compliance flags (AHPRA, TGA, general)
- Content pillars (what topics to post about)
- Posting frequency targets (3x/week, daily, etc.)

---

## Director Intelligence (Permanent Learning)

The Director gets smarter over time. This is the product's moat.

**What the Director learns:**
- Which content types perform best for each brand
- Which platforms drive the most engagement
- What time of day gets the best reach
- Which topics resonate with the audience
- What competitors are doing
- What the brand voice sounds like (from approved posts)
- Industry trends (daily research cron)

**How it learns:**
- Performance data from published posts (likes, shares, reach)
- User decisions (what they approve, reject, edit)
- Brand proforma updates (strategy changes)
- Memory system (currently keyword-based → planned: semantic via mem0/pgvector)

**How it uses knowledge:**
- Pre-fills Create room with suggestions
- Flags gaps in Schedule ("You need 2 more posts this week")
- Warns about trends ("Your engagement is dropping — try short video")
- Competitor alerts ("Your competitor just launched X")
- Monthly reports ("Here's what worked, here's next month's plan")

---

## Access Methods

All hit the same Director, same agents, same brands, same data.

| Method | Best For | How It Works |
|---|---|---|
| **Web app** | Full creation experience | notrealsmart.com.au/agency |
| **Claude Desktop** | Quick asks, review on-the-go | MCP connector → chat_with_director |
| **Claude Mobile** | Approve/reject from phone | MCP connector → same tools |
| **Cowork (VS Code)** | Developers, power users | MCP in config → Director in sidebar |
| **Any MCP client** | Future AI clients | Bearer token or OAuth |

**Rule:** Regardless of access method, published content always requires human approval via the Review step. MCP-created drafts land in Review on the web UI.

---

## Content Type Intelligence

The Director knows which content type works best for each platform and situation. This knowledge is permanently embedded and continuously updated.

### Carousel / Slides
- **Best on:** Instagram (2x engagement vs single post), LinkedIn (3x reach vs text), Facebook
- **Best for:** Product features, how-tos, tips lists, before/after, testimonials
- **Why:** Algorithm rewards swipes. Users spend 2-3x longer. Saves drive revisits.
- **Director tip:** "Slide 1 is your hook. Last slide = CTA."

### Short Video / Reel
- **Best on:** TikTok (discovery), Instagram Reels (reach boost), YouTube Shorts (subscriber growth)
- **Best for:** Behind-the-scenes, quick tips, product demos, trending audio, unboxings
- **Why:** Highest organic reach of ANY format. Pushed to non-followers. First 3 seconds decide everything.
- **Director tip:** "Hook in 1 second. No intros. Start mid-action."

### Single Post
- **Best on:** All platforms. LinkedIn text-only outperforms images. X is text-first.
- **Best for:** Announcements, quotes, single product shots, memes, questions
- **Why:** Fast to create. Good for consistency. Text posts on LinkedIn get 2x comments.
- **Director tip:** "On Instagram, 4:5 portrait gets 30% more screen real estate than 1:1."

### Long Video
- **Best on:** YouTube (SEO powerhouse), LinkedIn (thought leadership), Facebook (groups)
- **Best for:** Tutorials, interviews, case studies, webinars, educational series
- **Why:** YouTube is #2 search engine. Long videos rank in Google. Evergreen = traffic for years.
- **Director tip:** "Thumbnail + title = 80% of clicks."

### Story
- **Best on:** Instagram Stories (500M daily users), Facebook Stories
- **Best for:** Polls, flash sales, behind-the-scenes, daily updates, countdown to launch
- **Why:** Urgency (24 hours). High view rates for existing followers.

### Advertisement
- **Best on:** Meta Ads (IG+FB), Google Ads, LinkedIn Ads (B2B)
- **Best for:** Lead generation, product launches, retargeting, brand awareness
- **Why:** Paid reach bypasses algorithm decline. Targeted to specific audiences.

---

## The Learning Loop (Published → Analyse → Learn → Improve)

Content doesn't end at "Published". The pipeline is a loop.

```
Create → Review → Schedule → Published
                                  ↓
                             ANALYSE
                        (performance data)
                                  ↓
                              LEARN
                     (Director updates strategy)
                                  ↓
                    ┌─────────────┼─────────────┐
                    ↓             ↓             ↓
              Repurpose      Re-share      New content
            (same content,  (evergreen,    (informed by
             new platform)  new caption)    what worked)
                    ↓             ↓             ↓
                    └─────→ Review ←────────────┘
```

**Analysis shows per published post:**
- Engagement metrics (likes, comments, shares, saves, reach, clicks)
- Benchmark comparison ("3x your average" or "underperformed")
- AI insights ("This performed well because of the hook in slide 1")
- Re-publish options (repurpose, re-share, create variation)

**Director uses this to:**
- Update the 30-60-90 plan
- Adjust content type recommendations
- Shift platform focus
- Refine brand voice understanding
- Report monthly to the business owner

---

## Design Principles (Carved in Stone)

1. **The Director diagnoses, the human decides.** AI suggests, human approves. Always.
2. **Each content type = completely different form.** Not generic. Tailored like Scent Sell.
3. **Platform list is per-brand.** User configures during setup. Director only shows relevant platforms.
4. **Nothing publishes without human review.** Healthcare or not. Review room is mandatory.
5. **The pipeline is a loop.** Published → Analyse → Learn → Create again.
6. **Media Pantry is always accessible.** From any room, any time. The ingredients.
7. **AI integrated per section, not globally.** Each form section has its own Director Assist.
8. **MCP access follows the same rules.** Drafts from any client land in Review. Human approves on web.
9. **The Director gets smarter.** Performance data feeds back into strategy. Permanent learning.
10. **Simple, easy, intuitive.** Like Instagram's creator, not like an enterprise dashboard.

---

## Technical Notes

### Tab Structure Change
```
BEFORE: All Content | Calendar | Media | Create | Grid Planner  (default: All Content)
AFTER:  Create | Review | Schedule | Media  (default: Create)
```

- Grid Planner folded into Create room (for Instagram carousels)
- All Content dashboard folded into Command Centre
- Calendar becomes the Schedule room

### Existing Components Reused
- 37 production-ready components (see CLAUDE.md for full list)
- PostEditor, PlatformVersionEditor, HashtagSection, ComplianceSection
- All 7 platform mockup previews
- MediaSelector, MediaLibrary, CanvaImportModal
- ApprovalActions, CommentThread
- EnhancedCalendar, CalendarActions
- All API endpoints unchanged

### New Components Needed
- Content-type-specific form components (carousel builder exists, others need building)
- ReviewRoom.tsx — draft list with approval workflow
- AnalysisPanel.tsx — published post performance view
- Platform configuration UI (brand settings)
- Director strategy context bar (shows in Create room header)
