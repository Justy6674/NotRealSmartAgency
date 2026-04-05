# Content Rooms Implementation Plan (Post Composer + Content Repurposer)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans

**Goal:** Build the Post Composer (/agency/studio/post) and Content Repurposer (/agency/studio/repurpose) rooms

**Architecture:** Both rooms use RoomLayout shell (already built), useStrategyContext for strategy guidance, sendToDirector for AI assistance, Tiptap for rich text editing, platform preview components for social mockups.

**Tech Stack:** Next.js 15, React 19, Tiptap (rich text), Tailwind CSS 4, TypeScript

---

## Existing Infrastructure (DO NOT rebuild)

- `src/components/agency/studio/RoomLayout.tsx` -- shared room shell with back button + strategy brief
- `src/hooks/useStrategyContext.ts` -- strategy calculations (agentContext string, suggestedPlatform, suggestedPillar, etc.)
- `src/components/agency/studio/StrategyBrief.tsx` -- strategy one-liner component
- `src/lib/chat-dispatch.ts` -- `sendToDirector(message)` dispatches `nrs-send-chat` DOM event
- `src/app/agency/studio/post/page.tsx` -- stub route page
- `src/app/agency/studio/repurpose/page.tsx` -- stub route page
- `src/hooks/useStudioData.ts` -- `useStudioData(brandId)` returns brand, posts, outputs, accounts, etc.
- `/api/scheduled-posts` -- existing CRUD for scheduled posts
- `/api/outputs` -- existing CRUD for outputs
- `src/types/database.ts` -- `ScheduledPost`, `Output`, `PostPlatform`, `Brand` types
- `src/stores/agency-store.ts` -- `useAgencyStore` (activeBrandId, etc.)
- Agent tools: `fill_calendar`, `write_blog`, `manage_posts`, `repurpose_content`, `query_outputs`

## Platform Character Limits Reference

```typescript
const PLATFORM_LIMITS: Record<string, { label: string; maxChars: number; icon: string }> = {
  instagram:  { label: 'Instagram',  maxChars: 2200,   icon: 'Instagram' },
  facebook:   { label: 'Facebook',   maxChars: 63206,  icon: 'Facebook' },
  linkedin:   { label: 'LinkedIn',   maxChars: 3000,   icon: 'Linkedin' },
  twitter:    { label: 'X',          maxChars: 280,    icon: 'Twitter' },
  tiktok:     { label: 'TikTok',     maxChars: 2200,   icon: 'Music2' },
  youtube:    { label: 'YouTube',    maxChars: 5000,   icon: 'Youtube' },
}
```

---

## POST COMPOSER ROOM

---

### Task 1: Install Tiptap

- [ ] **Step 1: Install Tiptap packages**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npx next build --no-lint 2>&1 | head -5
```

Expected: no Tiptap-related import errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install Tiptap rich text editor packages"
```

---

### Task 2: PostEditor Component

**Files:**
- Create: `src/components/agency/studio/post/PostEditor.tsx`

- [ ] **Step 1: Create the PostEditor component**

