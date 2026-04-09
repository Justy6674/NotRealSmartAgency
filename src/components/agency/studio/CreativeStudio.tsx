'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { PostCreator } from './post/PostCreator'
import { ReviewRoom } from './ReviewRoom'
import { EnhancedCalendar } from './EnhancedCalendar'
import { CalendarActions } from './CalendarActions'
import { MediaLibrary } from './MediaLibrary'

// ─── Tab definitions ─────────────────────────────────────────────────────────
// Create → Review → Schedule = content pipeline
// Media = the pantry (always accessible)

const TABS = [
  { id: 'create', label: 'Create' },
  { id: 'review', label: 'Review' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'media', label: 'Media' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Creative Studio ─────────────────────────────────────────────────────────

export function CreativeStudio() {
  const [activeTab, setActiveTab] = useState<TabId>('create')
  const {
    setChatPanelOpen,
    activeBrandId,
    pendingDraftId,
    pendingMediaId,
    setPendingDraftId,
    setPendingMediaId,
  } = useAgencyStore()
  const [draftCount, setDraftCount] = useState(0)

  // Auto-open chat panel so Director is always visible in the Studio
  useEffect(() => {
    setChatPanelOpen(true)
  }, [setChatPanelOpen])

  // Auto-switch to Create tab when a draft or media is pending
  useEffect(() => {
    if (pendingDraftId || pendingMediaId) {
      setActiveTab('create')
    }
  }, [pendingDraftId, pendingMediaId])

  // Fetch draft count for tab badge
  useEffect(() => {
    if (!activeBrandId) return
    fetch(`/api/scheduled-posts?brandId=${activeBrandId}&status=draft`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setDraftCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setDraftCount(0))
  }, [activeBrandId, activeTab])

  // When Creator is done editing, clear pending and go to Review
  const handleCreatorDone = () => {
    setPendingDraftId(null)
    setPendingMediaId(null)
    setActiveTab('review')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-6 pt-4 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.id === 'review' && draftCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                {draftCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — Create and Review manage own scroll, others use overflow-y-auto */}
      <div className={cn('flex-1', activeTab === 'create' || activeTab === 'review' ? 'overflow-hidden' : 'overflow-y-auto')}>
        {activeTab === 'create' && (
          <PostCreator
            draftId={pendingDraftId ?? undefined}
            mediaId={pendingMediaId ?? undefined}
            onDone={handleCreatorDone}
          />
        )}
        {activeTab === 'review' && <ReviewRoom />}
        {activeTab === 'schedule' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <CalendarActions />
            <EnhancedCalendar />
          </div>
        )}
        {activeTab === 'media' && <MediaLibrary />}
      </div>
    </div>
  )
}
