'use client'

import { useState, useCallback } from 'react'
import { Wand2, CheckCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { sendToDirector } from '@/lib/chat-dispatch'

/**
 * The two things the calendar can do to a whole week.
 *
 * ── What came out of here ──────────────────────────────────────────────
 * Four content-type chips used to live in this component. They took their
 * handler from an optional `onFilterChange` prop, and the only place that
 * rendered this component passed no props at all — so `toggleFilter`
 * early-returned every time, `activeFilters` was permanently `[]`, and the four
 * buttons could never highlight and never filter anything. They looked like a
 * feature and were four `<button>` elements with nothing behind them.
 *
 * They now live in `EnhancedCalendar`, next to the list they filter, wired to
 * real state. The chip definitions stay exported from here because that is
 * where they were and moving the names would churn imports for nothing.
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
  const [approving, setApproving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleFillSlots = useCallback(() => {
    if (!strategyContext || !activeBrandId) return
    setFilling(true)
    setResult(null)

    sendToDirector(
      [
        'Fill the empty slots in my content calendar for this week.',
        strategyContext.agentContext,
        'Create draft posts for each empty slot with appropriate captions, hashtags, and platform-specific formatting.',
      ].join('\n\n'),
    )

    setTimeout(() => setFilling(false), 2000)
  }, [strategyContext, activeBrandId])

  /**
   * Approve every draft waiting on the owner.
   *
   * This says what it did. It used to run silently and swallow its own failures
   * — including the case where there was nothing to approve, which looks
   * identical to a broken button.
   */
  const handleApproveAll = useCallback(async () => {
    if (!activeBrandId) return
    setApproving(true)
    setResult(null)

    try {
      const res = await fetch(`/api/scheduled-posts?brandId=${activeBrandId}&status=draft`)
      if (!res.ok) {
        setResult('Your drafts could not be read just now.')
        return
      }

      const drafts = (await res.json()) as Array<{ id: string }>
      if (!Array.isArray(drafts) || drafts.length === 0) {
        setResult('Nothing is waiting on you.')
        return
      }

      const outcomes = await Promise.allSettled(
        drafts.map((draft) =>
          fetch('/api/scheduled-posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: draft.id, status: 'scheduled' }),
          }).then((response) => {
            if (!response.ok) throw new Error(`approve failed for ${draft.id}`)
            return response
          }),
        ),
      )

      const approved = outcomes.filter((outcome) => outcome.status === 'fulfilled').length
      const failed = outcomes.length - approved
      setResult(
        failed === 0
          ? `${approved} ${approved === 1 ? 'post is' : 'posts are'} now waiting to go out.`
          : `${approved} of ${outcomes.length} approved. ${failed} could not be.`,
      )

      studioData.refetch()
    } finally {
      setApproving(false)
    }
  }, [activeBrandId, studioData])

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

      <button
        onClick={handleApproveAll}
        disabled={approving}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors',
          'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
        Approve everything waiting
      </button>

      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  )
}
