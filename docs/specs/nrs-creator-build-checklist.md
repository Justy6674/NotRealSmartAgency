---
created: 2026-04-09
tags: [notrealsmart, build-checklist, creator, definitive]
project: NotRealSmartAgency
---

# Creator Build Checklist — What Actually Needs Building

## Status: PostCreator.tsx is 90% complete (541 lines, 7 StudioCards with Director Assist)

### Already Built (DO NOT REBUILD)
- [x] StudioCard wrapper with Director Assist pills (sparkle button → sendToDirector)
- [x] Card 1: ContentTypeSection (6 visual preset cards)
- [x] Card 2: PlatformSection (visual multi-select with format requirements)
- [x] Card 3: MediaSlots + MediaSelector + Library/Upload/Canva/AI Generate buttons
- [x] Card 4: Caption Editor + AI prompt + AI action pills (punchier, hook, shorten, etc.)
- [x] Card 5: PlatformVersionEditor (per-platform caption tabs, 2+ platforms)
- [x] Card 6: HashtagSection with HashtagGroupPicker + AI suggestions
- [x] Card 7: ComplianceSection (AHPRA/TGA auto-check, health brands only)
- [x] ComposerLayout (split pane: editor left, preview right)
- [x] CreatorActionBar (Save Draft / Schedule / Publish Now)
- [x] MultiPlatformPreview (all 7 phone mockups)
- [x] StrategyContextBar (Director's strategic suggestions)
- [x] CreatorModeBar (Fresh / Template toggle)
- [x] PostTemplatePicker with {variable} substitution
- [x] localStorage auto-save/restore of draft
- [x] Mobile preview floating button + bottom sheet
- [x] Source metadata stamping (metadata.source = 'post_creator')

### Needs Building

#### 1. Edit Mode (draftId prop)
**File:** `src/components/agency/studio/post/PostCreator.tsx`
- Add `draftId?: string` prop
- On mount: if draftId provided, fetch draft from `/api/scheduled-posts` (need a GET by ID)
- Populate ALL form fields from draft: caption, hashtags, platforms, media, contentType, schedule
- Change action bar: "Update Draft" instead of "Save Draft"
- Save uses PATCH instead of POST
- After save: clear draftId, return to Review tab
- Add GET endpoint: `/api/scheduled-posts/[id]` or use existing GET with ID filter

#### 2. Media Entry Point (mediaId prop)
**File:** `src/components/agency/studio/post/PostCreator.tsx`
- Add `mediaId?: string` prop
- On mount: if mediaId provided, fetch media item, pre-populate mediaIds
- Auto-detect content type from file_type (video → short_video/long_video, image → post)

#### 3. Navigation Wiring (Zustand)
**File:** `src/stores/agency-store.ts`
- Add `pendingDraftId: string | null` and `pendingMediaId: string | null` to store
- Add `setPendingDraftId` and `setPendingMediaId` actions

**File:** `src/components/agency/studio/CreativeStudio.tsx`
- Read `pendingDraftId`/`pendingMediaId` from store
- Pass to PostCreator as props
- Clear pending state after PostCreator reads it
- When set, auto-switch to Create tab

**File:** `src/components/agency/studio/ReviewRoom.tsx`
- "Alter" button: `setPendingDraftId(id)` → triggers Create tab

**File:** `src/components/agency/studio/MediaLibrary.tsx` (or MediaLibraryCard)
- "Start your post?" button: `setPendingMediaId(id)` → triggers Create tab

#### 4. Schedule Card (move into cards, not just action bar)
**File:** `src/components/agency/studio/post/PostCreator.tsx`
- Add a StudioCard wrapping PostScheduler between Compliance and Action Bar
- Director Assist: "When's the best time to post this?"
- "Next free slot" button (Blotato pattern)
- Show calendar preview of surrounding scheduled posts

#### 5. Review Tab "Start your post?" on Media Items
**File:** `src/components/agency/studio/MediaLibraryCard.tsx`
- Add "Create Post" button alongside Generate button
- onClick: sets pendingMediaId, switches to Create tab

#### 6. Review Tab "Alter" Action
**File:** `src/components/agency/studio/review/DraftCard.tsx`
- Replace current "Reject" with "Alter" (edit icon)
- onClick: sets pendingDraftId, switches to Create tab
- Keep Reject as a separate action (in dropdown or secondary)

### Do NOT build (already exists or not needed)
- Do NOT create a separate "edit post" screen
- Do NOT rebuild the StudioCard component
- Do NOT rebuild the phone mockup previews
- Do NOT rebuild the compliance filter
- Do NOT change the tab structure (Create/Review/Schedule/Media is correct)
- Do NOT rebuild the Director chat integration (sendToDirector already works)

### Testing checklist
- [ ] Upload video in Media → click "Create Post" → Creator opens with video pre-loaded
- [ ] Start fresh in Creator → pick media → write caption → save draft
- [ ] See draft in Review → click "Alter" → Creator opens with all fields populated
- [ ] Edit caption → save → returns to Review with updated draft
- [ ] Director Assist pill on each card sends correct contextual prompt
- [ ] Schedule card shows "Best time" suggestion
- [ ] Compliance check runs for health brands
- [ ] Mobile preview works (floating button + bottom sheet)
- [ ] AI action pills work (punchier, hook, shorten)
- [ ] Per-platform versions work when 2+ platforms selected

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]