```typescript
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useCallback, useEffect } from 'react'
import type { PostPlatform } from '@/types/database'

const PLATFORM_LIMITS: Record<string, { label: string; maxChars: number; icon: string }> = {
  instagram:  { label: 'Instagram',  maxChars: 2200,   icon: 'Instagram' },
  facebook:   { label: 'Facebook',   maxChars: 63206,  icon: 'Facebook' },
  linkedin:   { label: 'LinkedIn',   maxChars: 3000,   icon: 'Linkedin' },
  twitter:    { label: 'X',          maxChars: 280,    icon: 'Twitter' },
  tiktok:     { label: 'TikTok',     maxChars: 2200,   icon: 'Music2' },
  youtube:    { label: 'YouTube',    maxChars: 5000,   icon: 'Youtube' },
}

export { PLATFORM_LIMITS }

interface PostEditorProps {
  content: string
  onContentChange: (text: string) => void
  selectedPlatforms: PostPlatform[]
  onPlatformsChange: (platforms: PostPlatform[]) => void
  hashtags: string
  onHashtagsChange: (hashtags: string) => void
  disabled?: boolean
}

const ALL_PLATFORMS: PostPlatform[] = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']

export function PostEditor({
  content,
  onContentChange,
  selectedPlatforms,
  onPlatformsChange,
  hashtags,
  onHashtagsChange,
  disabled = false,
}: PostEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: 'Write your post here...',
      }),
      CharacterCount,
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getText())
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm prose-invert max-w-none min-h-[180px] px-4 py-3 focus:outline-none font-[family-name:var(--font-ibm-plex-sans)] text-sm leading-relaxed',
      },
    },
  })

  // Sync external content changes (e.g. AI-generated content) into the editor
  useEffect(() => {
    if (editor && content !== editor.getText()) {
      editor.commands.setContent(content ? `<p>${content.replace(/\n/g, '</p><p>')}</p>` : '')
    }
    // Only sync when content prop changes externally, not from editor updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const togglePlatform = useCallback(
    (platform: PostPlatform) => {
      if (selectedPlatforms.includes(platform)) {
        onPlatformsChange(selectedPlatforms.filter(p => p !== platform))
      } else {
        onPlatformsChange([...selectedPlatforms, platform])
      }
    },
    [selectedPlatforms, onPlatformsChange],
  )

  const charCount = editor?.storage.characterCount?.characters() ?? 0

  // Tightest character limit among selected platforms
  const tightestLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map(p => PLATFORM_LIMITS[p]?.maxChars ?? Infinity))
    : Infinity

  const isOverLimit = tightestLimit !== Infinity && charCount > tightestLimit

  return (
    <div className="flex flex-col gap-4">
      {/* Platform selector */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Platforms
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map(platform => {
            const info = PLATFORM_LIMITS[platform]
            const selected = selectedPlatforms.includes(platform)
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                disabled={disabled}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-[oklch(0.75_0.06_240)] text-[oklch(0.15_0.02_240)]'
                    : 'bg-[oklch(0.22_0.02_240)] text-muted-foreground hover:bg-[oklch(0.28_0.03_240)]'
                }`}
              >
                {info.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Editor area */}
      <div className="rounded-lg border border-border bg-[oklch(0.14_0.01_240)] overflow-hidden">
        <EditorContent editor={editor} />
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400' : 'text-muted-foreground'}`}>
            {charCount.toLocaleString()}
            {tightestLimit !== Infinity && ` / ${tightestLimit.toLocaleString()}`}
          </span>
          {selectedPlatforms.length > 0 && (
            <div className="flex gap-2">
              {selectedPlatforms.map(p => {
                const info = PLATFORM_LIMITS[p]
                const over = charCount > info.maxChars
                return (
                  <span
                    key={p}
                    className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/60'}`}
                  >
                    {info.label}: {charCount}/{info.maxChars}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hashtag input */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Hashtags
        </label>
        <input
          type="text"
          value={hashtags}
          onChange={e => onHashtagsChange(e.target.value)}
          disabled={disabled}
          placeholder="#marketing #brand #content"
          className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] font-[family-name:var(--font-ibm-plex-sans)]"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/post/PostEditor.tsx
git commit -m "feat: PostEditor component with Tiptap, platform selector, character counts"
```

---

### Task 3: PlatformPreview Component

**Files:**
- Create: `src/components/agency/studio/post/PlatformPreview.tsx`

- [ ] **Step 1: Create the PlatformPreview component**

```typescript
'use client'

import { Instagram, Facebook, Linkedin, Twitter, Music2, Youtube } from 'lucide-react'
import type { PostPlatform } from '@/types/database'
import { PLATFORM_LIMITS } from './PostEditor'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

const PLATFORM_ICONS: Record<string, ComponentType<LucideProps>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: Music2,
  youtube: Youtube,
}

interface PlatformPreviewProps {
  content: string
  hashtags: string
  selectedPlatforms: PostPlatform[]
  brandName?: string
}

function InstagramPreview({ content, hashtags, brandName }: { content: string; hashtags: string; brandName: string }) {
  const fullText = `${content}${hashtags ? `\n\n${hashtags}` : ''}`
  const info = PLATFORM_LIMITS.instagram
  const charCount = fullText.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-[oklch(0.13_0.01_240)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[oklch(0.65_0.15_330)] to-[oklch(0.65_0.15_30)] flex items-center justify-center text-[10px] font-bold text-white">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-foreground">{brandName}</span>
      </div>
      {/* Image placeholder */}
      <div className="aspect-square bg-[oklch(0.18_0.01_240)] flex items-center justify-center">
        <Instagram className="h-8 w-8 text-muted-foreground/30" />
      </div>
      {/* Caption */}
      <div className="px-3 py-2.5">
        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-wrap font-[family-name:var(--font-ibm-plex-sans)]">
          <span className="font-semibold text-foreground">{brandName}</span>{' '}
          {content || 'Your caption will appear here...'}
        </p>
        {hashtags && (
          <p className="text-xs text-[oklch(0.6_0.1_240)] mt-1">{hashtags}</p>
        )}
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border">
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function LinkedInPreview({ content, brandName }: { content: string; brandName: string }) {
  const info = PLATFORM_LIMITS.linkedin
  const charCount = content.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-[oklch(0.13_0.01_240)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div className="h-10 w-10 rounded-full bg-[oklch(0.45_0.1_240)] flex items-center justify-center text-xs font-bold text-white">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div>
          <span className="text-xs font-semibold text-foreground block">{brandName}</span>
          <span className="text-[10px] text-muted-foreground">Just now</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-6 font-[family-name:var(--font-ibm-plex-sans)]">
          {content || 'Your LinkedIn post will appear here...'}
        </p>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span>Like</span>
          <span>Comment</span>
          <span>Repost</span>
          <span>Send</span>
        </div>
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function XPreview({ content, brandName }: { content: string; brandName: string }) {
  const info = PLATFORM_LIMITS.twitter
  const charCount = content.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-[oklch(0.13_0.01_240)] overflow-hidden">
      <div className="flex gap-2.5 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-[oklch(0.30_0.02_240)] flex items-center justify-center text-xs font-bold text-foreground shrink-0">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">{brandName}</span>
            <span className="text-[10px] text-muted-foreground">@{brandName.toLowerCase().replace(/\s/g, '')} &middot; now</span>
          </div>
          <p className={`text-xs leading-relaxed mt-1 whitespace-pre-wrap font-[family-name:var(--font-ibm-plex-sans)] ${over ? 'text-red-400' : 'text-foreground/80'}`}>
            {content || 'Your tweet will appear here...'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <div className="flex gap-6 text-[10px] text-muted-foreground">
          <span>Reply</span>
          <span>Repost</span>
          <span>Like</span>
          <span>Views</span>
        </div>
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount} / {info.maxChars}
        </span>
      </div>
    </div>
  )
}

function FacebookPreview({ content, hashtags, brandName }: { content: string; hashtags: string; brandName: string }) {
  const fullText = `${content}${hashtags ? `\n\n${hashtags}` : ''}`
  const info = PLATFORM_LIMITS.facebook
  const charCount = fullText.length

  return (
    <div className="rounded-xl border border-border bg-[oklch(0.13_0.01_240)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div className="h-9 w-9 rounded-full bg-[oklch(0.4_0.12_250)] flex items-center justify-center text-xs font-bold text-white">
          {brandName.charAt(0).toUpperCase()}
        </div>
        <div>
          <span className="text-xs font-semibold text-foreground block">{brandName}</span>
          <span className="text-[10px] text-muted-foreground">Just now &middot; Public</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-5 font-[family-name:var(--font-ibm-plex-sans)]">
          {content || 'Your Facebook post will appear here...'}
        </p>
        {hashtags && (
          <p className="text-xs text-[oklch(0.6_0.1_240)] mt-1">{hashtags}</p>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span>Like</span>
          <span>Comment</span>
          <span>Share</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/50">
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function GenericPreview({ content, platform, brandName }: { content: string; platform: PostPlatform; brandName: string }) {
  const info = PLATFORM_LIMITS[platform]
  const Icon = PLATFORM_ICONS[platform] ?? Music2
  const charCount = content.length
  const over = charCount > info.maxChars

  return (
    <div className="rounded-xl border border-border bg-[oklch(0.13_0.01_240)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{info.label}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-4 font-[family-name:var(--font-ibm-plex-sans)]">
          {content || `Your ${info.label} post will appear here...`}
        </p>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground">{brandName}</span>
        <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
          {charCount.toLocaleString()} / {info.maxChars.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

export function PlatformPreview({ content, hashtags, selectedPlatforms, brandName = 'Brand' }: PlatformPreviewProps) {
  if (selectedPlatforms.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select platforms to see previews
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Platform Previews
      </h3>
      <div className="grid gap-4">
        {selectedPlatforms.map(platform => {
          switch (platform) {
            case 'instagram':
              return <InstagramPreview key={platform} content={content} hashtags={hashtags} brandName={brandName} />
            case 'linkedin':
              return <LinkedInPreview key={platform} content={content} brandName={brandName} />
            case 'twitter':
              return <XPreview key={platform} content={content} brandName={brandName} />
            case 'facebook':
              return <FacebookPreview key={platform} content={content} hashtags={hashtags} brandName={brandName} />
            default:
              return <GenericPreview key={platform} content={content} platform={platform} brandName={brandName} />
          }
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/post/PlatformPreview.tsx
git commit -m "feat: PlatformPreview with IG, LinkedIn, X, Facebook mock-ups and live char counts"
```

---

### Task 4: PostScheduler Component

**Files:**
- Create: `src/components/agency/studio/post/PostScheduler.tsx`

- [ ] **Step 1: Create the PostScheduler component**

```typescript
'use client'

import { useState } from 'react'
import { Calendar, Clock, Zap, Save, Loader2 } from 'lucide-react'
import type { PostPlatform } from '@/types/database'

type PublishMode = 'draft' | 'schedule' | 'now'

// Best posting times (AEST) from platform algorithm knowledge
const BEST_TIMES: Record<string, string> = {
  instagram: '7:00 AM or 6:00 PM AEST',
  facebook: '1:00 PM or 7:00 PM AEST',
  linkedin: '8:00 AM or 12:00 PM AEST',
  twitter: '9:00 AM or 5:00 PM AEST',
  tiktok: '7:00 PM or 9:00 PM AEST',
  youtube: '2:00 PM or 5:00 PM AEST',
}

interface PostSchedulerProps {
  selectedPlatforms: PostPlatform[]
  onSave: (mode: PublishMode, scheduledAt: string | null) => Promise<void>
  disabled?: boolean
}

function getDefaultScheduleTime(): string {
  // Default to tomorrow at 9:00 AM AEST
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  // Format as datetime-local value
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T09:00`
}

export function PostScheduler({ selectedPlatforms, onSave, disabled = false }: PostSchedulerProps) {
  const [mode, setMode] = useState<PublishMode>('schedule')
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduleTime)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(mode, mode === 'schedule' ? scheduledAt : null)
    } finally {
      setSaving(false)
    }
  }

  const modes: { value: PublishMode; label: string; icon: typeof Calendar; description: string }[] = [
    { value: 'draft', label: 'Save Draft', icon: Save, description: 'Save for later editing' },
    { value: 'schedule', label: 'Schedule', icon: Calendar, description: 'Pick a date and time' },
    { value: 'now', label: 'Publish Now', icon: Zap, description: 'Send to Director for review + publish' },
  ]

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2">
        {modes.map(m => {
          const Icon = m.icon
          const active = mode === m.value
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1.5 rounded-lg px-3 py-3 text-center transition-all ${
                active
                  ? 'bg-[oklch(0.75_0.06_240)] text-[oklch(0.15_0.02_240)] ring-1 ring-[oklch(0.75_0.06_240)]'
                  : 'bg-[oklch(0.18_0.01_240)] text-muted-foreground hover:bg-[oklch(0.22_0.02_240)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Schedule date/time picker */}
      {mode === 'schedule' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Date & Time (AEST)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] font-[family-name:var(--font-ibm-plex-mono)]"
            />
          </div>

          {/* Best time suggestions */}
          {selectedPlatforms.length > 0 && (
            <div className="rounded-md bg-[oklch(0.16_0.01_240)] px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-[oklch(0.65_0.08_240)]" />
                <span className="text-[10px] font-medium text-[oklch(0.65_0.08_240)] uppercase tracking-wider">
                  Best times
                </span>
              </div>
              <div className="space-y-0.5">
                {selectedPlatforms.map(p => (
                  <p key={p} className="text-[11px] text-muted-foreground">
                    <span className="text-foreground/70 font-medium">{p.charAt(0).toUpperCase() + p.slice(1)}:</span>{' '}
                    {BEST_TIMES[p] ?? 'No data'}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled || saving || selectedPlatforms.length === 0}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-4 py-2.5 text-sm font-semibold text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            {mode === 'draft' && <Save className="h-4 w-4" />}
            {mode === 'schedule' && <Calendar className="h-4 w-4" />}
            {mode === 'now' && <Zap className="h-4 w-4" />}
            {mode === 'draft' ? 'Save Draft' : mode === 'schedule' ? 'Schedule Post' : 'Send to Director'}
          </>
        )}
      </button>

      {selectedPlatforms.length === 0 && (
        <p className="text-[11px] text-amber-400/80 text-center">
          Select at least one platform above
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/post/PostScheduler.tsx
git commit -m "feat: PostScheduler with date picker, best time suggestions, draft/schedule/publish modes"
```

---

### Task 5: PostComposerRoom Component

**Files:**
- Create: `src/components/agency/studio/post/PostComposerRoom.tsx`

- [ ] **Step 1: Create the PostComposerRoom component**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, PenLine, FileText, Loader2, Send } from 'lucide-react'
import { PostEditor } from './PostEditor'
import { PlatformPreview } from './PlatformPreview'
import { PostScheduler } from './PostScheduler'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import type { PostPlatform, ScheduledPost } from '@/types/database'

type ComposerMode = 'ai' | 'write' | 'drafts'

interface DraftPost {
  id: string
  caption: string
  platform: PostPlatform
  hashtags: string[]
  scheduled_at: string
  created_at: string
}

export function PostComposerRoom() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  const [mode, setMode] = useState<ComposerMode>('ai')
  const [content, setContent] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PostPlatform[]>(['instagram'])
  const [aiPrompt, setAiPrompt] = useState('')
  const [drafts, setDrafts] = useState<DraftPost[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  // Fetch drafts when in drafts mode
  useEffect(() => {
    if (mode !== 'drafts' || !activeBrandId) return
    setLoadingDrafts(true)
    fetch(`/api/scheduled-posts?brandId=${activeBrandId}&status=draft`)
      .then(r => r.ok ? r.json() : [])
      .then((posts: ScheduledPost[]) => {
        setDrafts(posts.map(p => ({
          id: p.id,
          caption: p.caption,
          platform: p.platform,
          hashtags: p.hashtags,
          scheduled_at: p.scheduled_at,
          created_at: p.created_at,
        })))
      })
      .catch(() => setDrafts([]))
      .finally(() => setLoadingDrafts(false))
  }, [mode, activeBrandId])

  const handleAiGenerate = useCallback(() => {
    if (!aiPrompt.trim() && !strategyContext) return

    const platformNames = selectedPlatforms
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(', ')

    const message = [
      `Write a social media post for ${platformNames || 'my social channels'}.`,
      aiPrompt.trim() ? `Topic/instructions: ${aiPrompt.trim()}` : '',
      strategyContext?.agentContext ?? '',
      `Format: Return the post caption text only. Include suggested hashtags at the end.`,
    ].filter(Boolean).join('\n\n')

    sendToDirector(message)
  }, [aiPrompt, selectedPlatforms, strategyContext])

  const handleSave = useCallback(async (
    publishMode: 'draft' | 'schedule' | 'now',
    scheduledAt: string | null,
  ) => {
    if (!activeBrandId || !content.trim()) return

    if (publishMode === 'now') {
      // Send to Director for review and publishing
      const platformNames = selectedPlatforms
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(', ')

      const message = [
        `Review and publish this post to ${platformNames}:`,
        '',
        content,
        hashtags ? `\nHashtags: ${hashtags}` : '',
        '',
        `Please check compliance, brand voice, and publish when ready.`,
      ].join('\n')

      sendToDirector(message)
      return
    }

    // Save as draft or scheduled post via API
    for (const platform of selectedPlatforms) {
      await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          platform,
          caption: content,
          hashtags: hashtags.split(/\s+/).filter(h => h.startsWith('#')),
          status: publishMode === 'draft' ? 'draft' : 'scheduled',
          scheduledAt: scheduledAt ?? new Date().toISOString(),
          contentType: strategyContext?.suggestedContentType ?? null,
          contentPillar: strategyContext?.suggestedPillar ?? null,
        }),
      })
    }

    // Refresh studio data
    data.refetch()
  }, [activeBrandId, content, hashtags, selectedPlatforms, strategyContext, data])

  const handleLoadDraft = useCallback((draft: DraftPost) => {
    setContent(draft.caption)
    setHashtags(draft.hashtags.join(' '))
    setSelectedPlatforms([draft.platform])
    setMode('write')
  }, [])

  const tabs: { value: ComposerMode; label: string; icon: typeof Sparkles }[] = [
    { value: 'ai', label: 'AI Writes', icon: Sparkles },
    { value: 'write', label: 'I Write', icon: PenLine },
    { value: 'drafts', label: 'From Drafts', icon: FileText },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-[oklch(0.16_0.01_240)] p-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = mode === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setMode(tab.value)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                active
                  ? 'bg-[oklch(0.22_0.03_240)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* AI Writes mode */}
      {mode === 'ai' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left: prompt + platforms */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  What should the post be about?
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={
                    strategyContext?.suggestion
                      ? `Suggestion: ${strategyContext.suggestion}`
                      : 'Describe what you want the post to be about, or leave blank for AI to decide based on your strategy...'
                  }
                  rows={4}
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] resize-none font-[family-name:var(--font-ibm-plex-sans)]"
                />
              </div>

              {/* Platform selector (reuse PostEditor's layout) */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Platforms
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube'] as PostPlatform[]).map(platform => {
                    const selected = selectedPlatforms.includes(platform)
                    const labels: Record<string, string> = {
                      instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
                      twitter: 'X', tiktok: 'TikTok', youtube: 'YouTube',
                    }
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() =>
                          selected
                            ? setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform))
                            : setSelectedPlatforms([...selectedPlatforms, platform])
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-[oklch(0.75_0.06_240)] text-[oklch(0.15_0.02_240)]'
                            : 'bg-[oklch(0.22_0.02_240)] text-muted-foreground hover:bg-[oklch(0.28_0.03_240)]'
                        }`}
                      >
                        {labels[platform]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={selectedPlatforms.length === 0}
                className="flex items-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
                Generate Post
              </button>

              <p className="text-[11px] text-muted-foreground/60">
                The Director will write your post in the chat panel, using your brand voice and strategy context. Copy the result back here to schedule it.
              </p>
            </div>

            {/* Right: preview (shows placeholder) */}
            <div className="flex-1 lg:max-w-sm">
              <PlatformPreview
                content={content}
                hashtags={hashtags}
                selectedPlatforms={selectedPlatforms}
                brandName={data.brand?.name ?? 'Brand'}
              />
            </div>
          </div>
        </div>
      )}

      {/* I Write mode */}
      {mode === 'write' && (
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left: editor */}
          <div className="flex-1 space-y-4">
            <PostEditor
              content={content}
              onContentChange={setContent}
              selectedPlatforms={selectedPlatforms}
              onPlatformsChange={setSelectedPlatforms}
              hashtags={hashtags}
              onHashtagsChange={setHashtags}
            />
          </div>

          {/* Right: preview */}
          <div className="flex-1 lg:max-w-sm">
            <PlatformPreview
              content={content}
              hashtags={hashtags}
              selectedPlatforms={selectedPlatforms}
              brandName={data.brand?.name ?? 'Brand'}
            />
          </div>
        </div>
      )}

      {/* From Drafts mode */}
      {mode === 'drafts' && (
        <div>
          {loadingDrafts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No drafts yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Save a post as draft first, or switch to &ldquo;AI Writes&rdquo; to generate one.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {drafts.map(draft => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => handleLoadDraft(draft)}
                  className="flex items-start gap-3 rounded-lg border border-border bg-[oklch(0.16_0.01_240)] p-4 text-left hover:bg-[oklch(0.19_0.01_240)] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 line-clamp-2 font-[family-name:var(--font-ibm-plex-sans)]">
                      {draft.caption || 'Empty draft'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] rounded-full bg-[oklch(0.22_0.02_240)] px-2 py-0.5 text-muted-foreground">
                        {draft.platform.charAt(0).toUpperCase() + draft.platform.slice(1)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(draft.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <PenLine className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduler (visible in AI and Write modes) */}
      {(mode === 'ai' || mode === 'write') && (
        <PostScheduler
          selectedPlatforms={selectedPlatforms}
          onSave={handleSave}
          disabled={!content.trim() && mode === 'write'}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/post/PostComposerRoom.tsx
git commit -m "feat: PostComposerRoom with AI/Write/Drafts modes, strategy-aware generation"
```

---

### Task 6: Wire Post Composer into Route Page

**Files:**
- Edit: `src/app/agency/studio/post/page.tsx`

- [ ] **Step 1: Update the page to render PostComposerRoom inside RoomLayout**

Replace the full contents of `src/app/agency/studio/post/page.tsx` with:

```typescript
'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { PostComposerRoom } from '@/components/agency/studio/post/PostComposerRoom'

export default function PostComposerPage() {
  return (
    <RoomLayout title="Post Composer">
      <PostComposerRoom />
    </RoomLayout>
  )
}
```

- [ ] **Step 2: Verify the page renders**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run dev &
# Open http://localhost:3000/agency/studio/post in the browser
# Verify: RoomLayout shell, StrategyBrief, 3 mode tabs, platform selector, Tiptap editor, previews, scheduler
```

- [ ] **Step 3: Commit**

```bash
git add src/app/agency/studio/post/page.tsx
git commit -m "feat: wire PostComposerRoom into /agency/studio/post route"
```

---

## CONTENT REPURPOSER ROOM

---

### Task 7: SourceSelector Component

**Files:**
- Create: `src/components/agency/studio/repurpose/SourceSelector.tsx`

- [ ] **Step 1: Create the SourceSelector component**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Link2, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import type { Output } from '@/types/database'

type SourceType = 'outputs' | 'paste'

interface SourceSelectorProps {
  brandId: string | null
  onSourceSelect: (source: { type: 'output' | 'text' | 'url'; title: string; content: string; outputId?: string }) => void
  selectedSourceId?: string | null
}

export function SourceSelector({ brandId, onSourceSelect, selectedSourceId }: SourceSelectorProps) {
  const [sourceType, setSourceType] = useState<SourceType>('outputs')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pasteContent, setPasteContent] = useState('')
  const [pasteUrl, setPasteUrl] = useState('')
  const [expanded, setExpanded] = useState(true)

  // Fetch outputs
  useEffect(() => {
    if (!brandId || sourceType !== 'outputs') return
    setLoading(true)
    fetch(`/api/outputs?brandId=${brandId}&limit=50`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Output[] | { outputs: Output[] }) => {
        const list = Array.isArray(data) ? data : (data.outputs ?? [])
        setOutputs(list)
      })
      .catch(() => setOutputs([]))
      .finally(() => setLoading(false))
  }, [brandId, sourceType])

  const filteredOutputs = outputs.filter(o =>
    !searchQuery.trim() ||
    o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.content.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleOutputSelect = useCallback((output: Output) => {
    onSourceSelect({
      type: 'output',
      title: output.title,
      content: output.content,
      outputId: output.id,
    })
  }, [onSourceSelect])

  const handlePasteSubmit = useCallback(() => {
    if (pasteUrl.trim()) {
      onSourceSelect({
        type: 'url',
        title: pasteUrl.trim(),
        content: pasteContent.trim() || pasteUrl.trim(),
      })
    } else if (pasteContent.trim()) {
      onSourceSelect({
        type: 'text',
        title: pasteContent.trim().slice(0, 60) + (pasteContent.length > 60 ? '...' : ''),
        content: pasteContent.trim(),
      })
    }
  }, [pasteContent, pasteUrl, onSourceSelect])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[oklch(0.18_0.01_240)] transition-colors"
      >
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Source Content
        </h3>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Source type toggle */}
          <div className="flex gap-1 rounded-lg bg-[oklch(0.16_0.01_240)] p-1">
            <button
              type="button"
              onClick={() => setSourceType('outputs')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceType === 'outputs'
                  ? 'bg-[oklch(0.22_0.03_240)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <FileText className="h-3 w-3" />
              Past Outputs
            </button>
            <button
              type="button"
              onClick={() => setSourceType('paste')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                sourceType === 'paste'
                  ? 'bg-[oklch(0.22_0.03_240)] text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              <Link2 className="h-3 w-3" />
              Paste Text / URL
            </button>
          </div>

          {/* Outputs browser */}
          {sourceType === 'outputs' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search outputs..."
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)]"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOutputs.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-4">
                  {searchQuery ? 'No matching outputs' : 'No outputs yet'}
                </p>
              ) : (
                <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredOutputs.map(output => {
                    const isSelected = selectedSourceId === output.id
                    return (
                      <button
                        key={output.id}
                        type="button"
                        onClick={() => handleOutputSelect(output)}
                        className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                          isSelected
                            ? 'bg-[oklch(0.75_0.06_240)/0.15] ring-1 ring-[oklch(0.75_0.06_240)]'
                            : 'bg-[oklch(0.16_0.01_240)] hover:bg-[oklch(0.19_0.01_240)]'
                        }`}
                      >
                        <p className="text-xs font-medium text-foreground/90 truncate">
                          {output.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-2 mt-0.5">
                          {output.content.slice(0, 120)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] rounded bg-[oklch(0.22_0.02_240)] px-1.5 py-0.5 text-muted-foreground uppercase">
                            {output.output_type}
                          </span>
                          <span className="text-[9px] text-muted-foreground/40">
                            {new Date(output.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Paste content / URL */}
          {sourceType === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  URL (optional)
                </label>
                <input
                  type="url"
                  value={pasteUrl}
                  onChange={e => setPasteUrl(e.target.value)}
                  placeholder="https://yourblog.com/article"
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Content
                </label>
                <textarea
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  placeholder="Paste your blog post, article, script, or any content to repurpose..."
                  rows={6}
                  className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] resize-none font-[family-name:var(--font-ibm-plex-sans)]"
                />
              </div>
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={!pasteContent.trim() && !pasteUrl.trim()}
                className="flex items-center gap-2 rounded-lg bg-[oklch(0.22_0.03_240)] px-4 py-2 text-xs font-medium text-foreground hover:bg-[oklch(0.28_0.03_240)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Use This Content
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/repurpose/SourceSelector.tsx
git commit -m "feat: SourceSelector for browsing outputs or pasting text/URL to repurpose"
```

---

### Task 8: TransformCard Component

**Files:**
- Create: `src/components/agency/studio/repurpose/TransformCard.tsx`

- [ ] **Step 1: Create the TransformCard component**

```typescript
'use client'

import { useState, useCallback } from 'react'
import {
  Instagram, Facebook, Linkedin, Twitter, Music2, Youtube, Mail, BookOpen,
  Loader2, Check, PenLine, Calendar, X,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

export type TransformPlatform = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube' | 'email' | 'blog'

export type TransformStatus = 'pending' | 'generating' | 'done'

const PLATFORM_META: Record<TransformPlatform, { label: string; maxChars: number; icon: ComponentType<LucideProps>; colour: string }> = {
  instagram:  { label: 'Instagram Caption',   maxChars: 2200,  icon: Instagram, colour: 'oklch(0.65_0.15_330)' },
  facebook:   { label: 'Facebook Post',       maxChars: 63206, icon: Facebook,  colour: 'oklch(0.55_0.12_250)' },
  linkedin:   { label: 'LinkedIn Article',    maxChars: 3000,  icon: Linkedin,  colour: 'oklch(0.55_0.10_240)' },
  twitter:    { label: 'X Thread',            maxChars: 280,   icon: Twitter,   colour: 'oklch(0.70_0.02_240)' },
  tiktok:     { label: 'TikTok Script',       maxChars: 2200,  icon: Music2,    colour: 'oklch(0.70_0.12_340)' },
  youtube:    { label: 'YouTube Description', maxChars: 5000,  icon: Youtube,   colour: 'oklch(0.60_0.18_25)'  },
  email:      { label: 'Email Snippet',       maxChars: 10000, icon: Mail,      colour: 'oklch(0.65_0.08_160)' },
  blog:       { label: 'Blog Post',           maxChars: 50000, icon: BookOpen,  colour: 'oklch(0.65_0.08_60)'  },
}

export { PLATFORM_META }

interface TransformCardProps {
  platform: TransformPlatform
  content: string
  status: TransformStatus
  onSchedule: (platform: TransformPlatform, content: string) => void
  onEdit: (platform: TransformPlatform, content: string) => void
}

export function TransformCard({ platform, content, status, onSchedule, onEdit }: TransformCardProps) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const meta = PLATFORM_META[platform]
  const Icon = meta.icon
  const charCount = content.length
  const over = charCount > meta.maxChars

  const handleSaveEdit = useCallback(() => {
    onEdit(platform, editContent)
    setEditing(false)
  }, [platform, editContent, onEdit])

  const handleCancelEdit = useCallback(() => {
    setEditContent(content)
    setEditing(false)
  }, [content])

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${meta.colour}` }}
        >
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1">{meta.label}</span>

        {/* Status badge */}
        {status === 'generating' && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating
          </div>
        )}
        {status === 'done' && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400">
            <Check className="h-3 w-3" />
            Done
          </div>
        )}
        {status === 'pending' && (
          <span className="text-[10px] text-muted-foreground/50">Pending</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3">
        {status === 'pending' && !content && (
          <p className="text-xs text-muted-foreground/40 italic">
            Click &ldquo;Generate All&rdquo; to create this variant
          </p>
        )}

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] resize-none font-[family-name:var(--font-ibm-plex-sans)]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex items-center gap-1 rounded-md bg-[oklch(0.75_0.06_240)] px-3 py-1.5 text-[10px] font-medium text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center gap-1 rounded-md bg-[oklch(0.22_0.02_240)] px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-[oklch(0.28_0.03_240)] transition-colors"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          content && (
            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-8 font-[family-name:var(--font-ibm-plex-sans)]">
              {content}
            </p>
          )
        )}
      </div>

      {/* Footer */}
      {(status === 'done' || content) && !editing && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
          <span className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/50'}`}>
            {charCount.toLocaleString()} / {meta.maxChars.toLocaleString()}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { setEditContent(content); setEditing(true) }}
              className="flex items-center gap-1 rounded-md bg-[oklch(0.22_0.02_240)] px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-[oklch(0.28_0.03_240)] transition-colors"
            >
              <PenLine className="h-3 w-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onSchedule(platform, content)}
              className="flex items-center gap-1 rounded-md bg-[oklch(0.75_0.06_240)] px-2.5 py-1 text-[10px] font-medium text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors"
            >
              <Calendar className="h-3 w-3" />
              Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/repurpose/TransformCard.tsx
git commit -m "feat: TransformCard with platform icon, status, inline edit, schedule action"
```

---

### Task 9: RepurposeRoom Component

**Files:**
- Create: `src/components/agency/studio/repurpose/RepurposeRoom.tsx`

- [ ] **Step 1: Create the RepurposeRoom component**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { Sparkles, CalendarPlus, Loader2 } from 'lucide-react'
import { SourceSelector } from './SourceSelector'
import { TransformCard, PLATFORM_META } from './TransformCard'
import type { TransformPlatform, TransformStatus } from './TransformCard'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'

const ALL_TRANSFORM_PLATFORMS: TransformPlatform[] = [
  'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube', 'email', 'blog',
]

interface SourceData {
  type: 'output' | 'text' | 'url'
  title: string
  content: string
  outputId?: string
}

interface TransformResult {
  platform: TransformPlatform
  content: string
  status: TransformStatus
}

export function RepurposeRoom() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  const [source, setSource] = useState<SourceData | null>(null)
  const [transforms, setTransforms] = useState<TransformResult[]>(
    ALL_TRANSFORM_PLATFORMS.map(p => ({ platform: p, content: '', status: 'pending' as TransformStatus })),
  )
  const [addingAll, setAddingAll] = useState(false)

  const handleSourceSelect = useCallback((src: SourceData) => {
    setSource(src)
    // Reset all transforms when source changes
    setTransforms(ALL_TRANSFORM_PLATFORMS.map(p => ({ platform: p, content: '', status: 'pending' })))
  }, [])

  const handleGenerateAll = useCallback(() => {
    if (!source) return

    // Mark all as generating
    setTransforms(prev => prev.map(t => ({ ...t, status: 'generating' as TransformStatus })))

    const platformList = ALL_TRANSFORM_PLATFORMS
      .map(p => PLATFORM_META[p].label)
      .join(', ')

    const message = [
      `Repurpose the following content into ${ALL_TRANSFORM_PLATFORMS.length} platform variants:`,
      `Platforms: ${platformList}`,
      '',
      `Source (${source.type}): "${source.title}"`,
      '---',
      source.content.slice(0, 3000),
      source.content.length > 3000 ? '\n[Content truncated]' : '',
      '---',
      '',
      strategyContext?.agentContext ?? '',
      '',
      `For each platform, write the full adapted content respecting character limits and platform conventions.`,
      `Format each as: **[Platform Name]**\n[Content]\n\n`,
      `Maintain brand voice. Add platform-appropriate hashtags. Check compliance.`,
    ].filter(Boolean).join('\n')

    sendToDirector(message)
  }, [source, strategyContext])

  const handleEdit = useCallback((platform: TransformPlatform, newContent: string) => {
    setTransforms(prev =>
      prev.map(t => t.platform === platform ? { ...t, content: newContent } : t),
    )
  }, [])

  const handleSchedule = useCallback(async (platform: TransformPlatform, content: string) => {
    if (!activeBrandId) return

    // Map repurpose platforms to PostPlatform (email and blog save as outputs, not scheduled posts)
    if (platform === 'email' || platform === 'blog') {
      await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          outputType: platform === 'email' ? 'email_campaign' : 'blog_post',
          title: `Repurposed: ${source?.title ?? 'Untitled'} (${PLATFORM_META[platform].label})`,
          content,
          contentType: strategyContext?.suggestedContentType ?? null,
          contentPillar: strategyContext?.suggestedPillar ?? null,
        }),
      })
    } else {
      // Determine the nearest PostPlatform value
      const postPlatform = platform as 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube'

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)

      await fetch('/api/scheduled-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          platform: postPlatform,
          caption: content,
          hashtags: [],
          status: 'draft',
          scheduledAt: tomorrow.toISOString(),
          contentType: strategyContext?.suggestedContentType ?? null,
          contentPillar: strategyContext?.suggestedPillar ?? null,
        }),
      })
    }

    data.refetch()
  }, [activeBrandId, source, strategyContext, data])

  const handleAddAllToCalendar = useCallback(async () => {
    const doneTransforms = transforms.filter(t => t.status === 'done' && t.content.trim())
    if (doneTransforms.length === 0) return

    setAddingAll(true)
    try {
      await Promise.all(
        doneTransforms.map(t => handleSchedule(t.platform, t.content)),
      )
    } finally {
      setAddingAll(false)
    }
  }, [transforms, handleSchedule])

  const hasDoneTransforms = transforms.some(t => t.status === 'done' && t.content.trim())

  return (
    <div className="flex flex-col gap-5">
      {/* Source selector */}
      <SourceSelector
        brandId={activeBrandId}
        onSourceSelect={handleSourceSelect}
        selectedSourceId={source?.outputId ?? null}
      />

      {/* Selected source preview */}
      {source && (
        <div className="rounded-lg border border-[oklch(0.75_0.06_240)/0.3] bg-[oklch(0.75_0.06_240)/0.05] px-4 py-3">
          <p className="text-[10px] font-medium text-[oklch(0.75_0.06_240)] uppercase tracking-wider mb-1">
            Selected Source
          </p>
          <p className="text-xs font-semibold text-foreground">{source.title}</p>
          <p className="text-[11px] text-foreground/60 line-clamp-3 mt-1 font-[family-name:var(--font-ibm-plex-sans)]">
            {source.content.slice(0, 200)}{source.content.length > 200 ? '...' : ''}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {source && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGenerateAll}
            className="flex items-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-5 py-2.5 text-sm font-semibold text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Generate All Variants
          </button>

          {hasDoneTransforms && (
            <button
              type="button"
              onClick={handleAddAllToCalendar}
              disabled={addingAll}
              className="flex items-center gap-2 rounded-lg bg-[oklch(0.22_0.03_240)] px-5 py-2.5 text-sm font-medium text-foreground hover:bg-[oklch(0.28_0.03_240)] disabled:opacity-40 transition-colors"
            >
              {addingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              Add All to Calendar
            </button>
          )}
        </div>
      )}

      {/* Transform cards grid */}
      {source && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {transforms.map(t => (
            <TransformCard
              key={t.platform}
              platform={t.platform}
              content={t.content}
              status={t.status}
              onSchedule={handleSchedule}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!source && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <p className="text-sm text-muted-foreground">Select content to repurpose</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
            Choose from your past outputs or paste any content. The AI will transform it into {ALL_TRANSFORM_PLATFORMS.length} platform-specific variants.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/repurpose/RepurposeRoom.tsx
git commit -m "feat: RepurposeRoom with source selection, 8-platform transform grid, batch scheduling"
```

---

### Task 10: Wire Content Repurposer into Route Page

**Files:**
- Edit: `src/app/agency/studio/repurpose/page.tsx`

- [ ] **Step 1: Update the page to render RepurposeRoom inside RoomLayout**

Replace the full contents of `src/app/agency/studio/repurpose/page.tsx` with:

```typescript
'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { RepurposeRoom } from '@/components/agency/studio/repurpose/RepurposeRoom'

export default function ContentRepurposerPage() {
  return (
    <RoomLayout title="Content Repurposer">
      <RepurposeRoom />
    </RoomLayout>
  )
}
```

- [ ] **Step 2: Verify the page renders**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run dev &
# Open http://localhost:3000/agency/studio/repurpose in the browser
# Verify: RoomLayout shell, StrategyBrief, SourceSelector, empty state, transform grid after source selection
```

- [ ] **Step 3: Commit**

```bash
git add src/app/agency/studio/repurpose/page.tsx
git commit -m "feat: wire RepurposeRoom into /agency/studio/repurpose route"
```

---

### Task 11: Build + Push

- [ ] **Step 1: Full build check**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run build
```

Expected: Build succeeds with no errors. Fix any TypeScript or import issues.

- [ ] **Step 2: Lint check**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run lint
```

Expected: No new lint errors introduced.

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

- [ ] **Step 4: Verify Vercel deployment**

Check Vercel dashboard or `vercel --prod` output for successful deployment. Visit:
- `https://notrealsmart.com.au/agency/studio/post`
- `https://notrealsmart.com.au/agency/studio/repurpose`

---

## File Summary

### New files (8)
| File | Purpose |
|------|---------|
| `src/components/agency/studio/post/PostEditor.tsx` | Tiptap editor + platform selector + char counts |
| `src/components/agency/studio/post/PlatformPreview.tsx` | IG/LinkedIn/X/FB/generic social mock-ups |
| `src/components/agency/studio/post/PostScheduler.tsx` | Draft/schedule/publish with date picker + best times |
| `src/components/agency/studio/post/PostComposerRoom.tsx` | Main room: AI Writes / I Write / From Drafts |
| `src/components/agency/studio/repurpose/SourceSelector.tsx` | Browse outputs or paste text/URL |
| `src/components/agency/studio/repurpose/TransformCard.tsx` | Per-platform variant card with edit/schedule |
| `src/components/agency/studio/repurpose/RepurposeRoom.tsx` | Main room: source + 8-platform transform grid |

### Edited files (2)
| File | Change |
|------|--------|
| `src/app/agency/studio/post/page.tsx` | Render PostComposerRoom inside RoomLayout |
| `src/app/agency/studio/repurpose/page.tsx` | Render RepurposeRoom inside RoomLayout |

### New dependency (1)
| Package | Purpose |
|---------|---------|
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-character-count` | Rich text editing |
