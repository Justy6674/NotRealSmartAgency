---
created: 2026-04-10
tags: [notrealsmart, mixpost, ui-port, reference]
project: NotRealSmart
---

# Mixpost Visual Parity — Full Sub-Page Inventory

Reference for the visual parity rebuild. Every page, sub-page, modal, and component in Mixpost Pro's workspace UI, mapped against what NRS has vs needs.

## Source: Mixpost Pro on VPS

All files at `/var/www/html/vendor/inovector/mixpost-pro-team/resources/js/` inside `mixpost-mixpost-1` Docker container.

## Layout Pattern

Mixpost uses a **LEFT SIDEBAR** (not top tabs) with two sections:
- **Content**: Posts, Calendar, Media Library, Templates
- **Configuration**: Social Accounts, Posting Schedule, Webhooks
- Plus: Dashboard (top), CREATE POST button (top-left)

NRS currently uses **top horizontal sub-tabs** inside the Studio header. The visual parity pass needs to restructure this to match Mixpost's sidebar pattern OR make the top tabs visually equivalent.

## Page-by-Page Inventory

### 1. Dashboard (174 LOC)
- Account avatar row (scrollable, each with platform badge)
- Post Engagements big number
- Posts Impressions big number
- Audience line chart (followers over time, zoomable)
- 7-day / 30-day / 90-day toggle

**NRS status:** StudioDashboard has MetricCard widgets (shipped Phase 5) but NOT the account avatar row or the exact layout density.

### 2. Posts/Index (252 LOC) — Posts List
- Tab bar: All | Drafts | Scheduled | Published | **Failed** (red) | Trash
- Search by keyword (top-right)
- Filter button (top-right)
- Table columns: checkbox, status dot (green/red/black/blue), content snippet, media thumbnail, labels/tags, account avatars (multiple per post), edit pencil icon
- Bulk actions: checkbox → bulk bar appears
- Click row → navigates to Posts/CreateEdit

**Sub-components used:**
- `PostItem.vue` (203 LOC) — single row
- `PostItemActions.vue` (183 LOC) — per-row dropdown (Edit, Duplicate, Delete from platform, Delete)
- `PostStatus.vue` (46 LOC) — coloured dot
- `PostDeletionConfirmationModal.vue` (228 LOC) — delete confirmation

**NRS status:** PostsIndex exists but is a basic table without status tabs, media thumbnails, or account avatars.

### 3. Posts/CreateEdit (364 LOC) — The Composer
The richest page. Split-pane: left = form, right = preview/activity.

**Left pane imports:**
- PostForm (735 LOC) — the entire form: account selector, version editor, media uploader, text editor, scheduling, tags
- PostActions (322 LOC) — Save as Draft / Schedule / Add to Queue / Publish Now buttons
- PostErrors (27 LOC) — validation errors display
- PostStatus (46 LOC) — current status badge

