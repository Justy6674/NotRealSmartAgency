'use client'

import { Loader2 } from 'lucide-react'
import {
  displayHandle,
  displayName,
  monogram,
  platformLabel,
  relativeTime,
  type InboxItem,
} from '@/components/agency/inbox/types'

/**
 * The queue of conversations, waiting ones first.
 *
 * ── One judgement, stated carefully ────────────────────────────────────
 * "Waiting on you" comes from the unread count the network itself keeps, plus
 * the direction of the last message where the row carries it. It cannot see a
 * message read on a phone and never answered — nothing anywhere reports that —
 * so the list errs towards showing something again rather than filing a waiting
 * customer as done. Being asked to look twice costs a moment; the other mistake
 * costs the customer.
 */

const INK = 'var(--ink, oklch(0.20 0.014 240))'
const INK_3 = 'var(--ink-3, oklch(0.615 0.011 240))'
const LINE = 'var(--line, oklch(0.915 0.007 240))'
const BRAND_WASH = 'var(--brand-wash, oklch(0.966 0.0068 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'

const STATE_LABELS: Record<InboxItem['state'], string> = {
  needs_you: 'Waiting on you',
  handled: 'Answered here',
  answered: 'Answered',
}

export function ConversationList({
  items,
  loading,
  problem,
  selectedId,
  onSelect,
}: {
  items: InboxItem[]
  loading?: boolean
  problem?: string | null
  selectedId?: string | null
  onSelect: (item: InboxItem) => void
}) {
  const waiting = items.filter((item) => item.state === 'needs_you')
  const rest = items.filter((item) => item.state !== 'needs_you')
  const ordered = [...waiting, ...rest]

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: INK_3 }} />
        <span className="text-[12.5px]" style={{ color: INK_3 }}>Reading your messages…</span>
      </div>
    )
  }

  if (problem) {
    return <p className="p-4 text-[12.5px]" style={{ color: INK_3 }}>{problem}</p>
  }

  if (ordered.length === 0) {
    return (
      <p className="p-4 text-[12.5px]" style={{ color: INK_3 }}>
        No messages have come in yet. When somebody writes to you, they land here.
      </p>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {waiting.length > 0 ? (
        <p
          className="px-4 pt-3 pb-1 text-[11px] font-[600] uppercase tracking-[0.05em]"
          style={{ color: INK_3 }}
        >
          Waiting on you ({waiting.length})
        </p>
      ) : null}
      <ul>
        {ordered.map((item) => {
          const selected = item.id === selectedId
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full items-start gap-3 border-b px-4 py-3 text-left"
                style={{
                  borderColor: LINE,
                  background: selected ? BRAND_WASH : 'transparent',
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-[600]"
                  style={{ background: 'var(--line-soft, oklch(0.950 0.005 240))', color: BRAND_DEEP }}
                >
                  {monogram(item)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-[600]" style={{ color: INK }}>
                      {displayName(item)}
                    </span>
                    {item.updatedAt ? (
                      <span className="ml-auto shrink-0 text-[11px]" style={{ color: INK_3 }}>
                        {relativeTime(item.updatedAt)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: INK_3 }}>
                    {item.lastMessageIsMedia
                      ? 'Sent a photo or video'
                      : item.lastMessage || 'No message yet'}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: INK_3 }}>
                    <span>{platformLabel(item.platform)}</span>
                    {displayHandle(item) ? <span>{displayHandle(item)}</span> : null}
                    <span
                      className="rounded-full px-1.5 py-[1px]"
                      style={{
                        background: item.state === 'needs_you'
                          ? 'var(--care-wash, oklch(0.965 0.028 25))'
                          : 'var(--line-soft, oklch(0.950 0.005 240))',
                        color: item.state === 'needs_you'
                          ? 'var(--care, oklch(0.52 0.150 25))'
                          : INK_3,
                      }}
                    >
                      {STATE_LABELS[item.state]}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
