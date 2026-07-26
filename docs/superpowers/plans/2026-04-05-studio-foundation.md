# Studio Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared foundation (strategy layer, chat panel fix, room routing, launchpad) that all 6 Creative Studio rooms depend on.

**Architecture:** Strategy context hook calculates what content is needed based on brand data + scheduled posts. StrategyBrief component renders at the top of every room. Chat panel uses DOM events (not Zustand) for reliable message sending. Create tab becomes a launchpad linking to room routes. Content tagging via new DB columns.

**Tech Stack:** Next.js 15, React 19, Supabase, Zustand, Tailwind CSS 4, lucide-react, TypeScript

---

### Task 1: Database Migration — Content Tagging Columns

**Files:**
- Create: `supabase/migrations/020_content_tagging.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add content tagging columns for strategy tracking
ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS content_pillar TEXT;

ALTER TABLE outputs
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS content_pillar TEXT;

COMMENT ON COLUMN scheduled_posts.content_type IS 'entertainment | education | inspiration | promotional';
COMMENT ON COLUMN scheduled_posts.content_pillar IS 'Content pillar from brand content_pillars array';
COMMENT ON COLUMN outputs.content_type IS 'entertainment | education | inspiration | promotional';
COMMENT ON COLUMN outputs.content_pillar IS 'Content pillar from brand content_pillars array';
```

- [ ] **Step 2: Run the migration against the live database**

```bash
source .env.local && supabase db push --db-url "postgresql://postgres:${DB_PASSWORD}@db.uyhtrwlotoriblicqqrl.supabase.co:5432/postgres"
```

Expected: Migration applies successfully. Verify with:
```bash
supabase inspect db table-sizes
```

- [ ] **Step 3: Update TypeScript types**

In `src/types/database.ts`, find the `ScheduledPost` interface and add:

```typescript
content_type?: 'entertainment' | 'education' | 'inspiration' | 'promotional' | null
content_pillar?: string | null
```

Find the `Output` interface and add the same two fields.

Add the content type union:
```typescript
export type ContentType = 'entertainment' | 'education' | 'inspiration' | 'promotional'
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_content_tagging.sql src/types/database.ts
git commit -m "feat: add content_type and content_pillar columns for strategy tracking"
```

---

### Task 2: Strategy Context Hook — `useStrategyContext`

**Files:**
- Create: `src/hooks/useStrategyContext.ts`

- [ ] **Step 1: Create the hook**

