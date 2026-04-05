'use client'

import { useState, useCallback } from 'react'
import { Wand2, CheckCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { sendToDirector } from '@/lib/chat-dispatch'

// ─── Content type filter ─────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'education', label: 'Education' },
  { id: 'inspiration', label: 'Inspiration' },
  { id: 'promotional', label: 'Promotional' },
] as const

export type ContentTypeFilter = (typeof CONTENT_TYPES)[number]['id']

interface CalendarActionsProps {
  activeFilters?: ContentTypeFilter[]
  onFilterChange?: (filters: ContentTypeFilter[]) => void
}

export function CalendarActions({ activeFilters = [], onFilterChange }: CalendarActionsProps) {
  const { activeBrandId } = useAgencyStore()
  const studioData = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(studioData.brand, studioData.posts, studioData.accounts)
  const [filling, setFilling] = useState(false)
  const [approving, setApproving] = useState(false)

  // Fill empty slots — send strategy context to Director
  const handleFillSlots = useCallback(() => {
    if (!strategyContext || !activeBrandId) return
    setFilling(true)

    const message = [
      `Fill the empty slots in my content calendar for this week.`,
      strategyContext.agentContext,
      `Create draft posts for each empty slot with appropriate captions, hashtags, and platform-specific formatting.`,
    ].join('\n\n')

    sendToDirector(message)

    // Reset after a moment (the Director will handle the work)
    setTimeout(() => setFilling(false), 2000)
  }, [strategyContext, activeBrandId])

  // Approve all drafts — PATCH each draft to scheduled
  const handleApproveAll = useCallback(async () => {
    if (!activeBrandId) return
    setApproving(true)

    try {
      const res = await fetch(`/api/scheduled-posts?brandId=${activeBrandId}`)
      if (!res.ok) return

      const posts = await res.json()
      const drafts = posts.filter(
        (p: { status: string }) => p.status === 'draft'
      )

      if (drafts.length === 0) {
        setApproving(false)
        return
      }

      // PATCH each draft to scheduled
      await Promise.all(
        drafts.map((draft: { id: string }) =>
          fetch('/api/scheduled-posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: draft.id, status: 'scheduled' }),
          })
        )
      )

      // Refresh studio data
      studioData.refetch()
    } finally {
      setApproving(false)
    }
  }, [activeBrandId, studioData])

  // Toggle content type filter
  const toggleFilter = useCallback(
    (type: ContentTypeFilter) => {
      if (!onFilterChange) return
      const next = activeFilters.includes(type)
        ? activeFilters.filter((f) => f !== type)
        : [...activeFilters, type]
      onFilterChange(next)
    },
    [activeFilters, onFilterChange]
  )

  if (!activeBrandId) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Action buttons */}
      <button
        onClick={handleFillSlots}
        disabled={filling}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors',
          'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {filling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        Fill empty slots
      </button>

      <button
        onClick={handleApproveAll}
        disabled={approving}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors',
          'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {approving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCheck className="h-4 w-4" />
        )}
        Approve all drafts
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Content type filters */}
      {CONTENT_TYPES.map((type) => (
        <button
          key={type.id}
          onClick={() => toggleFilter(type.id)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            activeFilters.includes(type.id)
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          {type.label}
        </button>
      ))}
    </div>
  )
}
