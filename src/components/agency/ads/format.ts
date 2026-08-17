/**
 * Number formatting for the ads ledger.
 *
 * Every formatter returns an em dash for null, because null means Zernio did
 * not report the figure. `(value || 0).toFixed(2)` — what the old grid did —
 * turns "we don't know" into "$0.00", which reads as a campaign that costs
 * nothing.
 */

const LOCALE = 'en-AU'

/** Rendered wherever a figure was not reported. */
export const NOT_REPORTED = '—'

const plain2dp = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const wholeNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

/**
 * Zernio does not normalise budgets to one currency, so the code travels with
 * the campaign. When it is absent we show the bare figure — stamping "$" on an
 * unknown currency would be a guess at what the money is.
 */
export function formatMoney(value: number | null, currency: string | null): string {
  if (value === null) return NOT_REPORTED
  if (!currency) return plain2dp.format(value)
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(value)
  } catch {
    // An unrecognised ISO code throws rather than degrading. Keep the number.
    return `${plain2dp.format(value)} ${currency}`
  }
}

export function formatCount(value: number | null): string {
  return value === null ? NOT_REPORTED : wholeNumber.format(value)
}

/** Zernio reports CTR already as a percentage, not a fraction. */
export function formatRate(value: number | null): string {
  return value === null ? NOT_REPORTED : `${plain2dp.format(value)}%`
}

/**
 * Conversions are fractional by design — attribution splits one conversion
 * across touchpoints, so 0.347 is a normal value. Rounding it to 0 would erase
 * a real result.
 */
export function formatResults(value: number | null): string {
  if (value === null) return NOT_REPORTED
  return Number.isInteger(value) ? wholeNumber.format(value) : plain2dp.format(value)
}

const PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  google: 'Google',
  twitter: 'X',
  openai: 'OpenAI',
}

export function platformName(platform: string): string {
  return PLATFORM_NAMES[platform] ?? 'Unknown platform'
}
