'use client'

/**
 * The conversation, rendered as ONE list.
 *
 * Previously this was three blocks — messages, then a spinner, then media
 * newest-first — so a clip from this morning sat below a message from this
 * afternoon and above a clip from an hour ago. There is now a single ordered
 * array from the server and this file renders it in the order it arrives. It
 * does not sort. Nothing outside `timeline.ts` sorts.
 */

import { memo, useState } from 'react'
import type { TimelineEvent } from '@/lib/telegram/timeline'

const DAY = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * The caption, with the two things anyone actually wants to do to it.
 *
 * COPY, because the fastest fix for a wrong word has always been to take the
 * text somewhere you can type properly and bring it back — and there was no
 * way to get it out of the app at all, so it was being retyped by hand.
 *
 * EDIT, because a caption that can only be corrected by asking a model to
 * rewrite it comes back different in three other places. Typing the fix is
 * quicker than describing it, and it is the only way to be sure the change is
 * the one that was wanted.
 */
function CaptionBlock({
  hook,
  caption,
  hashtags,
  onSave,
}: {
  hook: string
  caption: string
  hashtags: string[]
  onSave: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(caption)
  const [copied, setCopied] = useState(false)

  const full = [hook, caption, hashtags.map((tag) => `#${tag}`).join(' ')]
    .filter(Boolean)
    .join('\n\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#17212b)] p-3 ring-2 ring-[var(--tg-theme-button-color,#2aabee)]">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={Math.min(16, Math.max(5, draft.split('\n').length + 2))}
          className="w-full resize-none rounded-xl bg-[var(--tg-theme-bg-color,#0e151c)] p-3 text-[15px] leading-6 outline-none"
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => { onSave(draft); setEditing(false) }}
            className="rounded-xl bg-[var(--tg-theme-button-color,#2aabee)] px-4 py-2 text-sm font-medium text-[var(--tg-theme-button-text-color,#fff)]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => { setDraft(caption); setEditing(false) }}
            className="rounded-xl px-4 py-2 text-sm ring-1 ring-black/15 dark:ring-white/15"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#17212b)] p-4 ring-1 ring-black/10 dark:ring-white/10 text-[15px] leading-6">
      {hook && <p className="font-semibold">{hook}</p>}
      {caption && <p className="mt-2 whitespace-pre-wrap">{caption}</p>}
      {hashtags.length > 0 && (
        <p className="mt-2 text-xs text-[var(--tg-theme-hint-color,#82909f)]">
          {hashtags.map((tag) => `#${tag}`).join(' ')}
        </p>
      )}
      <div className="mt-3 flex gap-2 border-t border-black/10 pt-3 dark:border-white/10">
        <button type="button" onClick={copy} className="rounded-lg px-3 py-1.5 text-xs ring-1 ring-black/15 dark:ring-white/15">
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-xs ring-1 ring-black/15 dark:ring-white/15">
          Edit
        </button>
      </div>
    </div>
  )
}

