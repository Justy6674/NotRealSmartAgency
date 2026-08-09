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
type MixpostState = 'synced' | 'pending' | 'failed' | 'skipped' | 'duplicate' | null

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
  /** Present only when this copy has a real saved record to edit. */
  onSave?: (next: string) => void
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
            onClick={() => { onSave?.(draft); setEditing(false) }}
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
        {onSave && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-xs ring-1 ring-black/15 dark:ring-white/15">
            Edit
          </button>
        )}
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

/**
 * A direct caption answer is still a deliverable, even before it is saved.
 *
 * The caption contract requires its hashtags to be on their own trailing
 * line. That makes this a deliberately conservative signal: ordinary chat
 * mentioning a hashtag remains a chat bubble, but a copy-ready social answer
 * gets the single action its recipient needs — Copy.
 */
function isCopyReadySocialText(text: string): boolean {
  return /(?:^|\n)\s*#[\p{L}\d_]+/u.test(text)
}

const DirectorBubble = memo(function DirectorBubble({
  text,
  withheld,
}: {
  text: string
  withheld: boolean
}) {
  if (!withheld && isCopyReadySocialText(text)) {
    return (
      <section className="mr-auto max-w-[92%] overflow-hidden rounded-2xl rounded-bl-md bg-[var(--tg-theme-secondary-bg-color,#17212b)] ring-1 ring-black/10 dark:ring-white/10">
        <div className="px-4 pb-2 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--tg-theme-hint-color,#82909f)]">Social copy</p>
          <p className="mt-1 text-sm text-[var(--tg-theme-hint-color,#82909f)]">Prepared in this chat · not saved in NRS or Mixpost</p>
        </div>
        <CaptionBlock hook="" caption={text} hashtags={[]} />
      </section>
    )
  }

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
  /** Explicit owner approval to create a draft, never to publish. */
  onSaveDraft: (outputId: string) => Promise<{
    mixpost: 'synced' | 'pending' | 'failed' | 'skipped' | 'duplicate'
    error?: string
  }>
}

export function TimelineView({ events, onRetry, onEditCaption, onSaveDraft }: TimelineViewProps) {
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
            <EventRow event={event} onRetry={onRetry} onEditCaption={onEditCaption} onSaveDraft={onSaveDraft} />
          </div>
        )
      })}
    </div>
  )
}

function mixpostLabel(state: MixpostState): string | null {
  return state === 'synced'
    ? 'Draft in Mixpost'
    : state === 'pending'
      ? 'Draft saved in NRS · Mixpost is still syncing'
      : state === 'failed'
        ? 'Draft saved in NRS · Mixpost sync failed'
        : state === 'duplicate'
          ? 'Existing Mixpost draft found'
          : state === 'skipped'
            ? 'Draft saved in NRS · Mixpost not connected'
            : null
}

