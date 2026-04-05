# Planning Rooms Implementation Plan (Campaign Planner + Calendar Enhancement)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans

**Goal:** Build the Campaign Planner (/agency/studio/campaign) and enhance the Calendar tab

**Architecture:** Campaign Planner uses sendToDirector to trigger convene_meeting with 6 departments. Results displayed in timeline/card view. Calendar enhanced with FullCalendar for drag-and-drop, strategy overlay, bulk actions.

**Tech Stack:** Next.js 15, React 19, FullCalendar (React), TypeScript

**Dependencies:** Foundation plan must be complete (it is).

---

### Task 1: CampaignBrief Component

**Files:**
- Create: `src/components/agency/studio/campaign/CampaignBrief.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/agency/studio/campaign/CampaignBrief.tsx
'use client'

import { useState } from 'react'
import { Rocket, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'

export type CampaignDuration = '1_week' | '2_weeks' | '1_month' | '3_months'

export interface CampaignBriefData {
  name: string
  goal: string
  duration: CampaignDuration
  audience: string
}

const DURATION_OPTIONS: { value: CampaignDuration; label: string }[] = [
  { value: '1_week', label: '1 week' },
  { value: '2_weeks', label: '2 weeks' },
  { value: '1_month', label: '1 month' },
  { value: '3_months', label: '3 months' },
]

const DURATION_LABELS: Record<CampaignDuration, string> = {
  '1_week': '1 week',
  '2_weeks': '2 weeks',
  '1_month': '1 month',
  '3_months': '3 months',
}

interface CampaignBriefProps {
  onSubmit: (brief: CampaignBriefData) => void
  isSubmitting: boolean
}

export function CampaignBrief({ onSubmit, isSubmitting }: CampaignBriefProps) {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Pre-fill audience from brand data
  const defaultAudience = data.brand?.target_audience
    ? typeof data.brand.target_audience === 'string'
      ? data.brand.target_audience
      : JSON.stringify(data.brand.target_audience)
    : ''

  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [duration, setDuration] = useState<CampaignDuration>('1_month')
  const [audience, setAudience] = useState(defaultAudience)

  const canSubmit = name.trim().length > 0 && goal.trim().length > 0 && !isSubmitting

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit({ name: name.trim(), goal: goal.trim(), duration, audience: audience.trim() })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Campaign Brief</h2>
          <p className="text-xs text-muted-foreground">
            Describe your campaign and the Director will convene all departments.
          </p>
        </div>
      </div>

      {/* Campaign name */}
      <div className="space-y-1.5">
        <label htmlFor="campaign-name" className="text-xs font-medium text-foreground/80">
          Campaign name
        </label>
        <input
          id="campaign-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Winter Weight Loss Launch"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Goal description */}
      <div className="space-y-1.5">
        <label htmlFor="campaign-goal" className="text-xs font-medium text-foreground/80">
          What do you want to achieve?
        </label>
        <textarea
          id="campaign-goal"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          rows={3}
          placeholder="e.g. Launch our new weight loss program to 25-45 year old professionals. Drive 200 bookings in the first month."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Duration + Audience row */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Duration */}
        <div className="space-y-1.5">
          <label htmlFor="campaign-duration" className="text-xs font-medium text-foreground/80">
            Duration
          </label>
          <div className="relative">
            <select
              id="campaign-duration"
              value={duration}
              onChange={e => setDuration(e.target.value as CampaignDuration)}
              className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Target audience */}
        <div className="space-y-1.5">
          <label htmlFor="campaign-audience" className="text-xs font-medium text-foreground/80">
            Target audience
          </label>
          <input
            id="campaign-audience"
            type="text"
            value={audience}
            onChange={e => setAudience(e.target.value)}
            placeholder="Pre-filled from brand data"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Strategy nudge */}
      {strategyContext && (
        <p className="text-[11px] text-muted-foreground italic">
          Strategy hint: {strategyContext.suggestion}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
          canSubmit
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {isSubmitting ? 'Convening departments...' : 'Plan Campaign'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/campaign/CampaignBrief.tsx
git commit -m "feat: CampaignBrief component — campaign name, goal, duration, audience inputs"
```

