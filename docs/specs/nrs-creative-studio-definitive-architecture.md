---
created: 2026-04-09
tags: [notrealsmart, architecture, creative-studio, definitive, must-read]
project: NotRealSmartAgency
---

# NRS Creative Studio — Definitive Architecture

> **READ THIS BEFORE TOUCHING ANY CREATIVE STUDIO CODE. NO EXCEPTIONS.**

## Core Principle

NRS is a **hybrid human + AI creative workspace**. The human creates content with AI assisting at every step. The system teaches marketing as you use it. Over time the user delegates more to AI — but the human is always the creative director, never just an approver.

This is NOT an AI factory. This is NOT a form. This is a professional content studio like Canva meets Buffer, with an AI marketing director built in.

---

## The Creator is THE Centre

The Creator is the single workspace where ALL content is made and edited. It is not a "new post" form — it handles both creating new posts AND editing existing drafts. Everything flows TO the Creator and FROM the Creator.

### Three Entry Points

```
MEDIA LIBRARY                    CREATOR                     REVIEW / DRAFTS
┌──────────────┐                ┌──────────────────┐        ┌──────────────┐
│ Click media  │──"Start your──→│                  │←─"Alter"─│ Click draft │
│ item         │   post?"       │  10-card composer │        │              │
│              │                │  + live preview   │        │ Options:     │
│ Upload new   │                │  + Director chat  │        │ • Post now?  │
│ media here   │                │                  │        │ • AI review? │
└──────────────┘                │  Works for NEW   │        │ • Alter?     │
                                │  and EDITING     │        └──────────────┘
                                └────────┬─────────┘
                                         │
                                    Save Draft / Schedule / Publish
                                         │
                                         ↓
                                ┌──────────────────┐
                                │ REVIEW / DRAFTS  │
                                │ (with source     │
                                │  badges, filters,│
                                │  compliance)     │
                                └──────────────────┘
```

### Entry Point 1: Media Library → Creator
User uploads video/image → clicks on it → button: "Start your post?" → Creator opens with that media pre-loaded in the Media Slots card. User picks platforms, writes caption (or asks AI), previews, schedules.

### Entry Point 2: Creator (fresh start)
User clicks Create tab → empty Creator → picks media from library OR starts text-only → builds post. AI suggests content type, platforms, caption, hashtags, timing — user accepts/edits/ignores.

### Entry Point 3: Review/Drafts → Creator
User sees draft in Review tab → three action buttons:
- **"Post now"** → publish immediately (compliance check first for health brands)
- **"AI review"** → Director + Cowork evaluate content, give feedback in chat
- **"Alter"** → Creator opens with ALL draft fields pre-loaded (media, caption, hashtags, platform, schedule). User edits, saves back.

This means Creator component needs a `draftId` prop. If provided, it loads the existing draft for editing. If not, it's a new post.

---

## The 10-Card Creator (Scent Sell Pattern)

Built to spec from `2026-04-08-post-creator-redesign.md`. Card-based UI, each card is a collapsible section.

### Card 1: Media Slots
- Platform-aware aspect ratio indicators (1:1, 4:5, 9:16, 16:9)
- Pull from existing Media Library (picker)
- Upload new media inline
- AI: "Generate an image" button per slot
- Carousel: up to 10 slides with DnD reorder
- HEIC conversion, orientation fix

### Card 2: Platform Selector
- Visual cards with platform icons — NOT a dropdown
- Multi-select: pick 1+ platforms
- Each shows format requirements (char limits, aspect ratios, video length)
- AI suggests which platforms based on media type + strategy

### Card 3: Content Type
- Visual preset cards: Post, Carousel, Short Video, Long Video, Story, Ad
- Selection auto-adjusts other cards (carousel shows 10 slots, video shows different fields)
- AI suggests content type based on media + platform selection

### Card 4: Caption Editor
- AI auto-drafts caption based on media + brand context + strategy (user can ignore)
- Manual edit always available — this is the HUMAN's creative space
- Per-platform character count with warnings
- Per-platform version tabs (edit Instagram caption separately from LinkedIn)
- AI action pills: "Make punchier", "Add hook", "Make longer", "Simplify"
- Marketing guidance: "TikTok hooks need to grab in 1.5 seconds"

### Card 5: Hashtags
- Saved hashtag groups per brand (HashtagGroupPicker — already built)
- AI-suggested hashtags based on caption + niche
- Per-platform hashtag counts (30 IG, 5 TikTok, etc.)
- Trending hashtag suggestions

