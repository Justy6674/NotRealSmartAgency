# Creative Studio Rooms — Design Spec

## Context

The Creative Studio Create tab currently shows 6 dead intent cards that don't work. The buttons either don't fire (broken Zustand effect chain) or navigate away from the Studio. The cards send generic messages ("Write a post for TeleScribe") with no brand context, strategy awareness, or integration with the agent system.

This spec redesigns the Create tab as a **launchpad into 6 full-screen creation workspaces** (rooms), each connected to the full agent system, memory, strategy, and all integrations (Mixpost, Canva, HeyGen, OpenClaw Video Toolkit).

## Founding Principles

1. **The user has OPTIONS** — AI does it, edit yourself, or both. An agency serves all types of users.
2. **Strategy guides everything** — the Strategist agent ensures content aligns with the plan, mix, and goals. No ad-hoc posting.
3. **Director reviews everything** — nothing gets published without Director quality gate + compliance check + memory storage.
4. **Same brain everywhere** — all rooms share agent memory, brand context, outputs, calendar, and media library.
5. **Non-technical user** — one click to value. The UI guides, the AI does the hard work.

---

## Architecture

### Routes

```
/agency/studio              → Dashboard (All Content tab — existing)
/agency/studio/video        → Video Room
/agency/studio/design       → Design Room
/agency/studio/post         → Post Composer
/agency/studio/campaign     → Campaign Planner
/agency/studio/repurpose    → Content Repurposer
/agency/studio (Calendar)   → Calendar (existing tab, enhanced)
```

### Shared Brain Layer

Every room connects to the same systems:

- **Agent memory**: `nrs-{brandSlug}-{agentType}` namespaces. Every action stores insights. Every agent can recall past work from any room.
- **Brand context**: strategy, DNA, pillars, compliance, voice, competitors — auto-injected into every agent prompt via `buildSystemPromptWithMemory()`.
- **Output library**: all rooms save to `outputs` table. Content created in any room is visible everywhere.
- **Scheduled posts**: all rooms can add to `scheduled_posts`. Calendar shows everything.
- **Media library**: Supabase Storage `media` bucket. Videos, images, designs accessible from any room.
- **Chat panel**: Director follows into every room. Same conversation, same memory. Communication via `nrs-send-chat` DOM event (bypasses broken Zustand chain).
- **Mixpost**: all rooms know which platforms are connected and publish through the same cron pipeline.
- **Audit log**: every agent action logged, visible in Agent Activity on the dashboard.

### Strategy Layer (The Strategist as Guardrail)

Before content is created in ANY room, the Strategy agent pre-calculates what's needed:

- Content mix target (80/20 value vs promotional, or brand-specific)
- Content type balance (entertainment / education / inspiration / promotional)
- Platform allocation vs actual (channel_strategy percentages)
- Content pillar rotation (don't repeat — cycle through all pillars)
- Posting frequency target vs actual
- 30/60/90 day plan milestones

**StrategyBrief component** renders at the top of every room with a smart one-liner:
> "LinkedIn needs attention this week. Rotate to 'Practitioner wellbeing'. Suggestion: an entertaining post."

**useStrategyContext() hook** calculates what's needed from: `scheduled_posts` (this week), `brand.channel_strategy`, `brand.content_pillars`, agent memory (what's worked), proforma `thirty_sixty_ninety`.

When "AI does it" is clicked, the strategy context is automatically embedded in the message to the Director. Not generic "write a post" — contextualised "write an entertaining LinkedIn post about practitioner wellbeing to fill this week's gap."

### Content Tagging

