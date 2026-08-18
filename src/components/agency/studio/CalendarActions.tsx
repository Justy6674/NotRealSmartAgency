'use client'

import { useState, useCallback } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { sendToDirector } from '@/lib/chat-dispatch'

/**
 * The one thing the calendar can do to a whole week: ask the Director to fill
 * the empty slots with drafts.
 *
 * ── What came out of here, and why neither piece is coming back ───────────
 *
 * 1. FOUR CONTENT-TYPE CHIPS. They took their handler from an optional
 *    `onFilterChange` prop, and the only places that rendered this component
 *    passed no props at all — so `toggleFilter` early-returned every time,
 *    `activeFilters` was permanently `[]`, and the four buttons could never
 *    highlight and never filter anything. They looked like a feature and were
 *    four `<button>` elements with nothing behind them. They now live in
 *    `EnhancedCalendar`, next to the list they filter, wired to real state.
 *    The chip definitions stay exported from here because that is where they
 *    were and moving the names would churn imports for nothing.
 *
 * 2. "APPROVE ALL DRAFTS". One press flipped every draft in the business from
 *    `draft` to `scheduled` — an approval nobody read, for four brands that
 *    advertise regulated health services. Approval is the one moment a human
 *    is supposed to look at the words, and a bulk button is precisely the
 *    thing that removes that moment. It is enforced gone by
 *    `src/lib/social/safety-slice.test.ts`; approving is per post, in Review.
 */

export const CONTENT_TYPES = [
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'education', label: 'Education' },
  { id: 'inspiration', label: 'Inspiration' },
  { id: 'promotional', label: 'Promotional' },
] as const

export type ContentTypeFilter = (typeof CONTENT_TYPES)[number]['id']

export function CalendarActions() {
  const { activeBrandId } = useAgencyStore()
  const studioData = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(studioData.brand, studioData.posts, studioData.accounts)
  const [filling, setFilling] = useState(false)

  const handleFillSlots = useCallback(() => {
    if (!strategyContext || !activeBrandId) return
    setFilling(true)

    sendToDirector(
      [
        'Fill the empty slots in my content calendar for this week.',
        strategyContext.agentContext,
        'Create draft posts for each empty slot with appropriate captions, hashtags, and platform-specific formatting.',
      ].join('\n\n'),
    )

    setTimeout(() => setFilling(false), 2000)
  }, [strategyContext, activeBrandId])

  if (!activeBrandId) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleFillSlots}
        disabled={filling}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors',
          'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {filling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        Fill empty slots
      </button>
    </div>
  )
}