function dayKey(ms: number): string {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`
}

/**
 * Only day separators, never a clock on each message.
 *
 * An answer sorts with the question that caused it, so a slow reply can carry
 * a later time than the message beneath it. Showing per-message times would put
 * a visibly out-of-order clock on screen; the day is the useful granularity
 * anyway, and it is derived from the group anchor, which is monotonic.
 */
function DaySeparator({ ms }: { ms: number }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      <span className="text-[11px] uppercase tracking-wider text-[var(--tg-theme-hint-color,#82909f)]">
        {DAY.format(new Date(ms))}
      </span>
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
    </div>
  )
}

const OwnerBubble = memo(function OwnerBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--tg-theme-button-color,#2aabee)] px-4 py-2.5 text-[15px] leading-6 text-[var(--tg-theme-button-text-color,#fff)]">
      {text}
    </div>
  )
})

const DirectorBubble = memo(function DirectorBubble({
  text,
  withheld,
}: {
  text: string
  withheld: boolean
}) {
  return (
    <div
      className={`mr-auto max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-6 ${
        withheld
          ? 'bg-amber-500 text-white'
          : 'bg-[var(--tg-theme-secondary-bg-color,#17212b)]'
      }`}
    >
      {text}
    </div>
  )
})

function Working({ label }: { label: string }) {
  return (
    <div className="mr-auto flex max-w-[88%] items-center gap-2 rounded-2xl rounded-bl-md bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-4 py-3 text-[15px] text-[var(--tg-theme-hint-color,#82909f)]">
      <span className="flex gap-1" aria-hidden>
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current" />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export interface TimelineViewProps {
  events: TimelineEvent[]
  onRetry: (text: string, clientEventId: string | null) => void
  /** A corrected caption, typed by the person who spotted the mistake. */
  onEditCaption: (outputId: string, caption: string) => void
}

export function TimelineView({ events, onRetry, onEditCaption }: TimelineViewProps) {
  let lastDay = ''

  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => {
        const key = dayKey(event.groupAnchorMs)
        const newDay = key !== lastDay
        lastDay = key

        return (
          <div key={event.id} className="contents">
            {newDay && <DaySeparator ms={event.groupAnchorMs} />}
            <EventRow event={event} onRetry={onRetry} onEditCaption={onEditCaption} />
          </div>
        )
      })}
    </div>
  )
}

function EventRow({ event, onRetry, onEditCaption }: { event: TimelineEvent; onRetry: TimelineViewProps['onRetry']; onEditCaption: TimelineViewProps['onEditCaption'] }) {
  const payload = event.payload

  switch (payload.kind) {
    case 'user_message':
      return <OwnerBubble text={payload.text} />

    case 'director_reply':
      return <DirectorBubble text={payload.text} withheld={payload.withheld} />

    case 'director_pending':
      return <Working label={payload.label} />

    case 'director_error':
      return (
        <div className="mr-auto max-w-[88%] rounded-2xl rounded-bl-md bg-red-600 px-4 py-3 text-[15px] leading-6 text-white">
          <p>{payload.text}</p>
          {payload.retryText && (
            <button
              type="button"
              onClick={() => onRetry(payload.retryText!, payload.retryClientEventId)}
              className="mt-2 rounded-lg bg-white/20 px-3 py-1 text-xs font-medium"
            >
              Send it again
            </button>
          )}
        </div>
      )

    case 'media_upload':
      return (
        <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[var(--tg-theme-button-color,#2aabee)] px-4 py-2.5 text-[15px] text-[var(--tg-theme-button-text-color,#fff)]">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-medium">{payload.fileName}</span>
            <span className="shrink-0 text-xs opacity-80">
              {payload.stage === 'uploading'
                ? `${payload.uploadPercent}%`
                : payload.stage === 'listening'
                  ? 'listening…'
                  : payload.stage === 'failed'
                    ? 'could not read'
                    : payload.stage === 'no_draft'
                      ? 'transcribed'
                      : 'ready'}
            </span>
          </div>
        </div>
      )

    case 'proposal':
      return (
        <div className="mr-auto max-w-[92%] space-y-3">
          {payload.opener && <DirectorBubble text={payload.opener} withheld={payload.withheld} />}
          {!payload.withheld && (payload.hook || payload.caption) && (
            <div>
              <CaptionBlock
                hook={payload.hook}
                caption={payload.caption}
                hashtags={payload.hashtags}
                onSave={(next) => onEditCaption(payload.outputId, next)}
              />
              <div className="mt-2">
              <p className="text-xs text-[var(--tg-theme-hint-color,#82909f)]">
                {payload.postType} · not in Mixpost yet — edit it above, then say approve
              </p>
              </div>
            </div>
          )}
        </div>
      )

    default: {
      const exhaustive: never = payload
      return exhaustive
    }
  }
}