Every output and scheduled post gets tagged:
- `content_type`: entertainment | education | inspiration | promotional
- `content_pillar`: which pillar it serves (from brand's content_pillars array)
- `platform`: target platform

Strategy agent tracks these tags to maintain ratios.

### Director Quality Gate

Every room's output follows this lifecycle:

```
User creates content → Specialist agent does work → Director reviews:
  ├── AHPRA/TGA compliance check (if health brand)
  ├── Brand voice consistency (against DNA)
  ├── Strategy alignment (fits the plan?)
  ├── Cross-brand awareness (sibling brand opportunities?)
  └── Quality gate (publish-ready?)
→ Director approves → Saves to outputs + memory
→ Memory updated (agent memory, brand memory, global memory, proforma)
→ Available everywhere (dashboard, calendar, repurposer, other agents)
```

---

## Room 1: Video Room (`/agency/studio/video`)

### Three Production Paths

**Path A: "AI does everything"**
- User picks topic or lets agent choose from content pillars + strategy needs
- Video agent writes script → compliance check
- Production path choice:
  - HeyGen: avatar presenter (premium, fast, 1-50 scenes, text overlays, emotions)
  - OpenClaw/Remotion: template-based (cheap, cloud GPU — Qwen3-TTS voiceover, FLUX.2 images, ACE-Step music)
- Auto-formatted for target platform dimensions
- Director reviews → save to outputs + optionally schedule

**Path B: "I want to edit"**
- Timeline editor (Twick — React SDK, MIT, modular, AI captions, serverless MP4 export)
- Import sources: local files, media library, Canva designs, HeyGen clips, OpenClaw renders
- Tracks: video, audio, text overlays, music
- AI assist on demand: auto-cut silence, add captions (Deepgram), suggest splits, improve quality
- Export to multiple formats simultaneously (9:16, 16:9, 1:1)

**Path C: "Bulk import + process" (C.A.M.)**
- Drag multiple videos → auto-transcribe → auto-generate captions for 6 platforms → auto-schedule
- AI auto-sort by topic/pillar
- Auto-thumbnail generation
- Batch platform formatting

### Components

- `VideoRoom.tsx` — main layout with mode selector (Create / Edit / Import)
- `VideoEditor.tsx` — Twick-based timeline editor
- `VideoAIPanel.tsx` — agent working panel, AI feature triggers
- `VideoExporter.tsx` — platform format selector + schedule/publish
- `StrategyBrief.tsx` — strategy context at top

### APIs

- `/api/video/render` — triggers OpenClaw/Remotion rendering on cloud GPU
- `/api/video/process` — ffmpeg operations (trim, concat, captions)
- Existing: `/api/video/generate` (HeyGen), `/api/video/status`, `/api/media/transcribe`

### Agent Integration

- Video agent (The Visual Director) — primary specialist
- Content agent — scripts on request
- Compliance agent — AHPRA/TGA review for health brands
- Brand agent — visual consistency
- Director — quality gate + memory storage
- Strategy agent — ensures content type/pillar/platform alignment

---

## Room 2: Design Room (`/agency/studio/design`)

### Three Creation Paths

**Path A: "AI designs it"**
- Brand agent creates via Canva API using brand kit, correct format for platform
- Director reviews for brand consistency

**Path B: "Browse and edit"**
- Gallery of Canva designs (thumbnails from `/api/canva/designs`)
- Click → opens in Canva editor (new tab) or inline preview
- Pull back → Director reviews → save/schedule

**Path C: "Upload my own"**
- Drag in images/graphics → Supabase media library
- Agent auto-resizes for all platforms
- Agent applies brand overlay (logo, colours)

### Components

- `DesignRoom.tsx` — gallery + create panel layout
- `DesignGallery.tsx` — Canva designs grid with search/filter
- `BrandKitPanel.tsx` — brand colours, fonts, logos as reference
- `FormatSelector.tsx` — IG Post, Story, FB, LI, TT, YT Thumb, A4
- `StrategyBrief.tsx` — strategy context

### APIs

- Existing: `/api/canva/designs`, `/api/canva/auth`, `/api/canva/callback`
- Canva Connect API: create design, resize, export, brand kit, templates

### Agent Integration

- Brand agent (The Brand Guardian) — primary specialist
- Content agent — matching captions
- Compliance agent — no before/after images for health brands
- Director — quality gate + memory

---

## Room 3: Post Composer (`/agency/studio/post`)

### Three Creation Paths

**Path A: "AI writes it"**
- Content agent writes platform-optimised post using strategy context
- Auto-generates variants per platform if multiple selected
- Director reviews → compliance → save as draft

**Path B: "I write, AI assists"**
- Rich text editor (Tiptap — headless, Next.js native, shadcn compatible)
- Live platform previews (Instagram, LinkedIn, X, TikTok, Facebook mock-ups)
- Character counter per platform (2200 IG, 3000 LI, 280 X)
- AI on demand: suggest hashtags, check compliance, shorten for X, make more engaging, generate variants

**Path C: "Pick from drafts"**
- Browse existing drafts from outputs/scheduled posts
- Edit, enhance, schedule

### Components

- `PostComposer.tsx` — editor + preview layout
- `PostEditor.tsx` — Tiptap-based rich text editor
- `PlatformPreview.tsx` — mock-ups of how post looks on each platform
- `HashtagSuggester.tsx` — AI-powered hashtag recommendations
- `PostScheduler.tsx` — date/time picker with best time suggestions
- `StrategyBrief.tsx` — strategy context

### APIs

- Existing: `/api/scheduled-posts`, `/api/outputs`
- Existing tools: `fill_calendar`, `write_blog`, `manage_posts`

### Agent Integration

- Content agent (The Storyteller) — primary specialist
- SEO agent — hashtag intelligence, keyword integration
- Compliance agent — AHPRA/TGA review
- Director — quality gate + memory
- Strategy agent — content type/pillar guidance

---

## Room 4: Campaign Planner (`/agency/studio/campaign`)

### One Creation Path — Director Convenes the Agency

- User describes campaign goal
- Director runs `convene_meeting` with 6 departments in parallel:
  - Strategy: timeline, milestones, success metrics
  - Content: social posts, blog articles, scripts
  - SEO: keyword targets, landing page optimisation
  - Email: nurture sequence, launch announcement
  - Paid Ads: ad copy, targeting, budget allocation
  - Compliance: AHPRA/TGA review of everything
- Results displayed in Gantt-style timeline with expandable department cards
- "Generate assets" buttons trigger delegation to produce actual content
- Everything saves to outputs + calendar

### Components

- `CampaignPlanner.tsx` — brief input + timeline view
- `CampaignBrief.tsx` — name, goal, duration, audience, budget inputs
- `CampaignTimeline.tsx` — Gantt-style view (SVAR React Gantt or custom)
- `DepartmentCard.tsx` — shows each agent's contribution with expand/generate

### APIs

- Existing: `convene_meeting` tool, `delegate_to_agent` tool
- Existing: `/api/outputs`, `/api/tasks`

### Agent Integration

- Director — orchestrates meeting, reviews all outputs
- All 6 department agents run in parallel
- Strategy agent — ensures campaign aligns with 30/60/90 plan

---

## Room 5: Content Repurposer (`/agency/studio/repurpose`)

### Two Creation Paths

**Path A: "Transform one piece"**
- Select source (from outputs, media library, or paste text/URL)
- Transformation cards for every platform:
  - Blog → IG caption, LI article, X thread, TT script, email snippet, YT description
  - Video → transcription → social quotes, blog, email, audiogram
  - Post → other platform versions
- Each card shows preview with character count, hashtags, formatting
- "Generate All" runs Content agent for all variants
- Director reviews each → compliance → save as drafts

**Path B: "Bulk repurpose"**
- Multi-select sources → batch transform
- Agent auto-assigns content types and pillars
- Auto-schedules based on strategy
- Director reviews batch

### Components

- `RepurposeRoom.tsx` — source selector + output grid
- `SourceSelector.tsx` — browse outputs, media, or paste content
- `TransformCard.tsx` — per-platform variant with edit/schedule actions
- `BulkRepurpose.tsx` — multi-select + batch generate

### APIs

- Existing: `repurpose_content` tool, `query_outputs` tool
- Existing: `/api/outputs`, `/api/scheduled-posts`

### Agent Integration

- Content agent (The Storyteller) — primary transformer
- SEO agent — platform-specific hashtags/keywords
- Compliance agent — AHPRA/TGA per platform
- Director — quality gate + memory
- Strategy agent — ensures repurposed content fills strategy gaps

---

## Room 6: Calendar Enhancement

Existing `ContentCalendar.tsx` enhanced with:

- **Drag-and-drop**: FullCalendar or DayPilot Lite React component
- **Strategy overlay**: shows posting frequency target vs actual, platform distribution bar
- **Bulk actions**: approve all drafts, fill empty slots via AI, reschedule failed
- **All-room integration**: videos, posts, designs from every room appear here
- **Director fills gaps**: "You're light on Instagram this week, want me to create 2 posts?"
- **Content type tags visible**: entertainment / education / inspiration / promotional badges on each post

---

## Create Tab (Launchpad)

The Create tab becomes 6 door cards that open into full-screen rooms:

| Card | Route | Primary Agent |
|------|-------|---------------|
| Create a Video | `/agency/studio/video` | Video (The Visual Director) |
| Design in Canva | `/agency/studio/design` | Brand (The Brand Guardian) |
| Write a Post | `/agency/studio/post` | Content (The Storyteller) |
| Run a Campaign | `/agency/studio/campaign` | Director (orchestrates meeting) |
| Repurpose Content | `/agency/studio/repurpose` | Content (The Storyteller) |
| Fill My Calendar | Stays on Calendar tab | Strategy (The Strategist) |

Each card shows a smart preview from the strategy brief: what's needed right now.

---

## Communication Pattern (DOM Event)

All rooms communicate with the chat panel via `nrs-send-chat` custom DOM event (bypasses broken Zustand effect chain):

```typescript
// Any room button
window.dispatchEvent(new CustomEvent('nrs-send-chat', {
  detail: { message: contextRichMessage }
}))

// ChatPanel listener (already exists)
window.addEventListener('nrs-send-chat', (e) => {
  handleSendRef.current(e.detail.message)
})
```

---

## Database Changes

### New columns on `scheduled_posts`:
- `content_type`: TEXT — entertainment | education | inspiration | promotional
- `content_pillar`: TEXT — from brand's content_pillars array

### New columns on `outputs`:
- `content_type`: TEXT — same enum
- `content_pillar`: TEXT — same

### No new tables required.

---

## Tech Stack Additions

| Tool | Purpose | Licence |
|------|---------|---------|
| Twick | Video editor (React SDK) | MIT |
| Tiptap | Rich text editor (headless) | MIT |
| FullCalendar | Calendar with drag-and-drop | MIT |
| OpenClaw Video Toolkit | AI video production (Remotion + cloud GPU) | Already installed |
| SVAR React Gantt | Campaign timeline | MIT |
| ffmpeg.wasm | Client-side video processing | LGPL |

---

## Build Order

1. Strategy layer (useStrategyContext hook + StrategyBrief component + DB migrations)
2. Chat panel DOM event fix (ensure nrs-send-chat works reliably)
3. Create tab as launchpad (6 door cards with strategy previews, linking to routes)
4. Post Composer (simplest room, validates the pattern)
5. Design Room (Canva integration already working)
6. Content Repurposer (reuses Post Composer patterns)
7. Campaign Planner (convene_meeting already working)
8. Video Room (most complex — Twick + HeyGen + OpenClaw integration)
9. Calendar enhancement (FullCalendar + drag-and-drop + strategy overlay)
