'use client'

import { Eye, ArrowRight, Plus, Globe } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

interface Competitor {
  name: string
  website?: string
  last_checked_at?: string
  last_snapshot_hash?: string
}

interface CompetitorIntelCardProps {
  brand: Brand
}

export function CompetitorIntelCard({ brand }: CompetitorIntelCardProps) {
  const { setChatPanelOpen, setPendingReviewMessage } = useAgencyStore()

  const competitors = (brand.competitors as Competitor[] | null) ?? []

  const handleScan = () => {
    setChatPanelOpen(true)
    setPendingReviewMessage('Run a deep competitor scan and tell me what changed')
  }

  const handleAdd = () => {
    setChatPanelOpen(true)
    setPendingReviewMessage(`Add a competitor to my watchlist for ${brand.name}`)
  }

  if (competitors.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-foreground">Competitors</h3>
        </div>
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-2">No competitors tracked yet.</p>
          <button
            onClick={handleAdd}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 mx-auto"
          >
            <Plus className="h-3 w-3" />
            Add competitor
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-foreground">Competitors</h3>
        </div>
        <button
          onClick={handleScan}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          Scan all
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-2">
        {competitors.slice(0, 5).map((comp, i) => {
          const lastChecked = comp.last_checked_at
            ? new Date(comp.last_checked_at)
            : null
          const daysSince = lastChecked
            ? Math.floor((Date.now() - lastChecked.getTime()) / 86400000)
            : null
          const isRecent = daysSince !== null && daysSince <= 2

          return (
            <div key={i} className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                {comp.name}
              </span>
              {isRecent && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 shrink-0">
                  Updated
                </span>
              )}
              <span className="text-[10px] text-muted-foreground shrink-0">
                {lastChecked
                  ? `${daysSince}d ago`
                  : 'Not scanned'
                }
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
