'use client'

import { Check, CornerUpLeft, ExternalLink, ImageIcon, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui/focus'
import { TONE_CHIP } from '@/lib/ui/status-tone'
import {
  absoluteTime,
  displayHandle,
  displayName,
  monogram,
  platformLabel,
  relativeTime,
  type InboxItem,
  type InboxState,
} from './types'

/**
 * One conversation, as a line you can read without stopping.
 *
 * The state is carried three ways that are not colour — the section it sits
 * under, the shape of its icon, and the word next to that icon — because a
 * queue whose only signal is a green or amber dot is unusable to anyone who
 * cannot separate the two.
 */

const STATE_STYLES: Record<
  InboxState,
  { label: string; detail: string; chip: string; Icon: typeof Check }
> = {
  needs_you: {
    label: 'Needs you',
    detail: 'They spoke last. Nobody has answered.',
    chip: TONE_CHIP.attention,
    Icon: CornerUpLeft,
  },
  handled: {
    label: 'Director handled',
    detail: 'The Director sent the reply, and NRS has the record of it.',
    chip: TONE_CHIP.positive,
    Icon: Sparkles,
  },
  answered: {
    label: 'Answered',
    detail: 'Someone replied. NRS holds no record of who, so it is not claimed as the Director’s.',
    chip: TONE_CHIP.neutral,
    Icon: Check,
  },
}

export function ConversationRow({
  item,
  onDraftReply,
}: {
  item: InboxItem
  onDraftReply: (item: InboxItem) => void
}) {
  const state = STATE_STYLES[item.state]
  const name = displayName(item)
  const handle = displayHandle(item)

  return (
    <li className="flex items-start gap-3 p-4">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      >
        {monogram(item)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          {/* Facebook conversations carry no handle, so this stays absent
              rather than printing a bare "@". */}
          {handle && <span className="truncate text-xs text-muted-foreground">{handle}</span>}
          <span className="text-xs text-muted-foreground">
            {platformLabel(item.platform)}
            {item.accountUsername ? ` · ${item.accountUsername}` : ''}
          </span>
          {item.updatedAt && (
            <time
              dateTime={item.updatedAt}
              title={absoluteTime(item.updatedAt)}
              className="ml-auto shrink-0 text-xs text-muted-foreground"
            >
              {relativeTime(item.updatedAt)}
            </time>
          )}
        </div>

        {/* Media-only messages arrive as the literal characters "[Attachment]"
            or as an empty string. Neither is worth showing to a person. */}
        {item.lastMessageIsMedia ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Sent a photo or video
          </p>
        ) : (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.lastMessage}</p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span
            title={state.detail}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              state.chip,
            )}
          >
            <state.Icon className="h-3 w-3" aria-hidden />
            {state.label}
          </span>

          <button
            onClick={() => onDraftReply(item)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs text-foreground',
              'transition-colors duration-200 hover:bg-accent active:bg-accent/70',
              FOCUS_RING,
            )}
          >
            {item.state === 'needs_you' ? 'Draft a reply' : 'Follow up'}
          </button>

          {/* The deep link is missing on some rows, so it is gated rather than
              rendered as a dead anchor. */}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground underline-offset-2',
                'transition-colors duration-200 hover:text-foreground hover:underline active:text-foreground',
                FOCUS_RING,
              )}
            >
              Open in {platformLabel(item.platform)}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </li>
  )
}