---

### Task 2: CampaignTimeline Component

**Files:**
- Create: `src/components/agency/studio/campaign/CampaignTimeline.tsx`

- [ ] **Step 1: Create the timeline component (pure CSS grid, no external dep)**

```typescript
// src/components/agency/studio/campaign/CampaignTimeline.tsx
'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CampaignDuration } from './CampaignBrief'

export interface TimelinePhase {
  name: string
  startWeek: number
  endWeek: number
  colour: string
}

export interface TimelineItem {
  id: string
  label: string
  week: number
  department: string
  status: 'pending' | 'generating' | 'complete'
}

interface CampaignTimelineProps {
  duration: CampaignDuration
  items: TimelineItem[]
  campaignName: string
}

const DURATION_WEEKS: Record<CampaignDuration, number> = {
  '1_week': 1,
  '2_weeks': 2,
  '1_month': 4,
  '3_months': 12,
}

function buildPhases(totalWeeks: number): TimelinePhase[] {
  if (totalWeeks <= 1) {
    return [
      { name: 'Prep + Launch', startWeek: 1, endWeek: 1, colour: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ]
  }
  if (totalWeeks <= 2) {
    return [
      { name: 'Preparation', startWeek: 1, endWeek: 1, colour: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      { name: 'Launch', startWeek: 2, endWeek: 2, colour: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    ]
  }
  const prep = Math.max(1, Math.floor(totalWeeks * 0.25))
  const launch = Math.max(1, Math.floor(totalWeeks * 0.25))
  const sustain = Math.max(1, totalWeeks - prep - launch - 1)
  const review = 1

  return [
    { name: 'Preparation', startWeek: 1, endWeek: prep, colour: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { name: 'Launch', startWeek: prep + 1, endWeek: prep + launch, colour: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { name: 'Sustain', startWeek: prep + launch + 1, endWeek: prep + launch + sustain, colour: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { name: 'Review', startWeek: totalWeeks, endWeek: totalWeeks, colour: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  ]
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-zinc-500',
  generating: 'bg-amber-400 animate-pulse',
  complete: 'bg-emerald-400',
}

export function CampaignTimeline({ duration, items, campaignName }: CampaignTimelineProps) {
  const totalWeeks = DURATION_WEEKS[duration]
  const phases = useMemo(() => buildPhases(totalWeeks), [totalWeeks])
  const weekNumbers = useMemo(() => Array.from({ length: totalWeeks }, (_, i) => i + 1), [totalWeeks])

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{campaignName} Timeline</h3>
        <span className="text-xs text-muted-foreground">
          {totalWeeks} week{totalWeeks > 1 ? 's' : ''}
        </span>
      </div>

      {/* Phase bar */}
      <div className="flex gap-1 rounded-lg overflow-hidden">
        {phases.map(phase => {
          const span = phase.endWeek - phase.startWeek + 1
          const widthPct = (span / totalWeeks) * 100
          return (
            <div
              key={phase.name}
              className={cn('px-3 py-1.5 text-[11px] font-medium border rounded', phase.colour)}
              style={{ width: `${widthPct}%`, minWidth: 'fit-content' }}
            >
              {phase.name}
            </div>
          )
        })}
      </div>

      {/* Week columns grid */}
      <div className="overflow-x-auto">
        <div
          className="grid gap-px min-w-fit"
          style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(100px, 1fr))` }}
        >
          {/* Week headers */}
          {weekNumbers.map(w => (
            <div key={`h-${w}`} className="px-2 py-1 text-[10px] font-medium text-muted-foreground text-center border-b border-border">
              Week {w}
            </div>
          ))}

          {/* Content items per week */}
          {weekNumbers.map(w => {
            const weekItems = items.filter(item => item.week === w)
            return (
              <div key={`c-${w}`} className="px-1.5 py-2 space-y-1.5 min-h-[60px]">
                {weekItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[item.status])} />
                    <span className="text-[10px] text-foreground truncate">{item.label}</span>
                  </div>
                ))}
                {weekItems.length === 0 && (
                  <div className="text-[10px] text-muted-foreground/40 text-center italic">--</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/campaign/CampaignTimeline.tsx
git commit -m "feat: CampaignTimeline — CSS grid timeline with phases and content items"
```

---

### Task 3: DepartmentDeliverable Component

**Files:**
- Create: `src/components/agency/studio/campaign/DepartmentDeliverable.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/agency/studio/campaign/DepartmentDeliverable.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { AGENT_COLOURS } from '@/components/agency/AgentAvatar'
import type { AgentType } from '@/types/database'

const AGENT_PERSONALITIES: Record<string, string> = {
  overall: 'The Director',
  content: 'The Storyteller',
  seo: 'The Search Scientist',
  paid_ads: 'The Performance Marketer',
  strategy: 'The Strategist',
  email: 'The Relationship Builder',
  growth: 'The Growth Hacker',
  brand: 'The Brand Guardian',
  competitor: 'The Intelligence Analyst',
  website: 'The Conversion Architect',
  compliance: 'The Regulatory Shield',
  analytics: 'The Data Translator',
  automation: 'The Systems Architect',
  video: 'The Visual Director',
}

export type DeliverableStatus = 'pending' | 'generating' | 'complete'

export interface DepartmentDeliverableData {
  agentType: AgentType
  title: string
  content: string | null
  status: DeliverableStatus
}

interface DepartmentDeliverableProps {
  deliverable: DepartmentDeliverableData
  campaignName: string
  brandName: string
}

export function DepartmentDeliverable({ deliverable, campaignName, brandName }: DepartmentDeliverableProps) {
  const [expanded, setExpanded] = useState(deliverable.status === 'complete')
  const personality = AGENT_PERSONALITIES[deliverable.agentType] ?? deliverable.agentType
  const colours = AGENT_COLOURS[deliverable.agentType] ?? AGENT_COLOURS.overall
  const badgeClasses = colours.split(' ').slice(0, 2).join(' ')

  function handleGenerateAssets() {
    sendToDirector(
      `For the "${campaignName}" campaign for ${brandName}, ` +
      `generate the ${deliverable.title.toLowerCase()} deliverables. ` +
      `Focus on what the ${personality} department recommended. Create the actual content assets.`
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Agent badge */}
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', badgeClasses)}>
          {personality}
        </span>

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-foreground">{deliverable.title}</span>

        {/* Status indicator */}
        {deliverable.status === 'pending' && (
          <span className="text-[10px] text-muted-foreground">Pending</span>
        )}
        {deliverable.status === 'generating' && (
          <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
        )}
        {deliverable.status === 'complete' && (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        )}

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {deliverable.content ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {deliverable.content}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No plan generated yet. Click &ldquo;Plan Campaign&rdquo; above to convene all departments.
            </p>
          )}

          {/* Generate assets button */}
          {deliverable.status === 'complete' && (
            <button
              onClick={handleGenerateAssets}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate assets
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/campaign/DepartmentDeliverable.tsx
git commit -m "feat: DepartmentDeliverable — expandable card per department with generate button"
```

---

### Task 4: CampaignPlannerRoom Component

**Files:**
- Create: `src/components/agency/studio/campaign/CampaignPlannerRoom.tsx`

- [ ] **Step 1: Create the room component**

```typescript
// src/components/agency/studio/campaign/CampaignPlannerRoom.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { Sparkles, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { CampaignBrief, type CampaignBriefData, type CampaignDuration } from './CampaignBrief'
import { CampaignTimeline, type TimelineItem } from './CampaignTimeline'
import { DepartmentDeliverable, type DepartmentDeliverableData, type DeliverableStatus } from './DepartmentDeliverable'
import type { AgentType } from '@/types/database'

// The 6 departments that contribute to a campaign
const CAMPAIGN_DEPARTMENTS: { agentType: AgentType; title: string; brief: string }[] = [
  {
    agentType: 'strategy',
    title: 'Strategy & Timeline',
    brief: 'Timeline, milestones, success metrics, 30/60/90 plan alignment',
  },
  {
    agentType: 'content',
    title: 'Content & Copy',
    brief: 'Social posts, blog articles, scripts, messaging framework',
  },
  {
    agentType: 'seo',
    title: 'SEO & Keywords',
    brief: 'Keyword targets, landing page optimisation, topic clusters',
  },
  {
    agentType: 'email',
    title: 'Email Marketing',
    brief: 'Nurture sequence, launch announcement, re-engagement',
  },
  {
    agentType: 'paid_ads',
    title: 'Paid Advertising',
    brief: 'Ad copy, targeting, budget allocation, platform selection',
  },
  {
    agentType: 'compliance',
    title: 'Compliance Review',
    brief: 'AHPRA/TGA review of all campaign materials',
  },
]

interface CampaignPlannerRoomProps {
  brandName: string | null
}

export function CampaignPlannerRoom({ brandName }: CampaignPlannerRoomProps) {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  const [submittedBrief, setSubmittedBrief] = useState<CampaignBriefData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deliverables, setDeliverables] = useState<DepartmentDeliverableData[]>(
    CAMPAIGN_DEPARTMENTS.map(dept => ({
      agentType: dept.agentType,
      title: dept.title,
      content: null,
      status: 'pending' as DeliverableStatus,
    }))
  )
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])

  // Listen for agent responses via custom event to update deliverables
  // The Director/meeting results will come through chat — we parse them
  // when the user clicks "Plan Campaign"
  const handleBriefSubmit = useCallback((brief: CampaignBriefData) => {
    setSubmittedBrief(brief)
    setIsSubmitting(true)

    // Mark all deliverables as generating
    setDeliverables(prev =>
      prev.map(d => ({ ...d, status: 'generating' as DeliverableStatus, content: null }))
    )

    // Build strategy-enriched message for the Director
    const strategyHint = strategyContext?.agentContext ?? ''
    const audienceInfo = brief.audience ? `Target audience: ${brief.audience}. ` : ''

    const message = [
      `Plan a full campaign for ${brandName ?? 'this brand'}: "${brief.name}".`,
      ``,
      `Goal: ${brief.goal}`,
      `Duration: ${brief.duration.replace('_', ' ')}.`,
      audienceInfo,
      ``,
      `Convene a meeting with Strategy, Content, SEO, Email, Paid Ads, and Compliance.`,
      `Each department should provide:`,
      `- Strategy: timeline with phases, milestones, success metrics`,
      `- Content: post themes, blog topics, scripts needed`,
      `- SEO: keyword targets, landing page recommendations`,
      `- Email: sequences, subject lines, send schedule`,
      `- Paid Ads: ad copy, targeting, budget split, platform recommendations`,
      `- Compliance: flag any regulatory risks (AHPRA/TGA if applicable)`,
      ``,
      strategyHint ? `${strategyHint}` : '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)

    // After sending, reset submitting state (the chat panel handles the response)
    setTimeout(() => setIsSubmitting(false), 2000)
  }, [brandName, strategyContext])

  function handleGenerateAll() {
    if (!submittedBrief || !brandName) return
    sendToDirector(
      `For the "${submittedBrief.name}" campaign for ${brandName}, ` +
      `generate ALL content assets across every department. ` +
      `Create the actual posts, emails, ad copy, and blog drafts. Save everything to the output library.`
    )
  }

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to plan a campaign.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Brief input */}
      {!submittedBrief && (
        <CampaignBrief onSubmit={handleBriefSubmit} isSubmitting={isSubmitting} />
      )}

      {/* After brief submitted: timeline + department cards */}
      {submittedBrief && (
        <>
          {/* Campaign header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">{submittedBrief.name}</h2>
              <p className="text-xs text-muted-foreground">{submittedBrief.goal}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSubmittedBrief(null)
                  setDeliverables(CAMPAIGN_DEPARTMENTS.map(dept => ({
                    agentType: dept.agentType,
                    title: dept.title,
                    content: null,
                    status: 'pending' as DeliverableStatus,
                  })))
                  setTimelineItems([])
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                New campaign
              </button>
              <button
                onClick={handleGenerateAll}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate All
              </button>
            </div>
          </div>

          {/* Timeline */}
          <CampaignTimeline
            duration={submittedBrief.duration}
            items={timelineItems}
            campaignName={submittedBrief.name}
          />

          {/* Department cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Department Plans</h3>
              <span className="text-[10px] text-muted-foreground">
                {deliverables.filter(d => d.status === 'complete').length}/{deliverables.length} complete
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {deliverables.map(deliverable => (
                <DepartmentDeliverable
                  key={deliverable.agentType}
                  deliverable={deliverable}
                  campaignName={submittedBrief.name}
                  brandName={brandName ?? 'this brand'}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/campaign/CampaignPlannerRoom.tsx
git commit -m "feat: CampaignPlannerRoom — brief + timeline + 6 department cards with Generate All"
```

---

### Task 5: Wire CampaignPlannerRoom into Route Page

**Files:**
- Modify: `src/app/agency/studio/campaign/page.tsx`

- [ ] **Step 1: Replace stub with full room**

```typescript
// src/app/agency/studio/campaign/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { CampaignPlannerRoom } from '@/components/agency/studio/campaign/CampaignPlannerRoom'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'

export default function CampaignPlannerPage() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)

  return (
    <RoomLayout title="Campaign Planner">
      <CampaignPlannerRoom brandName={data.brand?.name ?? null} />
    </RoomLayout>
  )
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds. Campaign Planner route loads with CampaignBrief form. After submitting, timeline and department cards appear. "Plan Campaign" sends a structured message to the Director. "Generate All" and per-department "Generate assets" buttons send focused requests.

- [ ] **Step 3: Commit**

```bash
git add src/app/agency/studio/campaign/page.tsx
git commit -m "feat: wire CampaignPlannerRoom into /agency/studio/campaign route"
```

---

### Task 6: Install FullCalendar

- [ ] **Step 1: Install packages**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/interaction
```

- [ ] **Step 2: Verify installation**

```bash
npm ls @fullcalendar/react
```

Expected: Shows installed version.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @fullcalendar/react, @fullcalendar/daygrid, @fullcalendar/interaction"
```

---

### Task 7: EnhancedCalendar Component

**Files:**
- Create: `src/components/agency/studio/EnhancedCalendar.tsx`

- [ ] **Step 1: Create the FullCalendar-based calendar**

```typescript
// src/components/agency/studio/EnhancedCalendar.tsx
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg, DateClickArg, EventClickArg } from '@fullcalendar/interaction'
import type { EventInput } from '@fullcalendar/core'
import {
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  CalendarDays,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import type { ScheduledPost, PostPlatform, ScheduledPostStatus } from '@/types/database'

// ─── Platform Colours (oklch-based) ──────────────────────────────────────────

const PLATFORM_EVENT_COLOURS: Record<PostPlatform, { bg: string; border: string; text: string }> = {
  instagram: { bg: '#ec489930', border: '#ec4899', text: '#f472b6' },
  facebook: { bg: '#3b82f630', border: '#3b82f6', text: '#60a5fa' },
  linkedin: { bg: '#0ea5e930', border: '#0ea5e9', text: '#38bdf8' },
  twitter: { bg: '#71717a30', border: '#71717a', text: '#a1a1aa' },
  tiktok: { bg: '#06b6d430', border: '#06b6d4', text: '#22d3ee' },
  youtube: { bg: '#ef444430', border: '#ef4444', text: '#f87171' },
}

const STATUS_INDICATOR: Record<ScheduledPostStatus, { icon: typeof Check; colour: string }> = {
  draft: { icon: Clock, colour: 'text-zinc-400' },
  scheduled: { icon: CalendarDays, colour: 'text-blue-400' },
  publishing: { icon: Clock, colour: 'text-amber-400' },
  published: { icon: Check, colour: 'text-emerald-400' },
  failed: { icon: AlertCircle, colour: 'text-red-400' },
  cancelled: { icon: AlertCircle, colour: 'text-zinc-500' },
}

// ─── Post Detail Side Panel ──────────────────────────────────────────────────

interface PostDetailPanelProps {
  post: ScheduledPost | null
  onClose: () => void
}

function PostDetailPanel({ post, onClose }: PostDetailPanelProps) {
  if (!post) return null

  const platform = post.platform as PostPlatform
  const colours = PLATFORM_EVENT_COLOURS[platform]
  const statusInfo = STATUS_INDICATOR[post.status]
  const StatusIcon = statusInfo.icon

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-border bg-card shadow-xl overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Post Detail</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Platform + Status */}
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: colours.bg, color: colours.text, border: `1px solid ${colours.border}` }}
          >
            {platform}
          </span>
          <div className={cn('flex items-center gap-1 text-[10px]', statusInfo.colour)}>
            <StatusIcon className="h-3 w-3" />
            {post.status}
          </div>
        </div>

        {/* Content type badge */}
        {post.content_type && (
          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {post.content_type}
          </span>
        )}

        {/* Caption */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Caption</p>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {post.caption || 'No caption'}
          </p>
        </div>

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hashtags</p>
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map(tag => (
                <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Scheduled time */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Scheduled</p>
          <p className="text-xs text-foreground/80">
            {new Date(post.scheduled_at).toLocaleString('en-AU', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>

        {/* Content pillar */}
        {post.content_pillar && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Content Pillar</p>
            <p className="text-xs text-foreground/80">{post.content_pillar}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Strategy Overlay Bar ────────────────────────────────────────────────────

interface StrategyOverlayProps {
  postsThisWeek: number
  postsTarget: number
  platformCounts: Record<string, number>
  connectedPlatforms: string[]
}

function StrategyOverlay({ postsThisWeek, postsTarget, platformCounts, connectedPlatforms }: StrategyOverlayProps) {
  const ratio = postsTarget > 0 ? Math.min(postsThisWeek / postsTarget, 1) : 0

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5">
      {/* Progress bar */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">
          {postsThisWeek}/{postsTarget} this week
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              ratio >= 1 ? 'bg-emerald-500' : ratio >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>

      {/* Platform distribution */}
      <div className="flex items-center gap-1.5 shrink-0">
        {connectedPlatforms.slice(0, 5).map(platform => {
          const count = platformCounts[platform] ?? 0
          return (
            <span
              key={platform}
              className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
            >
              {platform.slice(0, 2).toUpperCase()} {count}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Enhanced Calendar ───────────────────────────────────────────────────────

export function EnhancedCalendar() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [loading, setLoading] = useState(false)
  const calendarRef = useRef<FullCalendar>(null)

  // Fetch posts for the visible date range
  const fetchPosts = useCallback(async (startDate?: string, endDate?: string) => {
    if (!activeBrandId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ brand_id: activeBrandId })
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      const res = await fetch(`/api/scheduled-posts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts ?? data ?? [])
      }
    } catch {
      // Silently fail — calendar shows empty
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Convert posts to FullCalendar events
  const events: EventInput[] = posts.map(post => {
    const platform = post.platform as PostPlatform
    const colours = PLATFORM_EVENT_COLOURS[platform] ?? PLATFORM_EVENT_COLOURS.instagram
    return {
      id: post.id,
      title: post.caption?.slice(0, 50) || `${platform} post`,
      start: post.scheduled_at,
      backgroundColor: colours.bg,
      borderColor: colours.border,
      textColor: colours.text,
      extendedProps: { post },
    }
  })

  // Handle drag-and-drop reschedule
  async function handleEventDrop(info: EventDropArg) {
    const postId = info.event.id
    const newDate = info.event.start?.toISOString()
    if (!postId || !newDate) {
      info.revert()
      return
    }

    try {
      const res = await fetch(`/api/scheduled-posts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, scheduled_at: newDate }),
      })
      if (!res.ok) {
        info.revert()
      } else {
        // Update local state
        setPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, scheduled_at: newDate } : p))
        )
      }
    } catch {
      info.revert()
    }
  }

  // Handle click on event
  function handleEventClick(info: EventClickArg) {
    const post = info.event.extendedProps.post as ScheduledPost
    setSelectedPost(post)
  }

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to view the calendar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Strategy overlay */}
      {strategyContext && (
        <StrategyOverlay
          postsThisWeek={strategyContext.postsThisWeek}
          postsTarget={strategyContext.postsTarget}
          platformCounts={strategyContext.platformCounts}
          connectedPlatforms={strategyContext.connectedPlatforms}
        />
      )}

      {/* Calendar */}
      <div className="rounded-xl border border-border bg-card p-4 enhanced-calendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          height="auto"
          firstDay={1}
          eventDisplay="block"
          dayMaxEvents={3}
          moreLinkClick="popover"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }}
        />
      </div>

      {/* Post detail panel */}
      {selectedPost && (
        <PostDetailPanel post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}

      {/* FullCalendar theme overrides */}
      <style jsx global>{`
        .enhanced-calendar .fc {
          --fc-border-color: oklch(0.3 0.01 240);
          --fc-button-bg-color: oklch(0.25 0.01 240);
          --fc-button-border-color: oklch(0.35 0.01 240);
          --fc-button-hover-bg-color: oklch(0.35 0.01 240);
          --fc-button-hover-border-color: oklch(0.45 0.01 240);
          --fc-button-active-bg-color: oklch(0.4 0.02 240);
          --fc-button-active-border-color: oklch(0.5 0.02 240);
          --fc-button-text-color: oklch(0.85 0.01 240);
          --fc-today-bg-color: oklch(0.2 0.02 240 / 0.3);
          --fc-neutral-bg-color: oklch(0.15 0.01 240);
          --fc-page-bg-color: transparent;
          --fc-event-border-color: transparent;
          font-family: var(--font-ibm-plex-sans), system-ui, sans-serif;
        }
        .enhanced-calendar .fc .fc-daygrid-day-number {
          color: oklch(0.7 0.01 240);
          font-size: 0.75rem;
          padding: 4px 8px;
        }
        .enhanced-calendar .fc .fc-col-header-cell-cushion {
          color: oklch(0.6 0.01 240);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 500;
        }
        .enhanced-calendar .fc .fc-event {
          border-radius: 4px;
          padding: 1px 4px;
          font-size: 0.65rem;
          cursor: pointer;
        }
        .enhanced-calendar .fc .fc-toolbar-title {
          color: oklch(0.9 0.01 240);
          font-size: 1rem;
          font-weight: 600;
        }
        .enhanced-calendar .fc .fc-button {
          font-size: 0.75rem;
          padding: 4px 10px;
          border-radius: 6px;
        }
        .enhanced-calendar .fc .fc-more-link {
          color: oklch(0.7 0.15 240);
          font-size: 0.65rem;
        }
        .enhanced-calendar .fc .fc-daygrid-day.fc-day-today {
          background: oklch(0.2 0.02 240 / 0.3);
        }
        .enhanced-calendar .fc .fc-scrollgrid {
          border: none;
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/EnhancedCalendar.tsx
git commit -m "feat: EnhancedCalendar — FullCalendar with drag-and-drop, strategy overlay, post detail panel"
```

---

### Task 8: CalendarActions Component

**Files:**
- Create: `src/components/agency/studio/CalendarActions.tsx`

- [ ] **Step 1: Create the actions bar**

```typescript
// src/components/agency/studio/CalendarActions.tsx
'use client'

import { useState } from 'react'
import { Sparkles, CheckCircle, CalendarRange, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import type { ContentType } from '@/types/database'

const CONTENT_TYPES: { value: ContentType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'education', label: 'Education' },
  { value: 'inspiration', label: 'Inspiration' },
  { value: 'promotional', label: 'Promotional' },
]

interface CalendarActionsProps {
  onFilterChange: (filter: ContentType | 'all') => void
  activeFilter: ContentType | 'all'
  draftCount: number
  brandName: string | null
}

export function CalendarActions({ onFilterChange, activeFilter, draftCount, brandName }: CalendarActionsProps) {
  const { activeBrandId } = useAgencyStore()
  const [approvingAll, setApprovingAll] = useState(false)

  function handleFillEmpty() {
    sendToDirector(
      `Fill the empty slots in this week's calendar for ${brandName ?? 'this brand'}. ` +
      `Check the strategy context, identify which platforms and content types are missing, ` +
      `and create draft posts for each gap. Save them as scheduled posts.`
    )
  }

  async function handleApproveAllDrafts() {
    if (!activeBrandId || draftCount === 0) return
    setApprovingAll(true)
    try {
      const res = await fetch(`/api/scheduled-posts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: activeBrandId,
          bulk_action: 'approve_drafts',
        }),
      })
      if (res.ok) {
        // Trigger a refresh — the parent component will re-fetch
        window.dispatchEvent(new CustomEvent('nrs-calendar-refresh'))
      }
    } catch {
      // Silent fail
    } finally {
      setApprovingAll(false)
    }
  }

  function handleBulkReschedule() {
    sendToDirector(
      `Review the scheduled posts for ${brandName ?? 'this brand'} and suggest optimal times ` +
      `based on platform algorithm data. Consider audience timezone (AEST), ` +
      `engagement patterns, and platform-specific best posting times.`
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Fill empty slots */}
      <button
        onClick={handleFillEmpty}
        className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Fill empty slots
      </button>

      {/* Approve all drafts */}
      {draftCount > 0 && (
        <button
          onClick={handleApproveAllDrafts}
          disabled={approvingAll}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {approvingAll ? 'Approving...' : `Approve ${draftCount} draft${draftCount > 1 ? 's' : ''}`}
        </button>
      )}

      {/* Bulk reschedule */}
      <button
        onClick={handleBulkReschedule}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
      >
        <CalendarRange className="h-3.5 w-3.5" />
        Bulk reschedule
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Content type filter */}
      <div className="flex items-center gap-1">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {CONTENT_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => onFilterChange(type.value)}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
              activeFilter === type.value
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify ContentType exists in types**

Check `src/types/database.ts` for `ContentType`. If it does not exist, add:

```typescript
export type ContentType = 'entertainment' | 'education' | 'inspiration' | 'promotional'
```

- [ ] **Step 3: Commit**

```bash
git add src/components/agency/studio/CalendarActions.tsx src/types/database.ts
git commit -m "feat: CalendarActions — fill slots, approve drafts, bulk reschedule, content type filter"
```

---

### Task 9: Replace ContentCalendar with EnhancedCalendar in CreativeStudio

**Files:**
- Modify: `src/components/agency/studio/CreativeStudio.tsx`

- [ ] **Step 1: Update the import**

Find this line in `CreativeStudio.tsx`:

```typescript
import { ContentCalendar } from '@/components/agency/ContentCalendar'
```

Replace with:

```typescript
import { EnhancedCalendar } from './EnhancedCalendar'
```

- [ ] **Step 2: Update the tab content rendering**

Find:

```typescript
{activeTab === 'calendar' && <ContentCalendar />}
```

Replace with:

```typescript
{activeTab === 'calendar' && <EnhancedCalendar />}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: Build succeeds. Calendar tab now shows FullCalendar with drag-and-drop, strategy overlay, and post detail panel. The old ContentCalendar.tsx file remains in the codebase (not deleted) as a fallback reference.

- [ ] **Step 4: Commit**

```bash
git add src/components/agency/studio/CreativeStudio.tsx
git commit -m "feat: swap ContentCalendar for EnhancedCalendar in Creative Studio calendar tab"
```

---

### Task 10: Build + Push

- [ ] **Step 1: Full build check**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run build
```

Expected: Zero errors.

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

- [ ] **Step 3: Verify on live site**

1. Navigate to `/agency/studio` and click "Run a Campaign" card
2. Campaign Planner loads with CampaignBrief form
3. Fill in name + goal, click "Plan Campaign" -- message sent to Director chat
4. After brief submitted: timeline + 6 department cards appear
5. "Generate All" sends a message to Director for full asset generation
6. Per-department "Generate assets" sends focused requests
7. Navigate to Calendar tab -- FullCalendar renders with drag-and-drop
8. Drag a post to a new date -- PATCH request fires, post reschedules
9. Click a post -- detail panel slides in from right
10. Strategy overlay shows posts/target progress bar + platform distribution
11. "Fill empty slots" sends context-rich message to Director
12. "Approve all drafts" bulk-updates draft posts to scheduled status