/** Every saved proposal gets this one honest path to a Mixpost draft. */
function DraftAction({
  outputId,
  approved,
  mixpost,
  onSaveDraft,
}: {
  outputId: string | null
  approved: boolean
  mixpost: MixpostState
  onSaveDraft: TimelineViewProps['onSaveDraft']
}) {
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState(mixpost)
  const [error, setError] = useState<string | null>(null)

  const saveDraft = async () => {
    if (!outputId || saving) return
    setSaving(true)
    setError(null)
    try {
      const result = await onSaveDraft(outputId)
      setState(result.mixpost)
      if (result.error) setError(result.error)
    } catch {
      setError('The draft could not be created. Nothing was published.')
    } finally {
      setSaving(false)
    }
  }

  const label = mixpostLabel(state)
  return (
    <div className="space-y-2">
      {label ? (
        <p className={`text-sm ${state === 'failed' ? 'text-red-600 dark:text-red-300' : 'text-[var(--tg-theme-hint-color,#82909f)]'}`}>{label}</p>
      ) : approved ? (
        <p className="text-sm text-[var(--tg-theme-hint-color,#82909f)]">Draft filed — checking Mixpost status.</p>
      ) : (
        <>
          <p className="text-sm text-[var(--tg-theme-hint-color,#82909f)]">Saved in NRS · not in Mixpost yet</p>
          <button
            type="button"
            disabled={!outputId || saving}
            onClick={() => void saveDraft()}
            className="w-full rounded-xl bg-[var(--tg-theme-button-color,#2aabee)] px-4 py-2.5 text-sm font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-50"
          >
            {saving ? 'Saving draft…' : 'Save as Mixpost draft'}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {!approved && !label && <p className="text-xs text-[var(--tg-theme-hint-color,#82909f)]">Saving a draft never publishes it.</p>}
    </div>
  )
}

function CarouselDeliveryCard({
  title,
  caption,
  hashtags,
  slides,
  outputId,
  approved,
  mixpost,
  onEditCaption,
  onSaveDraft,
}: {
  title: string
  caption: string
  hashtags: string[]
  slides: Array<{ mediaItemId: string; fileUrl: string; fileName: string }>
  outputId: string | null
  approved: boolean
  mixpost: MixpostState
  onEditCaption: TimelineViewProps['onEditCaption']
  onSaveDraft: TimelineViewProps['onSaveDraft']
}) {
  return (
    <section className="mr-auto max-w-[96%] overflow-hidden rounded-2xl rounded-bl-md bg-[var(--tg-theme-secondary-bg-color,#17212b)] ring-1 ring-black/10 dark:ring-white/10">
      <div className="px-4 pb-2 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--tg-theme-hint-color,#82909f)]">Carousel · {slides.length} slides</p>
        <h3 className="mt-1 text-[16px] font-semibold">{title}</h3>
      </div>
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-3" aria-label={`${title} slides`}>
        {slides.map((slide, index) => (
          <figure key={slide.mediaItemId} className="w-[78vw] max-w-[320px] shrink-0 snap-center overflow-hidden rounded-xl bg-black/10">
            <img src={slide.fileUrl} alt={`Slide ${index + 1}: ${slide.fileName}`} className="aspect-square w-full object-cover" />
            <figcaption className="px-2 py-1.5 text-xs text-[var(--tg-theme-hint-color,#82909f)]">Slide {index + 1} of {slides.length}</figcaption>
          </figure>
        ))}
      </div>
      <div className="space-y-3 border-t border-black/10 px-4 py-3 dark:border-white/10">
        {outputId && <CaptionBlock hook="" caption={caption} hashtags={hashtags} onSave={(next) => onEditCaption(outputId, next)} />}
        {!outputId && <p className="text-sm text-amber-600 dark:text-amber-300">The slides are visible, but NRS has no saved review record to draft safely.</p>}
        <DraftAction outputId={outputId} approved={approved} mixpost={mixpost} onSaveDraft={onSaveDraft} />
      </div>
    </section>
  )
}

function EventRow({ event, onRetry, onEditCaption, onSaveDraft }: { event: TimelineEvent; onRetry: TimelineViewProps['onRetry']; onEditCaption: TimelineViewProps['onEditCaption']; onSaveDraft: TimelineViewProps['onSaveDraft'] }) {
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
          {payload.thumbnailUrl && <img src={payload.thumbnailUrl} alt={`Attached ${payload.fileName}`} className="mb-2 aspect-video w-full rounded-xl object-cover" />}
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
        <section className="mr-auto max-w-[92%] overflow-hidden rounded-2xl rounded-bl-md bg-[var(--tg-theme-secondary-bg-color,#17212b)] ring-1 ring-black/10 dark:ring-white/10">
          {payload.opener && <DirectorBubble text={payload.opener} withheld={payload.withheld} />}
          {!payload.withheld && (payload.hook || payload.caption) && (
            <div className="space-y-3 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--tg-theme-hint-color,#82909f)]">{payload.platform} · {payload.postType} · review</p>
                {payload.aboutFileName && <p className="mt-1 text-xs text-[var(--tg-theme-hint-color,#82909f)]">Made from {payload.aboutFileName}</p>}
              </div>
              <CaptionBlock
                hook={payload.hook}
                caption={payload.caption}
                hashtags={payload.hashtags}
                onSave={(next) => onEditCaption(payload.outputId, next)}
              />
              <DraftAction outputId={payload.outputId} approved={payload.approved} mixpost={payload.mixpost} onSaveDraft={onSaveDraft} />
            </div>
          )}
        </section>
      )

    case 'carousel_delivery':
      return (
        <CarouselDeliveryCard
          title={payload.title}
          caption={payload.caption}
          hashtags={payload.hashtags}
          slides={payload.slides}
          outputId={payload.outputId}
          approved={payload.approved}
          mixpost={payload.mixpost}
          onEditCaption={onEditCaption}
          onSaveDraft={onSaveDraft}
        />
      )

    default: {
      const exhaustive: never = payload
      return exhaustive
    }
  }
}
