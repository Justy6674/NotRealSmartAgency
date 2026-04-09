'use client'

import { Check, X, MessageSquare, Sparkles } from 'lucide-react'
import { ComplianceBadge } from './ComplianceBadge'
import { SOURCE_LABELS, PLATFORM_CONFIG } from './ReviewFilters'
import type { ScheduledPost, DraftSource, ComplianceResult, PostPlatform } from '@/types/database'

interface DraftCardProps {
  post: ScheduledPost
  selected: boolean
  active: boolean
  complianceResult: ComplianceResult | null | undefined
  complianceLoading: boolean
  onSelect: (id: string) => void
  onClick: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onAskDirector: (id: string) => void
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function DraftCard({
  post,
  selected,
  active,
  complianceResult,
  complianceLoading,
  onSelect,
  onClick,
  onApprove,
  onReject,
  onAskDirector,
}: DraftCardProps) {
  const meta = (post.metadata ?? {}) as Record<string, unknown>
  const source = (meta.source as DraftSource) ?? 'unknown'
  const createdBy = (meta.created_by as string) ?? undefined
  const sourceConfig = SOURCE_LABELS[source] ?? SOURCE_LABELS.unknown
  const platformConfig = PLATFORM_CONFIG[post.platform as PostPlatform]

  return (
    <div
      className={`group relative rounded-xl border transition-all cursor-pointer ${
        active
          ? 'border-primary/50 bg-card shadow-md ring-1 ring-primary/20'
          : selected
          ? 'border-primary/30 bg-card/80'
          : 'border-border bg-card hover:border-border/80 hover:shadow-sm'
      }`}
    >
      {/* Source accent stripe */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ backgroundColor: sourceConfig.colour }}
      />

      <div className="p-3 pl-4" onClick={() => onClick(post.id)}>
        {/* Top row: source + platform + compliance */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: `color-mix(in oklch, ${sourceConfig.colour} 15%, transparent)`,
              color: sourceConfig.colour,
            }}
          >
            {sourceConfig.label}
          </span>

          {platformConfig && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: `color-mix(in oklch, ${platformConfig.colour} 15%, transparent)`,
                color: platformConfig.colour,
              }}
            >
              {post.platform}
            </span>
          )}

          <div className="ml-auto">
            <ComplianceBadge result={complianceResult} loading={complianceLoading} />
          </div>
        </div>

        {/* Caption preview */}
        <p className="text-sm text-foreground line-clamp-3 mb-2 leading-relaxed">
          {post.caption || 'No caption'}
        </p>

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {post.hashtags.slice(0, 4).map((h, i) => (
              <span key={i} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {h.startsWith('#') ? h : `#${h}`}
              </span>
            ))}
            {post.hashtags.length > 4 && (
              <span className="text-[9px] text-muted-foreground">+{post.hashtags.length - 4} more</span>
            )}
          </div>
        )}

        {/* Footer: meta + created by */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {createdBy && <span>{createdBy}</span>}
          <span>{relativeTime(post.created_at)}</span>
          {post.content_type && (
            <span className="rounded bg-muted px-1 py-0.5">{post.content_type}</span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-1.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(post.id)}
          className="h-3.5 w-3.5 rounded border-border"
          onClick={(e) => e.stopPropagation()}
        />

        <div className="flex-1" />

        <button
          onClick={(e) => { e.stopPropagation(); onAskDirector(post.id) }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Ask Director to review"
        >
          <MessageSquare className="h-3 w-3" />
          Director
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onApprove(post.id) }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[oklch(0.72_0.15_145)] hover:bg-[oklch(0.72_0.15_145/0.1)] transition-colors"
          title="Approve and schedule"
        >
          <Check className="h-3 w-3" />
          Approve
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onReject(post.id) }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-[oklch(0.65_0.2_25/0.1)] hover:text-[oklch(0.65_0.2_25)] transition-colors"
          title="Reject"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