```typescript
'use client'

import { useMemo } from 'react'
import type { Brand, ScheduledPost } from '@/types/database'
import type { SocialAccount } from '@/hooks/useStudioData'

export interface StrategyContext {
  /** Smart one-liner suggestion for what to create next */
  suggestion: string
  /** Which platform needs attention most */
  suggestedPlatform: string | null
  /** Which content pillar to rotate to */
  suggestedPillar: string | null
  /** Which content type is needed */
  suggestedContentType: 'entertainment' | 'education' | 'inspiration' | 'promotional' | null
  /** Posts this week vs target */
  postsThisWeek: number
  postsTarget: number
  /** Platform distribution this week */
  platformCounts: Record<string, number>
  /** Content type distribution this week */
  typeCounts: Record<string, number>
  /** Connected platforms from Mixpost */
  connectedPlatforms: string[]
  /** Full context string to embed in agent messages */
  agentContext: string
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

const FREQUENCY_TARGETS: Record<string, number> = {
  daily: 7,
  '3x_week': 3,
  '2x_week': 2,
  weekly: 1,
  custom: 3,
}

export function useStrategyContext(
  brand: Brand | null,
  posts: ScheduledPost[],
  accounts: SocialAccount[],
): StrategyContext | null {
  return useMemo(() => {
    if (!brand) return null

    const strategy = brand.channel_strategy as Record<string, unknown> | null
    const channels = (strategy?.channels ?? {}) as Record<string, number>
    const frequency = (strategy?.posting_frequency as string) ?? '3x_week'
    const pillars = (brand.content_pillars as string[]) ?? []
    const postsTarget = FREQUENCY_TARGETS[frequency] ?? 3

    const weekStart = getWeekStart()
    const weekPosts = posts.filter(p => {
      const d = new Date(p.scheduled_at || p.created_at)
      return d >= weekStart && ['scheduled', 'published', 'draft', 'publishing'].includes(p.status)
    })

    const postsThisWeek = weekPosts.length

    // Platform counts this week
    const platformCounts: Record<string, number> = {}
    for (const p of weekPosts) {
      platformCounts[p.platform] = (platformCounts[p.platform] ?? 0) + 1
    }

    // Content type counts this week
    const typeCounts: Record<string, number> = {}
    for (const p of weekPosts) {
      const ct = (p as Record<string, unknown>).content_type as string | null
      if (ct) typeCounts[ct] = (typeCounts[ct] ?? 0) + 1
    }

    // Connected platforms
    const connectedPlatforms = accounts.map(a => a.platform.toLowerCase())

    // Find platform that's most underserved relative to strategy
    let suggestedPlatform: string | null = null
    let worstRatio = Infinity
    for (const [platform, targetPct] of Object.entries(channels)) {
      const actual = platformCounts[platform.toLowerCase()] ?? 0
      const expected = Math.max(1, Math.round((targetPct / 100) * postsTarget))
      const ratio = actual / expected
      if (ratio < worstRatio) {
        worstRatio = ratio
        suggestedPlatform = platform
      }
    }

    // Find pillar to rotate to (least recently used)
    const usedPillars = weekPosts
      .map(p => (p as Record<string, unknown>).content_pillar as string | null)
      .filter(Boolean)
    const suggestedPillar = pillars.find(p => !usedPillars.includes(p)) ?? pillars[0] ?? null

    // Determine content type needed (aim for balance, favour entertainment if low)
    const entertainmentCount = typeCounts['entertainment'] ?? 0
    const educationCount = typeCounts['education'] ?? 0
    let suggestedContentType: StrategyContext['suggestedContentType'] = null
    if (entertainmentCount === 0 && postsThisWeek > 0) {
      suggestedContentType = 'entertainment'
    } else if (educationCount === 0 && postsThisWeek > 0) {
      suggestedContentType = 'education'
    } else if (postsThisWeek === 0) {
      suggestedContentType = 'education' // Start with authority content
    }

    // Build suggestion one-liner
    const parts: string[] = []
    if (postsThisWeek < postsTarget) {
      parts.push(`${postsTarget - postsThisWeek} more post${postsTarget - postsThisWeek > 1 ? 's' : ''} needed this week`)
    }
    if (suggestedPlatform && worstRatio < 1) {
      parts.push(`${suggestedPlatform} needs attention`)
    }
    if (suggestedPillar) {
      parts.push(`rotate to '${suggestedPillar}'`)
    }
    if (suggestedContentType) {
      parts.push(`${suggestedContentType} content needed`)
    }

    const suggestion = parts.length > 0
      ? parts.join('. ') + '.'
      : `On track — ${postsThisWeek}/${postsTarget} posts this week.`

    // Build full agent context string
    const agentContext = [
      `Strategy context for ${brand.name}:`,
      `Posting target: ${postsTarget}/week (${frequency}). This week: ${postsThisWeek}/${postsTarget}.`,
      suggestedPlatform ? `Suggested platform: ${suggestedPlatform} (underserved).` : '',
      suggestedPillar ? `Content pillar to rotate to: "${suggestedPillar}".` : '',
      suggestedContentType ? `Content type needed: ${suggestedContentType}.` : '',
      connectedPlatforms.length > 0 ? `Connected via Mixpost: ${connectedPlatforms.join(', ')}.` : '',
      Object.keys(channels).length > 0
        ? `Channel allocation: ${Object.entries(channels).map(([p, pct]) => `${p} ${pct}%`).join(', ')}.`
        : '',
      brand.compliance_flags?.ahpra ? 'AHPRA compliant required.' : '',
      brand.compliance_flags?.tga ? 'TGA compliant required.' : '',
      brand.tone_of_voice ? `Voice: ${(brand.tone_of_voice as Record<string, unknown>).formality ?? ''}, ${(brand.tone_of_voice as Record<string, unknown>).humour ?? ''}.` : '',
      (brand.post_signature as Record<string, unknown>)?.enabled ? `Post signature required.` : '',
    ].filter(Boolean).join(' ')

    return {
      suggestion,
      suggestedPlatform,
      suggestedPillar,
      suggestedContentType,
      postsThisWeek,
      postsTarget,
      platformCounts,
      typeCounts,
      connectedPlatforms,
      agentContext,
    }
  }, [brand, posts, accounts])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useStrategyContext.ts
git commit -m "feat: useStrategyContext hook — calculates what content is needed based on strategy"
```

