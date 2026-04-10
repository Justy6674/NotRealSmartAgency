'use client'

import { X } from 'lucide-react'
import type { DraftSource, PostPlatform } from '@/types/database'

export interface ReviewFilterState {
  source: DraftSource | 'all'
  platforms: PostPlatform[]
  compliance: 'all' | 'pass' | 'warn' | 'fail'
}

interface ReviewFiltersProps {
  filters: ReviewFilterState
  onChange: (filters: ReviewFilterState) => void
  availableSources: DraftSource[]
  draftCount: number
}

const SOURCE_LABELS: Record<DraftSource, { label: string; colour: string }> = {
  ai_generate: { label: 'AI Generate', colour: 'oklch(0.65 0.15 250)' },
  fill_calendar: { label: 'Calendar Fill', colour: 'oklch(0.65 0.15 300)' },
  director_chat: { label: 'Director', colour: 'oklch(0.78 0.15 80)' },
  post_creator: { label: 'Manual', colour: 'oklch(0.6 0 0)' },
  publish_to_social: { label: 'Published', colour: 'oklch(0.72 0.15 145)' },
  canva_import: { label: 'Canva', colour: 'oklch(0.65 0.15 320)' },
  mcp_external: { label: 'MCP/External', colour: 'oklch(0.65 0.15 200)' },
  team_member: { label: 'Team', colour: 'oklch(0.65 0.15 170)' },
  unknown: { label: 'Other', colour: 'oklch(0.5 0 0)' },
}

const PLATFORM_CONFIG: Record<PostPlatform, { label: string; colour: string }> = {
  instagram: { label: 'IG', colour: 'oklch(0.65 0.2 350)' },
  facebook: { label: 'FB', colour: 'oklch(0.55 0.15 250)' },
  linkedin: { label: 'LI', colour: 'oklch(0.55 0.15 230)' },
  twitter: { label: 'X', colour: 'oklch(0.5 0 0)' },
  tiktok: { label: 'TT', colour: 'oklch(0.65 0.15 190)' },
  youtube: { label: 'YT', colour: 'oklch(0.6 0.2 30)' },
  bluesky: { label: 'BS', colour: 'oklch(0.6 0.18 250)' },
  mastodon: { label: 'MD', colour: 'oklch(0.55 0.18 280)' },
  pinterest: { label: 'PT', colour: 'oklch(0.55 0.2 25)' },
  threads: { label: 'TH', colour: 'oklch(0.5 0 0)' },
  google_business: { label: 'GB', colour: 'oklch(0.55 0.15 250)' },
}

export function ReviewFilters({ filters, onChange, availableSources, draftCount }: ReviewFiltersProps) {
  const hasActiveFilters = filters.source !== 'all' || filters.platforms.length > 0 || filters.compliance !== 'all'

  const clearAll = () => onChange({ source: 'all', platforms: [], compliance: 'all' })

  const togglePlatform = (p: PostPlatform) => {
    const current = filters.platforms
    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p]
    onChange({ ...filters, platforms: next })
  }

  return (
    <div className="space-y-2">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Content Review
          {draftCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
              {draftCount}
            </span>
          )}
        </h2>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Source filter */}
        <select
          value={filters.source}
          onChange={(e) => onChange({ ...filters, source: e.target.value as DraftSource | 'all' })}
          className="h-7 rounded-md border border-border bg-card px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All sources</option>
          {availableSources.map(s => (
            <option key={s} value={s}>{SOURCE_LABELS[s]?.label ?? s}</option>
          ))}
        </select>

        {/* Platform toggles */}
        <div className="flex items-center gap-1">
          {(Object.keys(PLATFORM_CONFIG) as PostPlatform[]).map(p => {
            const cfg = PLATFORM_CONFIG[p]
            const active = filters.platforms.includes(p)
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                  active
                    ? 'ring-1 ring-white/20 shadow-sm'
                    : 'opacity-40 hover:opacity-70'
                }`}
                style={{
                  backgroundColor: active ? `${cfg.colour}` : `color-mix(in oklch, ${cfg.colour} 15%, transparent)`,
                  color: active ? 'white' : cfg.colour,
                }}
                title={p}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Compliance filter */}
        <select
          value={filters.compliance}
          onChange={(e) => onChange({ ...filters, compliance: e.target.value as ReviewFilterState['compliance'] })}
          className="h-7 rounded-md border border-border bg-card px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All compliance</option>
          <option value="pass">Compliant</option>
          <option value="warn">Warnings</option>
          <option value="fail">Violations</option>
        </select>
      </div>
    </div>
  )
}

export { SOURCE_LABELS, PLATFORM_CONFIG }
