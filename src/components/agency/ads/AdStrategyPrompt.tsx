'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui/focus'
import { useAgencyStore } from '@/stores/agency-store'
import { bySpendDescending, summarise, type Campaign } from './campaign'
import { formatMoney, platformName } from './format'

/**
 * Ask the Director about the money.
 *
 * This is the same handoff the board uses for a decision row: set the brand,
 * start a fresh conversation, put the text in the composer and go. The text
 * arrives written but unsent, so it can be read and changed before it goes —
 * sending it automatically would take the decision away at the moment the
 * owner asked to look at it.
 */
export function AdStrategyPrompt({
  brandId,
  brandName,
  campaigns,
  linked,
}: {
  brandId: string
  brandName: string
  campaigns: Campaign[]
  /** False when this brand has no ad profile, so suggestions must not cite figures. */
  linked: boolean
}) {
  const router = useRouter()
  const setBrand = useAgencyStore((s) => s.setBrand)
  const setConversation = useAgencyStore((s) => s.setConversation)
  const setPendingComposerText = useAgencyStore((s) => s.setPendingComposerText)

  const [text, setText] = useState('')

  const open = (question: string) => {
    const trimmed = question.trim()
    if (!trimmed) return
    setBrand(brandId)
    setConversation(null)
    setPendingComposerText(trimmed)
    router.push('/agency/chat')
  }

  const suggestions = buildSuggestions(brandName, campaigns, linked)

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Ask the Director about the spend</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The Director can see these campaigns alongside this brand&rsquo;s goal and what has been
        published. Your question opens in the chat, written but not sent, so you can change it
        first.
      </p>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault()
          open(text)
        }}
      >
        <label htmlFor="ad-strategy-question" className="sr-only">
          Your question about paid advertising
        </label>
        <textarea
          id="ad-strategy-question"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Which of these should I cut, and where should the budget go instead?"
          className={cn(
            'w-full resize-none rounded-md border bg-background px-3 py-2 text-sm text-foreground',
            'placeholder:text-muted-foreground',
            'transition-colors duration-200',
            'hover:border-foreground/20',
            FOCUS_RING,
          )}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => open(s.question)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs text-muted-foreground',
                  'transition-colors duration-200',
                  'hover:bg-accent hover:text-foreground active:bg-accent/70',
                  FOCUS_RING,
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={text.trim() === ''}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5',
              'text-xs font-medium text-background',
              'transition-colors duration-200',
              'hover:bg-foreground/90 active:bg-foreground/80',
              FOCUS_RING,
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Open in chat
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </form>
    </section>
  )
}

/**
 * Suggestions quote the real ledger. With no campaigns there are no figures to
 * quote, so they ask about getting started instead of inventing a number.
 */
function buildSuggestions(
  brandName: string,
  campaigns: Campaign[],
  linked: boolean,
): { label: string; question: string }[] {
  if (!linked || campaigns.length === 0) {
    // An unlinked brand may well be running ads straight from Meta Ads Manager.
    // NRS cannot see those, so it does not get to say there are none.
    const standing = linked
      ? `${brandName} has no ad campaigns running.`
      : `${brandName} is not connected to an ad account here, so I cannot see whether anything is running for it.`

    return [
      {
        label: 'Is paid worth it here',
        question: `${standing} Before I spend anything, tell me honestly whether paid advertising is the right move for this brand right now, given its goal and what we have published organically.`,
      },
      {
        label: 'Where a first budget goes',
        question: `If I put a small test budget behind ${brandName}, which platform and which audience would you start with, and what would you expect it to cost before we learn anything useful?`,
      },
      {
        label: 'What to prepare first',
        question: `What do we need in place for ${brandName} before running ads — creative, landing page, tracking — so we are not paying for traffic we cannot measure?`,
      },
    ]
  }

  const totals = summarise(campaigns)
  const heaviest = [...campaigns].sort(bySpendDescending)[0]
  const spendPhrase =
    totals.spend !== null
      ? `${formatMoney(totals.spend, totals.currency)} across ${totals.campaignCount} ${totals.campaignCount === 1 ? 'campaign' : 'campaigns'}`
      : `${totals.campaignCount} ${totals.campaignCount === 1 ? 'campaign' : 'campaigns'}`

  return [
    {
      label: 'What to cut',
      question: `${brandName} is spending ${spendPhrase}. Look at the results per campaign and tell me which one you would stop first, and what you expect that to save.`,
    },
    {
      label: `Review ${truncate(heaviest.name, 28)}`,
      question: heaviestQuestion(brandName, heaviest, totals.spend !== null),
    },
    {
      label: 'Move budget where it works',
      question: `Given ${brandName}'s current campaign results, how would you redistribute the budget across platforms over the next fortnight, and what should I watch to know whether it worked?`,
    },
  ]
}

/**
 * The one suggestion that names a single campaign, and the one that can lie.
 *
 * `bySpendDescending` sorts an unreported spend as -1, so with nothing reported
 * the "heaviest" campaign is simply whichever Zernio listed first. Calling that
 * one the biggest spender — at `—`, which is what formatMoney returns for null —
 * would put an invented fact into a message sent to the Director, on the page
 * whose entire premise is that a missing number is not a zero.
 *
 * So the claim is only made when the figure behind it exists. Without it the
 * question still points at a real campaign, and asks rather than asserts.
 */
function heaviestQuestion(brandName: string, heaviest: Campaign, totalKnown: boolean): string {
  const where = `"${heaviest.name}" on ${platformName(heaviest.platform)}`

  if (heaviest.spend === null) {
    return `${where} is one of ${brandName}'s live campaigns. Zernio has not reported what it has spent, so judge it on its results — is it earning its budget, what would you change, and what figure would you need to be sure?`
  }

  // Spend is known but the total is not, which `summarise` only does when the
  // campaigns bill in more than one currency. The amounts are real; their
  // ranking against each other is not, so "largest share" is dropped.
  if (!totalKnown) {
    return `${where} has spent ${formatMoney(heaviest.spend, heaviest.currency)}. These campaigns bill in more than one currency, so I cannot rank them against each other — is this one earning what it costs, and what would you change about it?`
  }

  return `${where} is taking the largest share of ${brandName}'s ad spend at ${formatMoney(heaviest.spend, heaviest.currency)}. Is it earning that, and what would you change about it?`
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}