---

### Task 3: Strategy Brief Component

**Files:**
- Create: `src/components/agency/studio/StrategyBrief.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { Target } from 'lucide-react'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface StrategyBriefProps {
  context: StrategyContext | null
}

export function StrategyBrief({ context }: StrategyBriefProps) {
  if (!context) return null

  const { postsThisWeek, postsTarget, suggestion } = context
  const onTrack = postsThisWeek >= postsTarget

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
      <Target className={`h-4 w-4 shrink-0 ${onTrack ? 'text-emerald-400' : 'text-amber-400'}`} />
      <p className="text-xs text-foreground/80 flex-1">{suggestion}</p>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {postsThisWeek}/{postsTarget} this week
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/StrategyBrief.tsx
git commit -m "feat: StrategyBrief component — smart one-liner at top of every room"
```

---

### Task 4: Fix Chat Panel DOM Event Communication

**Files:**
- Modify: `src/components/agency/ChatPanel.tsx`

The `nrs-send-chat` listener already exists (lines 164-177). Verify it works by also ensuring the panel auto-expands when an event arrives.

- [ ] **Step 1: Verify the existing listener handles expansion**

Read `src/components/agency/ChatPanel.tsx` lines 164-177. The handler should:
1. Expand if minimised
2. Open if closed
3. Call `handleSendRef.current(msg)`

If the handler doesn't expand/open, update it to:

```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const msg = (e as CustomEvent).detail?.message
    if (!msg) return
    if (chatPanelMinimised) setChatPanelMinimised(false)
    if (!chatPanelOpen) setChatPanelOpen(true)
    // Small delay to let panel render if it was closed
    setTimeout(() => handleSendRef.current(msg), chatPanelOpen ? 0 : 300)
  }
  window.addEventListener('nrs-send-chat', handler)
  return () => window.removeEventListener('nrs-send-chat', handler)
}, [chatPanelMinimised, chatPanelOpen, setChatPanelMinimised, setChatPanelOpen])
```

- [ ] **Step 2: Create a utility function for dispatching**

Create `src/lib/chat-dispatch.ts`:

```typescript
/**
 * Send a message to the Director via the inline chat panel.
 * Uses DOM event to bypass Zustand — guaranteed to work.
 */
export function sendToDirector(message: string) {
  window.dispatchEvent(
    new CustomEvent('nrs-send-chat', { detail: { message } })
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agency/ChatPanel.tsx src/lib/chat-dispatch.ts
git commit -m "feat: sendToDirector utility — reliable DOM event dispatch to chat panel"
```

---

### Task 5: Room Layout Shell

**Files:**
- Create: `src/components/agency/studio/RoomLayout.tsx`

All rooms share the same layout: back button, strategy brief, main content, chat panel on right.

- [ ] **Step 1: Create the shared room layout**

```typescript
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { StrategyBrief } from './StrategyBrief'
import { useEffect } from 'react'

interface RoomLayoutProps {
  title: string
  children: React.ReactNode
}

export function RoomLayout({ title, children }: RoomLayoutProps) {
  const { activeBrandId, setChatPanelOpen } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Auto-open chat panel in every room
  useEffect(() => {
    setChatPanelOpen(true)
  }, [setChatPanelOpen])

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-4 pb-2">
        <Link
          href="/agency/studio"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Studio
        </Link>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>

      {/* Strategy Brief */}
      <div className="px-6 pb-3">
        <StrategyBrief context={strategyContext} />
      </div>

      {/* Room content */}
      <div className="flex-1 px-6 pb-6">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/RoomLayout.tsx
git commit -m "feat: RoomLayout shell — shared layout for all studio rooms with strategy brief"
```

---

### Task 6: Room Route Pages (Stubs)

**Files:**
- Create: `src/app/agency/studio/video/page.tsx`
- Create: `src/app/agency/studio/design/page.tsx`
- Create: `src/app/agency/studio/post/page.tsx`
- Create: `src/app/agency/studio/campaign/page.tsx`
- Create: `src/app/agency/studio/repurpose/page.tsx`

- [ ] **Step 1: Create all 5 route stubs**

Each follows the same pattern. Example for video:

```typescript
// src/app/agency/studio/video/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { RoomLayout } from '@/components/agency/studio/RoomLayout'

export default function VideoRoomPage() {
  return (
    <RoomLayout title="Video Room">
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        Video Room — coming soon
      </div>
    </RoomLayout>
  )
}
```

