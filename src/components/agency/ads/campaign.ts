/**
 * Shapes and arithmetic for the paid ads ledger.
 *
 * `/api/zernio/ads` hands back whatever Zernio returned, typed `any`. The
 * previous grid read `c.name`, `c.spend` and `c.status === 'ACTIVE'` — none of
 * which exist on an AdCampaign — so every row rendered "Unnamed Campaign",
 * $0.00 and "Paused" regardless of reality. Everything here is named against
 * the real contract in node_modules/@zernio/node/dist/index.d.ts:1691.
 *
 * The other rule this file exists to hold: a missing number is `null`, never
 * 0. Zernio genuinely reports 0 spend, and a campaign that reported nothing at
 * all is a different fact. Collapsing the two is how a founder ends up
 * believing a campaign is free.
 */

/** Delivery status, derived by Zernio from the child ad statuses. */
export type AdDeliveryStatus =
  | 'active'
  | 'paused'
  | 'pending_review'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'error'

/** Platform-side review state — separate from whether it is delivering. */
export type AdReviewStatus = 'in_review' | 'approved' | 'rejected' | 'with_issues'

export interface Campaign {
  /** platformCampaignId — AdCampaign has no `_id` and no `id`. */
  id: string
  name: string
  platform: string
  status: AdDeliveryStatus | 'unknown'
  reviewStatus: AdReviewStatus | null
  /** ISO 4217. Budgets are NOT normalised to one currency by Zernio. */
  currency: string | null
  spend: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  cpc: number | null
  conversions: number | null
  costPerConversion: number | null
  budget: { amount: number; type: 'daily' | 'lifetime' } | null
  adCount: number | null
  accountName: string | null
}

const DELIVERY_STATUSES: readonly AdDeliveryStatus[] = [
  'active',
  'paused',
  'pending_review',
  'rejected',
  'completed',
  'cancelled',
  'error',
]

const REVIEW_STATUSES: readonly AdReviewStatus[] = [
  'in_review',
  'approved',
  'rejected',
  'with_issues',
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** A finite number, or null. Rejects NaN, Infinity and numeric strings. */
function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

export function normaliseCampaign(raw: unknown, index: number): Campaign {
  const c = asRecord(raw)
  const metrics = asRecord(c.metrics)
  const budget = asRecord(c.budget)

  const status = asText(c.status)
  const review = asText(c.reviewStatus)
  const budgetAmount = asNumber(budget.amount)
  const budgetType = asText(budget.type)

  return {
    id: asText(c.platformCampaignId) ?? `campaign-${index}`,
    // Zernio can return a campaign before its name has synced. Saying so is
    // better than printing "Unnamed Campaign" as though that were the name.
    name: asText(c.campaignName) ?? 'Name not synced yet',
    platform: asText(c.platform) ?? 'unknown',
    status: DELIVERY_STATUSES.includes(status as AdDeliveryStatus)
      ? (status as AdDeliveryStatus)
      : 'unknown',
    reviewStatus: REVIEW_STATUSES.includes(review as AdReviewStatus)
      ? (review as AdReviewStatus)
      : null,
    currency: asText(c.currency),
    spend: asNumber(metrics.spend),
    impressions: asNumber(metrics.impressions),
    clicks: asNumber(metrics.clicks),
    ctr: asNumber(metrics.ctr),
    cpc: asNumber(metrics.cpc),
    conversions: asNumber(metrics.conversions),
    costPerConversion: asNumber(metrics.costPerConversion),
    budget:
      budgetAmount !== null && (budgetType === 'daily' || budgetType === 'lifetime')
        ? { amount: budgetAmount, type: budgetType }
        : null,
    adCount: asNumber(c.adCount),
    accountName: asText(c.platformAdAccountName),
  }
}

export interface LedgerTotals {
  campaignCount: number
  runningCount: number
  spend: number | null
  /** Null when campaigns bill in more than one currency — see `mixedCurrency`. */
  currency: string | null
  mixedCurrency: boolean
  impressions: number | null
  clicks: number | null
  conversions: number | null
  /** Blended, recomputed from the totals. Never an average of per-row rates. */
  ctr: number | null
  cpc: number | null
}

/** Sum a column, returning null only when nothing at all was reported. */
function sum(values: (number | null)[]): number | null {
  const reported = values.filter((v): v is number => v !== null)
  return reported.length === 0 ? null : reported.reduce((a, b) => a + b, 0)
}

/**
 * Reach is deliberately absent. Zernio de-duplicates it per platform, so it is
 * not additive — summing it would invent people who were never reached.
 * CTR and CPC are recomputed from the totals rather than averaged, because the
 * mean of per-campaign rates is not the blended rate.
 */
export function summarise(campaigns: Campaign[]): LedgerTotals {
  const currencies = Array.from(
    new Set(campaigns.map((c) => c.currency).filter((c): c is string => c !== null)),
  )
  const mixedCurrency = currencies.length > 1

  const spend = mixedCurrency ? null : sum(campaigns.map((c) => c.spend))
  const impressions = sum(campaigns.map((c) => c.impressions))
  const clicks = sum(campaigns.map((c) => c.clicks))

  return {
    campaignCount: campaigns.length,
    runningCount: campaigns.filter((c) => c.status === 'active').length,
    spend,
    currency: mixedCurrency ? null : (currencies[0] ?? null),
    mixedCurrency,
    impressions,
    clicks,
    conversions: sum(campaigns.map((c) => c.conversions)),
    ctr: impressions !== null && impressions > 0 && clicks !== null ? (clicks / impressions) * 100 : null,
    cpc: spend !== null && clicks !== null && clicks > 0 ? spend / clicks : null,
  }
}

/** Heaviest spend first — the row a founder is looking for is the expensive one. */
export function bySpendDescending(a: Campaign, b: Campaign): number {
  return (b.spend ?? -1) - (a.spend ?? -1)
}
