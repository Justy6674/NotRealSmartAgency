---
created: 2026-04-08
tags: [notrealsmart, reference, creative-studio, redesign, social-media-builder]
project: NotRealSmartAgency
---

# Creative Studio Redesign — Research Findings

## The Professional Pattern (Later, Planable, Postiz)

1. **Composer Panel** (left) — text editor with platform tabs, AI assist, hashtag insertion, variable insertion, media attachment
2. **Preview Panel** (right) — live platform mockups updating in real-time, switchable between platforms, phone-frame
3. **Media Panel** (bottom/sidebar) — image editor (crop/filter/overlay), carousel builder with DnD, video trimmer
4. **Schedule Panel** (bottom) — date/time picker, queue slot, calendar drop
5. **Approval Bar** (top) — status badge, approve/reject/comment

## Key NPM Packages

| Package | Purpose | Licence |
|---------|---------|---------|
| `react-filerobot-image-editor` | Crop, filter, annotate, text overlay, watermark, stickers | MIT |
| `@dnd-kit/core` + `@dnd-kit/sortable` | DnD for carousel, grid planner, calendar | MIT |
| `react-device-frameset` | Phone frame mockups (optional, CSS alternative) | MIT |
| `@fullcalendar/react` | Calendar (already installed) | MIT |
| `html-to-image` | Carousel export (already installed) | MIT |

## Features to Replicate from Competitors

### From Planable (best preview/approval)
- Pixel-perfect platform mockup previews
- 4 view modes: Calendar, Grid, Feed, List
- Multi-level approval workflows
- Comments directly on post previews
- External client review without platform access

### From Mixpost (best composer features)
- Post Versions: platform-specific content variations
- Hashtag Groups: save and insert sets
- Dynamic Variables: {date}, {time}, {brand}
- Post Templates: recurring formats with variables
- First Comments: keep main post clean
- Approval workflow with activity timeline

### From Later (best visual planning)
- Instagram Grid Planner: see feed aesthetic before posting
- Drag content from media library onto calendar
- Video trimming for TikTok/Reels

### From Postiz (best open-source reference)
- Next.js + React frontend
- Canva-like built-in design tool
- AI-powered content generation
- 30+ social platform support
- Modern DnD scheduling UI

## What NRS Currently Has vs. Needs

| Feature | Has | Needs |
|---------|-----|-------|
| Basic post composer | Yes | Platform tabs, AI assist, hashtag groups |
| Platform preview | Flat cards | Phone-frame mockups, real-time update |
| Carousel builder | Slide templates + export | DnD reorder, richer templates |
| Calendar | FullCalendar basic | Drag-from-sidebar, content density |
| Image editor | None | react-filerobot-image-editor |
| Multi-platform preview | One at a time | Side-by-side all platforms |
| Post versions | None | Platform-specific content |
| Hashtag groups | None | Saved sets per campaign/brand |
| Grid planner | None | Instagram feed aesthetic preview |
| DnD | Up/down buttons | @dnd-kit everywhere |
| Video trimmer | None | Canvas-based frame extraction |
| Post templates | None | Reusable with variables |
| Approval workflow | Backend only | Visual approve/reject/comment |
| First comments | None | Instagram strategy feature |

## Open Source References

- **Postiz**: github.com/gitroomhq/postiz-app (Next.js, most complete)
- **Socioboard 5.0**: github.com/socioboard/Socioboard-5.0 (Node.js, multi-platform)
- **Mixpost**: mixpost.app (Laravel/Vue, our backend — don't use frontend)

## Architecture Decision

Build our own React components using the npm packages above. Do NOT embed Mixpost's Vue frontend. Do NOT use Postiz as a dependency. Study their patterns, build our own.

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]