Repeat for design (`Design Room`), post (`Post Composer`), campaign (`Campaign Planner`), repurpose (`Content Repurposer`).

- [ ] **Step 2: Verify routes work**

```bash
npm run build
```

Expected: Build succeeds with new routes visible in output.

- [ ] **Step 3: Commit**

```bash
git add src/app/agency/studio/video src/app/agency/studio/design src/app/agency/studio/post src/app/agency/studio/campaign src/app/agency/studio/repurpose
git commit -m "feat: stub routes for all 5 studio rooms"
```

---

### Task 7: Create Tab Launchpad — Strategy-Aware Door Cards

**Files:**
- Modify: `src/components/agency/studio/CreateHub.tsx`

Replace the current broken intent cards with door cards that link to room routes and show strategy context.

- [ ] **Step 1: Rewrite CreateHub as launchpad**

```typescript
'use client'

import Link from 'next/link'
import { PenLine, CalendarDays, Video, Palette, Target, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { StrategyBrief } from './StrategyBrief'

const ROOM_CARDS = [
  {
    icon: Video,
    colour: 'bg-red-500/15 text-red-400',
    title: 'Create a Video',
    description: 'Plan, edit yourself, or bulk import. NRS Video Toolkit + Canva.',
    href: '/agency/studio/video',
  },
  {
    icon: Palette,
    colour: 'bg-purple-500/15 text-purple-400',
    title: 'Design in Canva',
    description: 'Create graphics with AI, browse templates, or upload your own.',
    href: '/agency/studio/design',
  },
  {
    icon: PenLine,
    colour: 'bg-blue-500/15 text-blue-400',
    title: 'Write a Post',
    description: 'AI writes it, you edit, or both. Live platform previews.',
    href: '/agency/studio/post',
  },
  {
    icon: Target,
    colour: 'bg-amber-500/15 text-amber-400',
    title: 'Run a Campaign',
    description: 'Director convenes all departments. Full multi-channel plan.',
    href: '/agency/studio/campaign',
  },
  {
    icon: Repeat,
    colour: 'bg-emerald-500/15 text-emerald-400',
    title: 'Repurpose Content',
    description: 'Turn one piece into posts, clips, blogs, and newsletters.',
    href: '/agency/studio/repurpose',
  },
  {
    icon: CalendarDays,
    colour: 'bg-orange-500/15 text-orange-400',
    title: 'Fill My Calendar',
    description: 'AI fills gaps based on your strategy. Drag and drop.',
    href: '#calendar', // Handled specially — switches to Calendar tab
  },
]

export function CreateHub() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  if (!activeBrandId) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Select a brand from the sidebar to start creating content.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Strategy Brief */}
      <StrategyBrief context={strategyContext} />

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Create Content</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a workspace. AI helps, you control.
        </p>
      </div>

      {/* Room Door Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROOM_CARDS.map(card => {
          const Icon = card.icon
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 space-y-3"
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.colour)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds. Cards render as links to room routes.

- [ ] **Step 3: Commit**

```bash
git add src/components/agency/studio/CreateHub.tsx
git commit -m "feat: Create tab as launchpad — 6 door cards linking to room routes with strategy brief"
```

---

### Task 8: Wire StrategyBrief into Existing Dashboard

**Files:**
- Modify: `src/components/agency/studio/StudioDashboard.tsx`

- [ ] **Step 1: Add strategy context to the dashboard**

At the top of `StudioDashboard`, import and use the hooks:

```typescript
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { StrategyBrief } from './StrategyBrief'
```

Inside the component, after the `useStudioData` call:

```typescript
const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)
```

Add the `StrategyBrief` between the `DirectorBriefing` and the `SocialConnectionsCard`:

```tsx
{/* Strategy Brief */}
{strategyContext && <StrategyBrief context={strategyContext} />}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agency/studio/StudioDashboard.tsx
git commit -m "feat: add StrategyBrief to dashboard — strategy context visible on All Content tab"
```

---

### Task 9: Build Verification + Push

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: Zero errors, all new routes visible.

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

- [ ] **Step 3: Verify on live site**

1. Navigate to `/agency/studio` → Create tab → see 6 door cards with strategy brief
2. Click any card → navigates to room route with RoomLayout + strategy brief
3. Back button returns to Studio
4. Dashboard (All Content) shows StrategyBrief above the cards
