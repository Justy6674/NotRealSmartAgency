'use client'

import {
  MessageSquare,
  Clock,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CircleDot,
  Pencil,
} from 'lucide-react'
import type { PostActivityRow } from '@/hooks/usePostActivity'

/**
 * PostActivityItem — Phase 4b of the Mixpost UI port.
 *
 * Per-row renderer for the activity timeline. Handles all 8 event
 * types — 'comment' renders as an avatar + rich body block, the other
 * 7 render as a compact system event line with a type-specific icon
 * and colour.
 *
 * Metadata shape expectations (all optional):
 *   scheduled      { scheduled_at: ISO string }
 *   rescheduled    { from: ISO, to: ISO }
 *   published      { platform: string }
 *   failed         { platform: string, error: string }
 *   status_change  { from: string, to: string }
 *   edit           { fields: string[] }
 */

interface PostActivityItemProps {
  row: PostActivityRow
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 30) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 1) return `${secs}s ago`
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-AU')
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function getUserDisplayName(row: PostActivityRow): string {
  const meta = row.users?.raw_user_meta_data as
    | { name?: string; full_name?: string; display_name?: string }
    | null
    | undefined
  return (
    meta?.name ??
    meta?.full_name ??
    meta?.display_name ??
    row.users?.email?.split('@')[0] ??
    'Unknown'
  )
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

// ── Comment row ──────────────────────────────────────────────────────────────

function CommentItem({ row }: { row: PostActivityRow }) {
  const displayName = getUserDisplayName(row)
  const initials = getInitials(displayName)

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
          {initials || '?'}
        </div>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground">
            {displayName}
          </span>
          <span
            className="text-[10px] text-muted-foreground"
            title={new Date(row.created_at).toLocaleString('en-AU')}
          >
            {relativeTime(row.created_at)}
          </span>
        </div>
        <div className="mt-1 rounded-lg bg-muted/40 px-3 py-2">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {row.body ?? ''}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── System event row ─────────────────────────────────────────────────────────

interface SystemEventConfig {
  Icon: typeof Clock
  colour: string
  label: (row: PostActivityRow, displayName: string) => string
}

const SYSTEM_EVENT_CONFIGS: Record<
  Exclude<PostActivityRow['type'], 'comment'>,
  SystemEventConfig
> = {
  created: {
    Icon: Clock,
    colour: 'oklch(0.65 0.02 240)',
    label: (_row, name) => `Post created by ${name}`,
  },
  scheduled: {
    Icon: Calendar,
    colour: 'oklch(0.65 0.15 240)',
    label: (row, name) => {
      const when = (row.metadata?.scheduled_at as string) ?? ''
      return when
        ? `Scheduled for ${formatDateTime(when)} by ${name}`
        : `Scheduled by ${name}`
    },
  },
  rescheduled: {
    Icon: RefreshCw,
    colour: 'oklch(0.7 0.12 60)',
    label: (row, name) => {
      const from = row.metadata?.from as string | undefined
      const to = row.metadata?.to as string | undefined
      if (from && to) {
        return `Rescheduled from ${formatDateTime(from)} to ${formatDateTime(to)} by ${name}`
      }
      return `Rescheduled by ${name}`
    },
  },
  published: {
    Icon: CheckCircle2,
    colour: 'oklch(0.72 0.15 145)',
    label: (row) => {
      const platform = (row.metadata?.platform as string) ?? 'social'
      return `Published to ${platform}`
    },
  },
  failed: {
    Icon: AlertTriangle,
    colour: 'oklch(0.65 0.2 25)',
    label: (row) => {
      const platform = (row.metadata?.platform as string) ?? 'social'
      const error = (row.metadata?.error as string) ?? 'unknown error'
      return `Failed to publish to ${platform}: ${error}`
    },
  },
  status_change: {
    Icon: CircleDot,
    colour: 'oklch(0.65 0.02 240)',
    label: (row, name) => {
      const from = (row.metadata?.from as string) ?? '?'
      const to = (row.metadata?.to as string) ?? '?'
      return `Status changed from ${from} to ${to} by ${name}`
    },
  },
  edit: {
    Icon: Pencil,
    colour: 'oklch(0.65 0.02 240)',
    label: (row, name) => {
      const fields = row.metadata?.fields as string[] | undefined
      if (fields && fields.length > 0) {
        return `Edited ${fields.join(', ')} by ${name}`
      }
      return `Edited by ${name}`
    },
  },
}

function SystemEventItem({ row }: { row: PostActivityRow }) {
  const displayName = row.user_id ? getUserDisplayName(row) : 'system'
  const config = SYSTEM_EVENT_CONFIGS[row.type as Exclude<PostActivityRow['type'], 'comment'>]
  if (!config) return null
  const { Icon, colour, label } = config

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: `color-mix(in oklch, ${colour} 15%, transparent)`,
        }}
      >
        <Icon className="h-3 w-3" style={{ color: colour }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-muted-foreground">
          {label(row, displayName)}
        </p>
      </div>
      <span
        className="flex-shrink-0 text-[10px] text-muted-foreground/70"
        title={new Date(row.created_at).toLocaleString('en-AU')}
      >
        {relativeTime(row.created_at)}
      </span>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function PostActivityItem({ row }: PostActivityItemProps) {
  if (row.type === 'comment') {
    return <CommentItem row={row} />
  }
  return <SystemEventItem row={row} />
}

// Export the icon for use in badges etc.
export { MessageSquare as ActivityThreadIcon }
