---
created: 2026-04-08
tags: [notrealsmart, creative-studio, post-creator, scent-sell-pattern]
project: NotRealSmartAgency
---

# Post Creator Redesign — Scent Sell Pattern for Social Media

## Origin
Justin identified the Scent Sell marketplace listing form (`src/pages/Sell.tsx`) as the gold standard for structured content creation. 1,172 lines, 13 card-based sections, 19 sub-components, visual selectors, AI auto-fill + manual override, draft/submit dual flow, live preview.

## Goal
Rebuild the NRS Post Composer (`/agency/studio/post`) to this quality standard. One form that handles ALL content types across ALL platforms with AI assistance at every step.

## Platforms
TikTok, Instagram (Feed, Reels, Stories), Facebook (Feed, Reels, Stories), LinkedIn (Feed, Video, Articles), YouTube (Long-form, Shorts), X/Twitter

## Content Types
- Single post (image + caption)
- Carousel (multi-slide)
- Short video (Reels, Shorts, TikTok — 9:16)
- Long video (YouTube, LinkedIn — 16:9)
- Stories (ephemeral — 9:16)
- Advertisement (paid — needs CTA, targeting notes)

## Section Design (Scent Sell → NRS Mapping)

### 1. Media Slots (← PhotoUploadWizard)
- Platform-aware slots: cover image, carousel slides (up to 10), video file
- Visual aspect ratio indicators per slot (1:1, 4:5, 9:16, 16:9)
- HEIC conversion, orientation fix, Supabase upload (reuse existing MediaUploader)
- AI: "Generate an image" button per slot (uses generate_image tool)
- Pull from existing media library

### 2. Platform Selector (← ConditionSelector card-based)
- Visual cards with platform icons — not a dropdown
- Multi-select: pick 1+ platforms
- Each platform shows format requirements (char limits, aspect ratios)
- AI: "Which platforms need content most?" suggestion based on strategy

### 3. Content Type (← SizeAndFillSection presets)
- Visual preset cards: Post, Carousel, Short Video, Long Video, Story, Ad
- Selection auto-adjusts media slots (carousel shows 10 slots, video shows upload)
- AI: suggest content type based on selected platforms + media

### 4. Caption Editor (← RetailPriceSection auto-calc + manual)
- AI auto-generates caption based on media + brand + strategy context
- Manual edit always available
- Per-platform character count with warnings (2200 IG, 300 TikTok, 3000 LinkedIn, etc.)
- Platform version tabs: edit caption per platform independently
- AI: "Make it punchier", "Add hook", "Make longer" buttons

### 5. Hashtags (← existing HashtagGroupPicker)
- Saved hashtag groups per brand (already built)
- AI-suggested hashtags based on caption + niche
- Per-platform hashtag counts (30 IG, 5 TikTok, etc.)

### 6. Post Template (← existing PostTemplatePicker)
- Apply saved templates with {variable} substitution (already built)
- AI: suggest template based on content type

### 7. Schedule (← existing PostScheduler)
- Date/time picker
- AI: "Best time to post on {platform}" suggestion
- Timezone-aware (Australian)

### 8. Compliance Check (← PackagingAuthenticitySection)
- Auto-check for AHPRA/TGA compliance (health brands)
- Warnings for claim language, before/after images
- Toggle: "This is a health-related post" triggers stricter checks

### 9. Live Preview (← live equity calculation)
- Platform mockups (already built: InstagramMockup, FacebookMockup, etc.)
- Updates in real-time as caption/media changes
- Switch between platforms to see how each version looks

### 10. Sticky Action Bar (← Save Draft / Submit for Review)
- Save Draft (anytime)
- Schedule (pick date/time)
- Publish Now (immediate via Mixpost)
- "Ask Director" — send to chat for AI feedback before publishing

## Existing Components to Reuse
- `src/components/agency/studio/post/PostEditor.tsx` — caption editor
- `src/components/agency/studio/post/PlatformPreview.tsx` — platform previews
- `src/components/agency/studio/post/PostScheduler.tsx` — date/time picker
- `src/components/agency/studio/post/PostTypeSelector.tsx` — type selector
- `src/components/agency/studio/post/MediaSelector.tsx` — media picker
- `src/components/agency/studio/post/CarouselPreview.tsx` — carousel preview
- `src/components/agency/studio/post/PlatformVersionEditor.tsx` — per-platform captions
- `src/components/agency/studio/hashtags/HashtagGroupPicker.tsx` — saved groups
- `src/components/agency/studio/templates/PostTemplatePicker.tsx` — templates
- `src/components/agency/studio/preview/*.tsx` — 7 platform mockups
- `src/components/agency/studio/editor/ImageEditorModal.tsx` — crop with 13 presets
- `src/components/agency/MediaUploader.tsx` — drag-drop upload
- `src/lib/post-versions.ts` — PLATFORM_CHAR_LIMITS, createVersionsFromMaster
- `src/lib/template-variables.ts` — 8 built-in variables

## API Endpoints Already Built
- `PATCH /api/scheduled-posts` — edit existing posts
- `POST /api/scheduled-posts` — create posts
- `POST /api/media/upload` — upload media
- `POST /api/media/{id}/generate` — generate captions from media
- `GET /api/hashtag-groups` — saved hashtag groups
- `GET /api/post-templates` — saved templates

## Key Difference from Scent Sell
Scent Sell is a marketplace listing form (fill in details about a product).
NRS is a content creation form (create + publish marketing content).
The AI aspect is the differentiator — AI writes the first draft, you refine.
