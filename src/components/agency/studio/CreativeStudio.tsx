'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { StudioDashboard } from './StudioDashboard'
import { EnhancedCalendar } from './EnhancedCalendar'
import { CalendarActions } from './CalendarActions'
import { PostCreator } from './post/PostCreator'
import { MediaLibrary } from './MediaLibrary'
import { InstagramGridPlanner } from './grid/InstagramGridPlanner'

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'create', label: 'Create' },
  { id: 'all', label: 'Content' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'media', label: 'Media' },
  { id: 'grid', label: 'Grid Planner' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Creative Studio ─────────────────────────────────────────────────────────

export function CreativeStudio() {
  const [activeTab, setActiveTab] = useState<TabId>('create')
  const { setChatPanelOpen } = useAgencyStore()

  // Auto-open chat panel so Director is always visible in the Studio
  useEffect(() => {
    setChatPanelOpen(true)
  }, [setChatPanelOpen])

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
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'all' && <StudioDashboard />}
        {activeTab === 'calendar' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <CalendarActions />
            <EnhancedCalendar />
          </div>
        )}
        {activeTab === 'media' && <MediaLibrary />}
        {activeTab === 'create' && <PostCreator />}
        {activeTab === 'grid' && <InstagramGridPlanner />}
      </div>
    </div>
  )
}
