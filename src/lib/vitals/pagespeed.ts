/**
 * Core Web Vitals for the brands' own sites.
 *
 * Reports FIELD data first — real Chrome users over the trailing 28 days —
 * because that is what Google ranks on. Lab data from Lighthouse is useful for
 * chasing a cause, but a green lab score on a site whose real users are waiting
 * four seconds is a comforting lie, so the two are never mixed.
 *
 * Thresholds are Google's own, at the 75th percentile:
 *   LCP  good ≤ 2500ms   needs-work ≤ 4000ms   else poor
 *   INP  good ≤ 200ms    needs-work ≤ 500ms    else poor
 *   CLS  good ≤ 0.10     needs-work ≤ 0.25     else poor
 */

export type VitalVerdict = 'good' | 'needs-work' | 'poor' | 'no-data'

export interface VitalsResult {
  brand: string
  url: string
  strategy: 'mobile' | 'desktop'
  /** Real-user data. Absent when the site has too few visitors to qualify. */
  field: { lcp: number | null; inp: number | null; cls: number | null } | null
  /** Lighthouse category scores, 0-100. */
  lab: { performance: number; seo: number; accessibility: number } | null
  /** Biggest wins Lighthouse found, largest saving first. */
  opportunities: Array<{ title: string; savingsMs: number }>
  verdict: VitalVerdict
  error?: string
}

export function gradeLcp(ms: number | null): VitalVerdict {
  if (ms === null) return 'no-data'
  return ms <= 2500 ? 'good' : ms <= 4000 ? 'needs-work' : 'poor'
}

export function gradeInp(ms: number | null): VitalVerdict {
  if (ms === null) return 'no-data'
  return ms <= 200 ? 'good' : ms <= 500 ? 'needs-work' : 'poor'
}

export function gradeCls(score: number | null): VitalVerdict {
  if (score === null) return 'no-data'
  return score <= 0.1 ? 'good' : score <= 0.25 ? 'needs-work' : 'poor'
}

/**
 * A site passes only if every measured vital passes.
 *
 * Google assesses Core Web Vitals as all-or-nothing, so averaging them would
 * report a pass for a site that is actually failing on one.
 */
export function overallVerdict(field: VitalsResult['field']): VitalVerdict {
  if (!field) return 'no-data'
  const grades = [gradeLcp(field.lcp), gradeInp(field.inp), gradeCls(field.cls)].filter((g) => g !== 'no-data')
  if (grades.length === 0) return 'no-data'
  if (grades.includes('poor')) return 'poor'
  if (grades.includes('needs-work')) return 'needs-work'
  return 'good'
}

export function pagespeedConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.PAGESPEED_API_KEY)
}

export async function measure({
  brand,
  url,
  strategy,
  apiKey = process.env.PAGESPEED_API_KEY,
}: {
  brand: string
  url: string
  strategy: 'mobile' | 'desktop'
  apiKey?: string
}): Promise<VitalsResult> {
  const base: VitalsResult = { brand, url, strategy, field: null, lab: null, opportunities: [], verdict: 'no-data' }
  if (!apiKey) return { ...base, error: 'PAGESPEED_API_KEY is not set' }

  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('strategy', strategy)
  endpoint.searchParams.set('key', apiKey)
  for (const c of ['performance', 'seo', 'accessibility']) endpoint.searchParams.append('category', c)

  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(120_000) })
    const data = (await response.json()) as Record<string, any>
    if (data.error) return { ...base, error: String(data.error.message).slice(0, 200) }

    const metrics = data.loadingExperience?.metrics
    const field = metrics
      ? {
          lcp: metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
          inp: metrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          // CrUX reports CLS multiplied by 100.
          cls: metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null
            ? metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
            : null,
        }
      : null

    const categories = data.lighthouseResult?.categories
    const lab = categories
      ? {
          performance: Math.round((categories.performance?.score ?? 0) * 100),
          seo: Math.round((categories.seo?.score ?? 0) * 100),
          accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
        }
      : null

    const audits: Record<string, any> = data.lighthouseResult?.audits ?? {}
    const opportunities = Object.values(audits)
      .filter((a) => (a?.details?.overallSavingsMs ?? 0) >= 500)
      .map((a) => ({ title: String(a.title), savingsMs: Math.round(a.details.overallSavingsMs) }))
      .sort((a, b) => b.savingsMs - a.savingsMs)
      .slice(0, 3)

    return { ...base, field, lab, opportunities, verdict: overallVerdict(field) }
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) }
  }
}
