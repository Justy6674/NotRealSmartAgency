'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui/focus'
import type { InboxUnavailableReason } from './types'

/**
 * The state this page is most often in, so it is designed first.
 *
 * "Nothing here" would be the easy version and it teaches nothing. Each of
 * these says the same three things: what would appear, why it is not appearing
 * yet, and the one action that changes that. The distinctions matter — an
 * inbox that has never been connected and an inbox that is connected and quiet
 * look identical if you only count rows, and they need opposite responses.
 */
export function InboxEmptyState({
  reason,
  error,
  onRetry,
}: {
  /** Null means the inbox was read successfully and is genuinely quiet. */
  reason: InboxUnavailableReason | null
  error?: string
  onRetry: () => void
}) {
  if (reason === 'unreachable') {
    return (
      <Panel heading="Your messages could not be read just now">
        <p className="text-sm text-muted-foreground">
          {error ??
            'The connection to your social accounts did not answer. Nothing has been lost — the messages are still on Instagram and Facebook.'}
        </p>
        <button
          onClick={onRetry}
          className={cn(
            'mt-5 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-foreground',
            'transition-colors duration-200 hover:bg-accent active:bg-accent/70',
            FOCUS_RING,
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      </Panel>
    )
  }

  if (reason === 'not_configured' || reason === 'no_accounts') {
    return (
      <Panel heading="No social account is connected yet">
        <p className="text-sm text-muted-foreground">
          Once an Instagram, Facebook, TikTok or YouTube account is connected, every direct
          message and comment those accounts receive appears here as one list, newest first.
        </p>
        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-muted-foreground">
          <Line>Messages a customer sent last are marked <Strong>Needs you</Strong>.</Line>
          <Line>
            Messages the Director has already replied to are marked{' '}
            <Strong>Director handled</Strong>, so you can skip them.
          </Line>
          <Line>Every row links back to the real thread, so nothing is trapped in here.</Line>
        </ul>
        <Link
          href="/agency/studio/accounts"
          className={cn(
            'mt-6 inline-flex items-center rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background',
            'transition-colors duration-200 hover:bg-foreground/90 active:bg-foreground/80',
            FOCUS_RING,
          )}
        >
          Connect an account
        </Link>
      </Panel>
    )
  }

  return (
    <Panel heading="Nothing has come in yet">
      <p className="text-sm text-muted-foreground">
        Your accounts are connected and being watched. The next direct message or comment a
        customer sends will appear here within a few minutes.
      </p>
      <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-muted-foreground">
        <Line>
          Anything a customer sent last sits at the top marked <Strong>Needs you</Strong>.
        </Line>
        <Line>
          You can hand any message to the Director to draft the reply, and approve it before it
          sends.
        </Line>
      </ul>
      <button
        onClick={onRetry}
        className={cn(
          'mt-6 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-foreground',
          'transition-colors duration-200 hover:bg-accent active:bg-accent/70',
          FOCUS_RING,
        )}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Check now
      </button>
    </Panel>
  )
}

function Panel({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
      <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
      <div className="mx-auto mt-2 max-w-lg">{children}</div>
    </div>
  )
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
      <span>{children}</span>
    </li>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>
}
