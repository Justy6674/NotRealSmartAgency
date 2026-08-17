'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui/focus'
import { TONE_CHIP } from '@/lib/ui/status-tone'
import { useAgencyStore } from '@/stores/agency-store'
import { ConversationRow } from './ConversationRow'
import { InboxEmptyState } from './InboxEmptyState'
import { displayName, platformLabel, type InboxItem, type InboxResponse } from './types'

/** How many answered rows to show before asking. The queue is the point. */
const ANSWERED_PREVIEW = 5

export function UnifiedInbox() {
  const router = useRouter()
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const setBrand = useAgencyStore((s) => s.setBrand)
  const setAgent = useAgencyStore((s) => s.setAgent)
  const setConversation = useAgencyStore((s) => s.setConversation)
  const setPendingComposerText = useAgencyStore((s) => s.setPendingComposerText)

  const [data, setData] = useState<InboxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllAnswered, setShowAllAnswered] = useState(false)

  const load = useCallback(async () => {
    try {
      const query = activeBrandId ? `?brandId=${encodeURIComponent(activeBrandId)}` : ''
      const res = await fetch(`/api/inbox${query}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('unavailable')
      setData(await res.json())
    } catch {
      // A failed read is reported as unreachable, never as an empty inbox.
      // Those two look the same in a list and mean opposite things.
      setData({
        items: [],
        accounts: [],
        unavailable: 'unreachable',
        scope: 'workspace',
        accountsFailed: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = () => {
    setLoading(true)
    void load()
  }

  /**
   * Hand the message to the Director with everything it needs to answer.
   *
   * This does not send anything and does not invent a send path — the reply
   * goes out through the Director's existing `zernio_reply` tool, which needs
   * the conversation id and the account id, so both are written into the
   * message. The wording is approved before it leaves, the same as a post.
   */
  const draftReply = (item: InboxItem) => {
    const who = displayName(item)
    const said = item.lastMessageIsMedia
      ? 'They sent a photo or video with no text.'
      : `They said: "${(item.lastMessage ?? '').slice(0, 600)}"`

    if (activeBrandId) setBrand(activeBrandId)
    else setAgent('overall')
    setConversation(null)
    setPendingComposerText(
      `Help me answer a ${platformLabel(item.platform)} message from ${who}.\n\n` +
        `${said}\n\n` +
        `Write the reply in our voice and show me the wording first. When I say yes, send it with zernio_reply — conversation id ${item.id}, account id ${item.accountId}. Do not send anything before I approve it.`,
    )
    router.push('/agency/chat')
  }

  if (loading) return <InboxSkeleton />

  const items = data?.items ?? []
  const needsYou = items.filter((i) => i.state === 'needs_you')
  const answered = items.filter((i) => i.state !== 'needs_you')

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0
              ? 'Direct messages and comments from your connected accounts.'
              : needsYou.length === 0
                ? `Every one of the ${items.length} conversations here has been answered.`
                : `${needsYou.length} ${needsYou.length === 1 ? 'person is' : 'people are'} waiting on a reply.`}
          </p>
        </div>
        <button
          onClick={refresh}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground',
            'transition-colors duration-200 hover:bg-accent hover:text-foreground active:bg-accent/70',
            FOCUS_RING,
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
        </button>
      </div>

      {/* An incomplete list must say so. Being short and being partial look
          identical, and only one of them means someone is being ignored. */}
      {data && data.accountsFailed > 0 && (
        <p className={cn('mb-4 rounded-md border px-3 py-2 text-xs', TONE_CHIP.attention)}>
          {data.accountsFailed} of your accounts could not be read, so this list is incomplete.
          Reconnect it in Accounts to see everything.
        </p>
      )}

      {items.length === 0 ? (
        <InboxEmptyState reason={data?.unavailable ?? null} error={data?.error} onRetry={refresh} />
      ) : (
        <>
          {needsYou.length > 0 && (
            <section className="mb-8">
              {/* Sentence case at its real size. The section is already set
                  apart by the space above it and the bordered list below it —
                  it does not need tracked uppercase to read as a heading, and
                  tracked uppercase at text-xs is the least legible way to
                  carry the one number this page exists to communicate. */}
              <h2 className="mb-3 text-sm font-medium text-foreground">
                Waiting on you{' '}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  {needsYou.length}
                </span>
              </h2>
              <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                {needsYou.map((item) => (
                  <ConversationRow key={item.id} item={item} onDraftReply={draftReply} />
                ))}
              </ul>
            </section>
          )}

          {answered.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-foreground">
                Already answered{' '}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  {answered.length}
                </span>
              </h2>
              <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                {(showAllAnswered ? answered : answered.slice(0, ANSWERED_PREVIEW)).map((item) => (
                  <ConversationRow key={item.id} item={item} onDraftReply={draftReply} />
                ))}
              </ul>
              {!showAllAnswered && answered.length > ANSWERED_PREVIEW && (
                <button
                  onClick={() => setShowAllAnswered(true)}
                  className={cn(
                    'mt-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground underline-offset-2',
                    'transition-colors duration-200 hover:text-foreground hover:underline active:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  Show the other {answered.length - ANSWERED_PREVIEW}
                </button>
              )}
            </section>
          )}

          {/* Said once, at the bottom, rather than qualified on every row.
              Nothing in the data distinguishes a reply the Director sent from
              one typed by hand in the Instagram app, so neither is claimed. */}
          <p className="mt-8 text-xs text-muted-foreground">
            {data?.scope === 'workspace'
              ? 'Showing every account connected to social messaging. '
              : ''}
            A conversation is marked answered when the last message came from your account —
            whether the Director wrote it or you did.
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Loading, shaped like the thing that is loading.
 *
 * A spinner in the middle of the page tells you to wait; this tells you what
 * you are waiting for, and the list does not jump when it arrives.
 */
function InboxSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Inbox</h1>
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted/60" />
      </div>

      <div className="mb-3 h-3 w-32 animate-pulse rounded bg-muted/60" />
      <ul className="divide-y overflow-hidden rounded-lg border bg-card" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex items-start gap-3 p-4">
            <span className="mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted/60" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="h-4 w-28 animate-pulse rounded bg-muted/60" />
                <span className="h-3 w-20 animate-pulse rounded bg-muted/40" />
                <span className="ml-auto h-3 w-12 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="mt-2 h-3.5 w-full animate-pulse rounded bg-muted/40" />
              <div className="mt-1.5 h-3.5 w-3/5 animate-pulse rounded bg-muted/40" />
              <div className="mt-3 flex items-center gap-2">
                <span className="h-5 w-24 animate-pulse rounded-full bg-muted/60" />
                <span className="h-6 w-24 animate-pulse rounded-md bg-muted/40" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only" role="status">
        Loading your messages
      </span>
    </div>
  )
}