### Card 6: Post Template
- Saved templates with {variable} substitution (PostTemplatePicker — already built)
- AI suggests template based on content type
- 8 built-in variables: {brand}, {date}, {product}, etc.

### Card 7: Schedule
- Date/time picker
- AI: "Best time to post on {platform}" suggestion based on audience data
- "Next free slot" auto-scheduling (Blotato pattern)
- Timezone-aware (AEST)
- Calendar preview showing existing posts around chosen time

### Card 8: Compliance Check
- Auto-runs for AHPRA/TGA brands
- Warnings for claim language, before/after images, testimonials
- Green/amber/red ComplianceBadge (already built)
- Blocks publishing if red (health brands only)
- Non-health brands: skip this card

### Card 9: Live Preview
- Phone mockup previews (7 platform mockups — already built)
- Updates in real-time as caption/media changes
- Switch between platforms to see each version
- Side-by-side multi-platform view option

### Card 10: Sticky Action Bar
- **Save Draft** — saves to scheduled_posts with status 'draft', stamps metadata.source
- **Schedule** — picks date/time, saves with status 'scheduled'
- **Publish Now** — immediate via Mixpost/Blotato (compliance check first)
- **Ask Director** — sends current state to Director chat for feedback
- When editing existing draft: shows "Update Draft" instead of "Save Draft"

---

## Review / Drafts Tab

Already rebuilt (2026-04-09). Shows all drafts with:
- Source badges (AI Generate, Calendar Fill, Manual, Director, MCP/External)
- Platform icons
- Compliance status (green/amber/red)
- Filter by source, platform, compliance
- Batch actions (approve all, reject all, schedule all, Director review all)
- Three actions per draft: **Post now** / **AI review** / **Alter** (→ Creator)

When user clicks "Alter" on a draft, it navigates to Creator tab with `?draftId={id}` and Creator loads that draft for editing.

---

## Director + Cowork Integration

The Director chat panel is ALWAYS visible alongside the Creator.

### Director is the marketing expert
The Director is not just a chatbot — it's the expert marketer. It knows platform algorithms, audience behaviour, compliance rules, brand voice. It delegates to its 13 department agents (Content, SEO, Paid Ads, Compliance, Brand, etc.) behind the scenes. The user never sees departments — just the Director's expert advice.

The Director:
- Sees what the user is working on (media, caption, platform)
- Offers expert suggestions: "Your Instagram audience engages most with educational content"
- Delegates to Compliance agent for AHPRA/TGA checks
- Delegates to Content agent for caption drafting
- Delegates to Brand agent for voice consistency
- Runs multi-department meetings when needed (e.g. launch plan)
- Learns from user's approve/reject patterns over time

### Any AI can plug into the Director
Claude Code, Claude Desktop, Cowork, Grok, Gemini — any AI client connects via MCP (`/api/mcp`). They all talk to the Director, not directly to the system. The Director coordinates:
- Cowork says "Review my pending posts" → Director reviews, delegates to Compliance + Content agents, returns assessment
- Claude Desktop says "Fill my calendar for next week" → Director delegates to Strategy + Content, creates drafts
- Any AI → Director → 13 agents → results back through Director → AI responds to user

The Director is the single brain. External AI clients are interfaces to it.

### AI assists at every step (inline, not separate):
- Media: "Generate an image" button
- Platform: "Which platforms need content most?" suggestion
- Content type: auto-suggest based on media
- Caption: AI draft + action pills (punchier, add hook, etc.)
- Hashtags: AI suggestions + saved groups
- Schedule: "Best time to post" suggestion
- Compliance: auto-check for health brands
- Preview: real-time updates

---

## Marketing Intelligence (System Teaches)

The system embodies marketing knowledge. Not in a help centre — INLINE while the user works:

- **Platform benchmarks**: "Instagram carousels get 1.4x more engagement than single images"
- **Posting times**: "Your audience is most active Tuesday 10am and Thursday 7pm AEST"
- **Content mix**: "You haven't posted educational content in 2 weeks — that pillar performs well"
- **Caption guidance**: "LinkedIn optimal length is 150-300 words. You're at 45."
- **Compliance**: "$60K AHPRA fine risk — remove 'guaranteed results' from this caption"
- **Competitor context**: "Competitor X just posted about this topic — differentiate with your angle"

This knowledge comes from:
- `social-media-benchmarks.ts` (platform algorithm intelligence — already built)
- Brand proforma (audience, pillars, compliance flags)
- Historical post performance (analytics)
- Agent memories (what the user approves/rejects)

---

## Navigation Architecture

