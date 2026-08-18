'use client'

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FilePlus2,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { PostActivityRow } from '@/hooks/usePostActivity'

/**
 * One line of a post's own history.
 *
 * Mixpost's PostActivity is nineteen components. This is the part an owner
 * actually reads: what happened, who did it, when. Everything the owner cannot
 * act on — internal queue states, per-provider retry counters — is deliberately
 * not drawn, because a log nobody can finish reading is a log nobody reads.
 *
 * Wording rule: name the account and the business, never the machinery. "Went
 * live on Instagram", not "dispatch succeeded".
 */

const ICONS = {
  created: FilePlus2,
  scheduled: CalendarClock,
  rescheduled: RefreshCw,
  published: CheckCircle2,
  failed: AlertTriangle,
  status_change: CircleDot,
  edit: Pencil,
  removed: Trash2,
} as const

/** Status tokens from chrome.css. `--st-fail` is the only alarming one. */
const COLOURS: Record<keyof typeof ICONS, string> = {
  created: 'var(--st-draft, oklch(0.62 0.012 240))',
  scheduled: 'var(--st-sched, oklch(0.62 0.10 220))',
  rescheduled: 'var(--warn, oklch(0.63 0.13 75))',
  published: 'var(--st-pub, oklch(0.58 0.14 152))',
  failed: 'var(--st-fail, oklch(0.58 0.17 27))',
  status_change: 'var(--st-draft, oklch(0.62 0.012 240))',
  edit: 'var(--ink-3, oklch(0.615 0.011 240))',
  removed: 'var(--st-fail, oklch(0.58 0.17 27))',
}

const NETWORK_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  pinterest: 'Pinterest',
  threads: 'Threads',
  google_business: 'Google Business',
}

function networkName(value: unknown): string {
  const key = typeof value === 'string' ? value : ''
  return NETWORK_NAMES[key] ?? (key || 'the account')
}

export function whenText(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function dateTimeText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
}

export function personName(row: PostActivityRow): string {
  const meta = row.users?.raw_user_meta_data as
    | { name?: string; full_name?: string; display_name?: string }
    | null
    | undefined
  return (
    meta?.name ??
    meta?.full_name ??
    meta?.display_name ??
    row.users?.email?.split('@')[0] ??
    'Someone'
  )
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * The sentence for one event, plus which icon it wears.
 *
 * `status_change` to `deleted` is drawn as its own thing: a post taken down at
 * the network is the one event in this list the owner would ring someone about,
 * and it read as an ordinary grey status line when it shared the generic row.
 */
function describe(row: PostActivityRow): { kind: keyof typeof ICONS; text: string } {
  const who = row.user_id ? personName(row) : null
  const by = who ? ` by ${who}` : ''
  const meta = row.metadata ?? {}

  switch (row.type) {
    case 'created':
      return { kind: 'created', text: `Post started${by}.` }
    case 'scheduled': {
      const when = dateTimeText(meta.scheduled_at)
      return { kind: 'scheduled', text: when ? `Set to go out ${when}${by}.` : `Given a time${by}.` }
    }
    case 'rescheduled': {
      const from = dateTimeText(meta.from)
      const to = dateTimeText(meta.to)
      return {
        kind: 'rescheduled',
        text: from && to ? `Moved from ${from} to ${to}${by}.` : `Moved to a new time${by}.`,
      }
    }
    case 'published':
      return { kind: 'published', text: `Went live on ${networkName(meta.platform)}.` }
    case 'failed': {
      const reason = typeof meta.error === 'string' && meta.error.trim() ? ` — ${meta.error}` : ''
      return { kind: 'failed', text: `Did not go out on ${networkName(meta.platform)}${reason}` }
    }
    case 'status_change': {
      const to = typeof meta.to === 'string' ? meta.to : ''
      if (to === 'deleted' || to === 'removed') {
        return { kind: 'removed', text: `Taken down from ${networkName(meta.platform)}${by}.` }
      }
      const from = typeof meta.from === 'string' ? meta.from : ''
      return {
        kind: 'status_change',
        text: from && to ? `Moved from ${from} to ${to}${by}.` : `Status changed${by}.`,
      }
    }
    case 'edit': {
      const fields = Array.isArray(meta.fields) ? (meta.fields as string[]) : []
      return {
        kind: 'edit',
        text: fields.length > 0 ? `Changed the ${fields.join(', ')}${by}.` : `Edited${by}.`,
      }
    }
    default:
      return { kind: 'status_change', text: `Something changed${by}.` }
  }
}

export function ActivityEventRow({ row }: { row: PostActivityRow }) {
  const { kind, text } = describe(row)
  const Icon = ICONS[kind]
  const colour = COLOURS[kind]

  return (
    <div className="flex items-start gap-[9px] py-[5px]">
      <span
        className="mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in oklch, ${colour} 14%, transparent)` }}
      >
        <Icon className="h-[12px] w-[12px]" style={{ color: colour }} strokeWidth={2} aria-hidden />
      </span>
      <p
        className="min-w-0 flex-1 text-[12.5px] leading-[1.5]"
        style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
      >
        {text}
      </p>
      <span
        className="shrink-0 pt-[3px] text-[11px]"
        style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
        title={new Date(row.created_at).toLocaleString('en-AU')}
      >
        {whenText(row.created_at)}
      </span>
    </div>
  )
}

/** A person's note, drawn as a note rather than as another log line. */
export function ActivityCommentRow({ row }: { row: PostActivityRow }) {
  const name = personName(row)

  return (
    <div className="flex items-start gap-[9px] py-[5px]">
      <span
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold"
        style={{
          borderColor: 'var(--line, oklch(0.915 0.007 240))',
          background: 'var(--brand-wash, oklch(0.966 0.03 55))',
          color: 'var(--brand-deep, oklch(0.33 0.07 55))',
        }}
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-[7px]">
          <span
            className="truncate text-[12.5px] font-semibold"
            style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
          >
            {name}
          </span>
          <span
            className="shrink-0 text-[11px]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
            title={new Date(row.created_at).toLocaleString('en-AU')}
          >
            {whenText(row.created_at)}
          </span>
        </div>
        <p
          className="mt-[4px] whitespace-pre-wrap rounded-[8px] border px-[11px] py-[8px] text-[13px] leading-[1.5]"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel-2, oklch(0.975 0.004 240))',
            color: 'var(--ink, oklch(0.20 0.014 240))',
          }}
        >
          {row.body ?? ''}
        </p>
      </div>
    </div>
  )
}
