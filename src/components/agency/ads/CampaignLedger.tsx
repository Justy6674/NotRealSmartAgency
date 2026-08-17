'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_CHIP, TONE_TEXT } from '@/lib/ui/status-tone'
import { bySpendDescending, summarise, type Campaign } from './campaign'
import { formatCount, formatMoney, formatRate, formatResults, platformName } from './format'
import { isTogglable, StatusChip, StatusControl } from './CampaignStatusControl'

/**
 * One ledger, not a wall of tiles.
 *
 * Spend and results share a column with every campaign that produced them, so
 * the total sits directly under the rows it came from and you can read down a
 * column to find where the money went. A row of hero metrics above a table
 * would say the same numbers twice and lose that alignment.
 */

const NUMERIC_CELL = 'px-3 py-3 text-right font-mono tabular-nums text-sm text-foreground'
const NUMERIC_HEAD = 'px-3 py-2 text-right text-xs font-medium text-muted-foreground'

export function CampaignLedger({
  campaigns,
  brandId,
  /** Re-reads the list from the server so a row only moves when Zernio agrees. */
  onStatusChanged,
}: {
  campaigns: Campaign[]
  /** Sent with every pause. The route uses it to prove the campaign is yours. */
  brandId: string
  onStatusChanged: () => Promise<void>
}) {
  const rows = [...campaigns].sort(bySpendDescending)
  const totals = summarise(campaigns)

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] border-collapse">
          <caption className="sr-only">
            Ad campaigns with spend and results, heaviest spend first
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-2 text-xs font-medium text-muted-foreground">
                Campaign
              </th>
              <th scope="col" className="px-3 py-2 text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th scope="col" className={NUMERIC_HEAD}>Spend</th>
              <th scope="col" className={NUMERIC_HEAD}>Impressions</th>
              <th scope="col" className={NUMERIC_HEAD}>Clicks</th>
              <th scope="col" className={NUMERIC_HEAD}>CTR</th>
              <th scope="col" className={NUMERIC_HEAD}>Cost per click</th>
              <th scope="col" className={NUMERIC_HEAD}>Results</th>
              <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                <span className="sr-only">Pause or resume</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {rows.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                brandId={brandId}
                onStatusChanged={onStatusChanged}
              />
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 bg-muted/30">
              <th scope="row" className="px-4 py-3 text-left text-sm font-medium text-foreground">
                {totals.campaignCount} {totals.campaignCount === 1 ? 'campaign' : 'campaigns'}
              </th>
              <td className="px-3 py-3 text-xs text-muted-foreground">
                {totals.runningCount} running
              </td>
              <td className={cn(NUMERIC_CELL, 'font-semibold')}>
                {totals.mixedCurrency ? '—' : formatMoney(totals.spend, totals.currency)}
              </td>
              <td className={cn(NUMERIC_CELL, 'font-semibold')}>{formatCount(totals.impressions)}</td>
              <td className={cn(NUMERIC_CELL, 'font-semibold')}>{formatCount(totals.clicks)}</td>
              <td className={cn(NUMERIC_CELL, 'font-semibold')}>{formatRate(totals.ctr)}</td>
              <td className={cn(NUMERIC_CELL, 'font-semibold')}>
                {formatMoney(totals.cpc, totals.currency)}
              </td>
              <td className={cn(NUMERIC_CELL, 'font-semibold')}>{formatResults(totals.conversions)}</td>
              <td className="px-4 py-3" />
            </tr>

            {totals.mixedCurrency && (
              <tr className="bg-muted/30">
                <td colSpan={9} className="px-4 pb-3 text-xs text-muted-foreground">
                  These campaigns bill in more than one currency, so spend and cost per click are
                  not totalled. Each row shows its own currency.
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        CTR and cost per click on the total row are recalculated from the totals, not averaged
        across campaigns. Reach is left out because the platforms de-duplicate it, so it cannot be
        added up.
      </p>
    </div>
  )
}

function CampaignRow({
  campaign,
  brandId,
  onStatusChanged,
}: {
  campaign: Campaign
  brandId: string
  onStatusChanged: () => Promise<void>
}) {
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  /**
   * The row is never moved locally. A pause is real money stopping, so the
   * only thing allowed to change what this row says is a fresh read from the
   * server — an optimistic flip would show "Paused" over a campaign that is
   * still spending.
   */
  const toggle = async () => {
    if (!isTogglable(campaign.status)) return
    const next = campaign.status === 'active' ? 'paused' : 'active'

    setSending(true)
    setFailure(null)
    try {
      const res = await fetch('/api/zernio/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The brand is what lets the route prove this campaign is one of
          // ours before it stops any money.
          brandId,
          campaignId: campaign.id,
          // Lowercase is what Zernio's status endpoint accepts, and `platform`
          // is required upstream alongside it. The route now forwards both —
          // and cross-checks the platform against Zernio's own record.
          status: next,
          platform: campaign.platform,
        }),
      })
      if (!res.ok) throw new Error('rejected')
      await onStatusChanged()
    } catch {
      // The route's own error text carries the raw upstream response body.
      // Repeating it here would put Zernio's internals in front of the owner
      // and still not tell him what to do.
      setFailure(
        campaign.status === 'active'
          ? `This campaign was not paused and is still spending. Try again, or pause it in ${platformName(campaign.platform)} Ads Manager.`
          : `This campaign was not resumed and is still paused. Try again, or resume it in ${platformName(campaign.platform)} Ads Manager.`,
      )
    } finally {
      setSending(false)
    }
  }

  const needsAttention =
    campaign.reviewStatus === 'rejected' || campaign.reviewStatus === 'with_issues'

  return (
    <>
      <tr className="transition-colors hover:bg-accent/40">
        <th scope="row" className="max-w-[22rem] px-4 py-3 text-left font-normal">
          <span className="block truncate text-sm font-medium text-foreground" title={campaign.name}>
            {campaign.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {platformName(campaign.platform)}
            {campaign.accountName ? ` · ${campaign.accountName}` : ''}
            {campaign.budget
              ? ` · ${formatMoney(campaign.budget.amount, campaign.currency)} ${campaign.budget.type}`
              : ''}
          </span>
          {needsAttention && (
            <span className={cn('mt-1 flex items-center gap-1 text-xs', TONE_TEXT.attention)}>
              <AlertCircle className="h-3 w-3 shrink-0" />
              {campaign.reviewStatus === 'rejected'
                ? 'The platform rejected this campaign — it will not deliver until the ad is changed'
                : 'The platform has flagged issues with this campaign'}
            </span>
          )}
        </th>

        <td className="px-3 py-3">
          <StatusChip status={campaign.status} />
        </td>

        <td className={NUMERIC_CELL}>{formatMoney(campaign.spend, campaign.currency)}</td>
        <td className={NUMERIC_CELL}>{formatCount(campaign.impressions)}</td>
        <td className={NUMERIC_CELL}>{formatCount(campaign.clicks)}</td>
        <td className={NUMERIC_CELL}>{formatRate(campaign.ctr)}</td>
        <td className={NUMERIC_CELL}>{formatMoney(campaign.cpc, campaign.currency)}</td>
        <td className={NUMERIC_CELL}>
          {formatResults(campaign.conversions)}
          {campaign.costPerConversion !== null && campaign.conversions !== null && campaign.conversions > 0 && (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {formatMoney(campaign.costPerConversion, campaign.currency)} each
            </span>
          )}
        </td>

        <td className="px-4 py-3 text-right">
          {isTogglable(campaign.status) ? (
            <StatusControl status={campaign.status} sending={sending} onToggle={() => void toggle()} />
          ) : (
            <span className="text-xs text-muted-foreground">
              Change this in {platformName(campaign.platform)}
            </span>
          )}
        </td>
      </tr>

      {failure && (
        <tr>
          <td colSpan={9} className="px-4 pb-3">
            <p role="status" className={cn('rounded-md border px-3 py-2 text-xs', TONE_CHIP.critical)}>
              {failure}
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

/** Table-shaped loading state — the columns are already where they will land. */
export function CampaignLedgerSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card" aria-hidden>
      <div className="border-b bg-muted/40 px-4 py-2.5">
        <div className="h-3 w-28 animate-pulse rounded bg-muted-foreground/20" />
      </div>
      <div className="divide-y">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-2/5 animate-pulse rounded bg-muted-foreground/20" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-muted-foreground/10" />
            </div>
            <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-muted-foreground/15" />
            <div className="h-3.5 w-16 shrink-0 animate-pulse rounded bg-muted-foreground/20" />
            <div className="h-3.5 w-20 shrink-0 animate-pulse rounded bg-muted-foreground/20" />
            <div className="h-3.5 w-14 shrink-0 animate-pulse rounded bg-muted-foreground/20" />
            <div className="h-6 w-20 shrink-0 animate-pulse rounded-md bg-muted-foreground/15" />
          </div>
        ))}
      </div>
    </div>
  )
}