Creative Studio has 4 tabs (this is correct, don't change):

```
[ Create ]  [ Review (6) ]  [ Schedule ]  [ Media ]
```

- **Create** = The 10-card Creator (new + edit mode)
- **Review** = Drafts pipeline with source/compliance/filters (built 2026-04-09)
- **Schedule** = Calendar with drag-and-drop, weekly/monthly views
- **Media** = Upload, browse, tag, smart retag, Generate button

The tabs represent the content pipeline. The flow between them is:
- Media → Create (via "Start your post?" button)
- Create → Review (via "Save Draft")
- Review → Create (via "Alter" button)
- Review → Schedule (via "Approve" / "Schedule")

Director chat panel is always visible on the right side of all tabs.

---

## What Already Exists (Reuse, Don't Rebuild)

### Components
- 7 platform phone mockups (`src/components/agency/studio/preview/`)
- ImageEditorModal with 13 crop presets (`src/components/agency/studio/editor/`)
- HashtagGroupPicker (`src/components/agency/studio/hashtags/`)
- PostTemplatePicker (`src/components/agency/studio/templates/`)
- DnD SortableImageGrid (`src/components/agency/studio/dnd/`)
- PlatformVersionEditor (`src/components/agency/studio/post/`)
- MediaUploader with progress bar (`src/components/agency/MediaUploader.tsx`)
- ComplianceBadge (`src/components/agency/studio/review/`)
- DraftCard, ReviewFilters, BatchActions (`src/components/agency/studio/review/`)

### APIs
- `POST /api/scheduled-posts` — create drafts (with metadata.source)
- `PATCH /api/scheduled-posts` — edit drafts (with metadata merge)
- `GET /api/scheduled-posts?status=draft` — fetch drafts
- `POST /api/media/process` — background AI processing
- `POST /api/media/retag` — retroactive smart tagging
- `POST /api/compliance-check` — AHPRA/TGA compliance
- `POST /api/media/{id}/generate` — AI caption generation
- `GET /api/hashtag-groups` — saved hashtag groups
- `GET /api/post-templates` — saved post templates

### Libraries
- `src/lib/post-versions.ts` — PLATFORM_CHAR_LIMITS, createVersionsFromMaster
- `src/lib/template-variables.ts` — 8 built-in variables, resolveTemplate()
- `src/lib/media/auto-tagger.ts` — deterministic + AI tags
- `src/lib/agents/compliance-filter.ts` — AHPRA/TGA + brand voice checks
- `src/lib/agents/knowledge/social-media-benchmarks.ts` — platform algorithm intelligence

---

## What Needs Building (in order)

1. **Creator component rewrite** — full 10-card spec, supports `draftId` prop for edit mode
2. **Media Library "Start your post?" button** — navigates to Creator with mediaId
3. **Review tab "Alter" action** — navigates to Creator with draftId
4. **Inline AI suggestions** — marketing guidance surfaced contextually in each card
5. **Cowork MCP awareness** — Director knows about Creator state, can review with Cowork

---

## Competitor Patterns Stolen (Research 2026-04-09)

| Pattern | From | How NRS Uses It |
|---------|------|-----------------|
| Source-first creation (paste anything → AI generates) | Blotato | Media → Generate → Creator |
| "Next free slot" auto-scheduling | Blotato | Schedule card AI suggestion |
| AI sidebar during editing | Blotato, Buffer | Director chat alongside Creator |
| Per-platform caption tabs | Meta, Buffer | Card 4: Caption Editor |
| Formal draft → approval → queue pipeline | Buffer | Review tab with source tracking |
| Media Library drag-to-calendar | Later | Media → Calendar (future) |
| Instagram grid visual planner | Later | Grid Planner (already built) |
| "Optimal times" AI suggestion | Meta, Later | Card 7: Schedule |
| Content status filters | Meta, Buffer | Review tab filters |
| OwlyWriter AI as inline button | Hootsuite | AI action pills in Caption Editor |
| Design-first then schedule | Canva | Media → Creator → Schedule flow |

---

## Rules

1. **Never build a separate "edit post" screen.** The Creator IS the editor.
2. **Never show raw forms.** Card-based, visual, with AI pre-filling where possible.
3. **Never hide the Director.** Chat panel is always visible in Creative Studio.
4. **Never require the user to know system architecture.** They pick media, write words, schedule. That's it.
5. **Never skip compliance for health brands.** Auto-check, block if red.
6. **Always stamp metadata.source** on every draft creation path.
7. **Always teach marketing inline.** Platform benchmarks, timing suggestions, content mix advice — inside the Creator, not in a help page.

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]

---
**Related entity:** [[Reference/wiki/entities/scentsell|scentsell]]