**Right pane:**
- Tabs: Preview | Activity
- PostPreviewProviders (166 LOC) — renders platform-specific previews
  - **40 files in PostPreview/** — Facebook Feed/Story/Reel, Instagram Feed/Story/Reel/Carousel, X Tweet/Thread, LinkedIn Post, TikTok Video, YouTube Video, Pinterest Pin, Mastodon Toot, Threads Post, Bluesky Post, + account avatar variants
- PostActivity (41 LOC) — comment thread container
  - **19 files in PostActivity/** — ItemCommentType (345 LOC), ViewThread (190 LOC), NewComment (126 LOC), plus 12 event-type renderers

**Sub-components of PostForm:**
- PostVersionOptions (210 LOC) — per-platform version tabs
- PostCharacterCount (70 LOC) — remaining chars ring
- PostContentValidator (560 LOC) — platform-specific validation rules
- PostMedia (319 LOC) — media upload/reorder within composer
- PostTags (205 LOC) — hashtag/mention autocomplete

**ProviderVersionOptions/** (13 files) — per-platform metadata fields:
- Facebook: audience, link preview
- Instagram: first comment, location, cover image
- TikTok: privacy, allow comments/duet/stitch, content disclosure
- YouTube: title, category, privacy, shorts toggle
- LinkedIn: article link
- X: poll, thread settings
- Pinterest: board, pin link, alt text
- Mastodon: content warning, visibility
- Threads: reply control
- Bluesky: reply gate, language

**NRS status:** PostCreator exists (754 LOC) with RichCaptionEditor + PostContentValidator + PlatformVersionEditor but is missing: PostActivity inside the composer, ProviderVersionOptions per-platform metadata fields, PostPreview with 40 provider-specific previews (NRS has 6 phone mockups), PostForm density (account selector, version tabs, media reorder).

### 4. Calendar (138 LOC)
- Month/Week toggle (top-right)
- Post cards inside day cells with: platform icon, caption snippet, time, status dot (green/red/blue/light-blue)
- Click card → navigate to CreateEdit
- Drag card between days → reschedule

**NRS status:** EnhancedCalendar has Month/Week/Day with CalendarPostPill (shipped Phase 1). Close to parity but post cards need platform ICONS (not just coloured borders) and the exact status dot colours matching Mixpost's.

### 5. Media Library (190 LOC)
- Tabs: Upload | Stock Photos | GIFs
- Drag-drop zone + URL upload input
- Thumbnail grid with: filename, 3-dot menu, checkbox (top-right corner), video duration badge
- Click media → detail panel (alt text, delete, download)

**Sub-components (16 files):**
- UploadMedia (455 LOC) — chunked upload with progress
- MediaFile (329 LOC) — per-item card with preview/edit
- AddMedia (195 LOC) — modal for stock/upload/Adobe
- MediaStock (120 LOC) — stock photo search
- MediaGifs (117 LOC) — GIF search
- MediaPreview (114 LOC) — full-screen preview
- AltTextDialog (89 LOC) — alt text modal

**NRS status:** MediaLibrary exists (529 LOC) with bulk select + alt text (shipped Phase 2). Missing: Stock Photos tab, GIFs tab, URL upload input, 3-dot menu on each card. Close but needs the tab structure.

### 6. Templates/Index (115 LOC) + CreateEdit (270 LOC)
- "Create Template" button
- Empty state: "You don't have any templates yet"
- Template list with: name, description, content preview, duplicate/delete
- Editor: name, content (TipTap), variables, platform tags

**Sub-components:**
- TemplateManager/ (4 files)
- VariableManager/ (3 files)

**NRS status:** TemplatesIndex + TemplateEditor + VariableManager exist (shipped Phase 6). Should be close to parity.

### 7. Social Accounts (343 LOC) + AccountEntities (108 LOC)
- Account cards grid: avatar with platform badge overlay, name, "Added: X days ago", 3-dot menu
- "Add account" card (dashed border, + icon)
- Per-platform "Add" dialogs (11 separate components in Account/ — one per platform)
- "Configure Services" banner when Pinterest/X not set up
- Click account → AccountEntities page (per-account hashtags/keywords)

**Sub-components (15 files in Account/):**
- Account.vue — card renderer
- AddTwitterAccount, AddFacebookPage, AddMastodonAccount, AddInstagramAccount, AddThreadsAccount, AddYoutubeAccount, AddGBPAccount, AddPinterestAccount, AddLinkedinProfile, AddLinkedinPage, AddTikTokAccount

**NRS status:** AccountsPage + AccountCard + ConnectAccountDialog exist (shipped Phase 9) but the cards don't show avatars from Mixpost data (they show initials), and there's one generic ConnectAccountDialog instead of 11 per-platform dialogs.

### 8. Posting Schedule (101 LOC)
- "Add new posting time" form: day dropdown (Everyday/Mon/Tue/etc), time picker, timezone display
- "Posting times" grid: 7 columns (Mon-Sun), each with On/Off toggle, time slots listed vertically
- "Update Posting Times" button, "Clear All Posting Times" button

**Sub-components (2 files):**
- AddPostingTime.vue — the form
- PostingTimes.vue — the weekly grid

**NRS status:** PostingSchedulePage + WeeklySlotGrid + SlotEditor exist (shipped Phase 7). Need to verify visual match against the screenshot.

### 9. Webhooks/Index (194 LOC) + CreateEdit (270 LOC) + Deliveries (123 LOC)
- "Create Webhook" button
- Table: Name, Callback URL, Status (green "Active" badge), delivery log icon
- Editor: name, URL, method, content type, events checkboxes, secret field
- Deliveries: paginated log per webhook with payload/response JSON viewer

**NRS status:** WebhooksIndex + WebhookEditor + WebhookDeliveriesLog exist (shipped Phase 8). Should be close to parity.

## Component Categories NOT in Any Page (shared primitives)

| Category | Files | Purpose |
|---|---|---|
| ProviderGallery/ | 28 | Platform picker with icons — used in PostForm account selector |
| ProviderVersionOptions/ | 13 | Per-platform metadata fields in composer |
| PostPreview/ | 40 | Live preview renderers per platform variant |
| PostActivity/ | 19 | Comment thread + system event log |
| Sidebar/ | 6 | Left sidebar navigation chrome |
| Layout/ | 6 | Flex, Grid, Container primitives |
| Surface/ | 5 | Card, Panel base components |
| Navigation/ | 5 | Tabs, Tab, Menu, Breadcrumb |
| DataDisplay/ | 15 | PageHeader, Badge, Stat, Table |
| Button/ | 10 | Primary, Secondary, Editor, Pure, Danger |
| Form/ | 14 | Input, Textarea, Select, DatePicker, TimePicker, Checkbox, Radio, Switch |
| Modal/ | 3 | Modal, DialogModal, ConfirmationModal |
| Dropdown/ | 4 | Dropdown, DropdownItem, DropdownButton |
| Chart/ | 1 | ChartBar (Chart.js wrapper) |
| AI/ | 8 | AI writing assistant components |
| ServiceForm/ | 18 | Per-provider service configuration |

## Priority Order for Visual Parity Pass

1. **Layout restructure** — left sidebar matching Mixpost's Content/Configuration grouping
2. **Posts list** — status tabs + media thumbnails + account avatars
3. **Composer** — PostPreview gallery (40 components → NRS has 6) + PostActivity inside composer + ProviderVersionOptions per-platform fields
4. **Calendar** — platform icons on post cards (not just coloured borders)
5. **Dashboard** — account avatar row + exact chart layout
6. **Media Library** — Stock Photos + GIFs tabs + URL upload
7. **Social Accounts** — real avatars from Mixpost data + per-platform add dialogs
8. **Posting Schedule** — verify visual match
9. **Webhooks** — verify visual match
10. **Templates** — verify visual match

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]
