'use client'

import {
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  CalendarDays,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Shared Type ─────────────────────────────────────────────────────────────

export interface StudioItem {
  id: string
  type: 'post' | 'output'
  title: string
  caption: string
  platform?: string
  hashtags?: string[]
  status?: string
  scheduledAt?: string
  createdAt: string
  thumbnailUrl?: string
  outputType?: string
  raw: unknown
}

// ─── Platform Icons ──────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: CalendarDays,
  youtube: Youtube,
}

// ─── Status Badge Colours ────────────────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-zinc-500/15 text-zinc-400',
  scheduled: 'bg-blue-500/15 text-blue-400',
  publishing: 'bg-amber-500/15 text-amber-400',
  published: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-zinc-500/15 text-zinc-500',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatScheduledTime(isoString: string): string {
  const d = new Date(isoString)
  const date = d.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
  })
  const time = d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${date}, ${time}`
}

// ─── Component ───────────────────────────────────────────────────────────────

interface StudioFeedCardProps {
  item: StudioItem
  isSelected: boolean
  onClick: () => void
}

export function StudioFeedCard({ item, isSelected, onClick }: StudioFeedCardProps) {
  const PlatformIcon = item.platform ? PLATFORM_ICONS[item.platform] ?? CalendarDays : null
  const statusClass = item.status ? STATUS_CLASSES[item.status] ?? STATUS_CLASSES.draft : null
  const maxVisibleHashtags = 3
  const extraHashtags = (item.hashtags?.length ?? 0) - maxVisibleHashtags

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-4 text-left',
        'cursor-pointer transition-all hover:bg-muted/50',
        isSelected && 'ring-2 ring-primary',
      )}
    >
      {/* ── Left: Icon ─────────────────────────────────────────────────── */}
      <div className="mt-0.5 flex shrink-0 items-center justify-center rounded-md bg-muted/60 p-2">
        {item.type === 'post' && PlatformIcon ? (
          <PlatformIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* ── Middle: Content ────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-foreground">
          {item.title}
        </span>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {item.caption}
        </p>

        {/* Hashtags */}
        {item.hashtags && item.hashtags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.hashtags.slice(0, maxVisibleHashtags).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                #{tag.replace(/^#/, '')}
              </span>
            ))}
            {extraHashtags > 0 && (
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                +{extraHashtags} more
              </span>
            )}
          </div>
        )}

        {/* Output type badge (for outputs) */}
        {item.type === 'output' && item.outputType && (
          <span className="mt-1 inline-flex w-fit rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400">
            {item.outputType}
          </span>
        )}
      </div>

      {/* ── Right: Status + Time ───────────────────────────────────────── */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {statusClass && item.status && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
              statusClass,
            )}
          >
            {item.status}
          </span>
        )}
        {item.scheduledAt && (
          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
            {formatScheduledTime(item.scheduledAt)}
          </span>
        )}
        {!item.scheduledAt && item.createdAt && (
          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
            {formatScheduledTime(item.createdAt)}
          </span>
        )}
      </div>
    </button>
  )
}
