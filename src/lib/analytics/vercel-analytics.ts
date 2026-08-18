/**
 * Real website traffic — how many people actually turned up.
 *
 * NRS could report what it had PUBLISHED and how fast the site loaded, and
 * called that "performance". It had never once seen a visitor. So "how are we
 * doing?" was answered with "you posted three times", which tells the owner
 * nothing about whether any of it worked.
 *
 * This reads Vercel's Web Analytics API — the same aggregated numbers the
 * dashboard shows, so what the Director says matches what he sees if he looks.
 *
 * Read-only. Nothing here can change a deployment or a project.
 */

const API = 'https://api.vercel.com/v1/query/web-analytics'

export interface VercelAnalyticsTarget {
  /** Vercel project name, e.g. 'scent-australia'. */
  project: string
  /** Team slug that owns it. Omit for a personal-account project. */
  team?: string | null
}

export interface TrafficTotals {
  pageviews: number
  visitors: number
}

export interface TrafficRow {
  label: string
  pageviews: number
  visitors: number
}

export interface EventRow {
  label: string
  count: number
  visitors: number
}

export class VercelAnalyticsError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'VercelAnalyticsError'
  }
}

export function vercelAnalyticsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL_API_TOKEN)
}

/**
 * Values in an OData filter are single-quoted, so a value containing a quote
 * would end the string early and change the query. Doubling it is the escape.
 */
export function escapeODataValue(value: string): string {
  return value.replace(/'/g, "''")
}

async function query<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  options: {
    token?: string
    fetchImpl?: typeof fetch
  } = {},
): Promise<T> {
  // An explicit `token: undefined` must stay missing. A default parameter would
  // fall through to `process.env.VERCEL_API_TOKEN`, and Vercel production builds
  // inject one — which is how the missing-token test passed locally and failed
  // the deploy.
  const token = Object.hasOwn(options, 'token') ? options.token : process.env.VERCEL_API_TOKEN
  const fetchImpl = options.fetchImpl ?? fetch
  if (!token) throw new VercelAnalyticsError('VERCEL_API_TOKEN is not set')

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }

  const response = await fetchImpl(`${API}/${path}?${search.toString()}`, {
    headers: { authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')

    // Vercel reports "not switched on" as a 400 with a specific code, not as a
    // 403 — verified against the live API. Matching on the status alone would
    // report a project that simply needs a toggle flipped as a broken request,
    // which sends the owner looking for a fault that is not there.
    if (detail.includes('web_analytics_not_enabled')) {
      throw new VercelAnalyticsError(
        'Web Analytics is not switched on for that project yet. Turn it on in the Vercel dashboard → the project → Analytics, and numbers start collecting from that moment.',
        response.status,
      )
    }

    if (response.status === 403 || response.status === 404) {
      throw new VercelAnalyticsError(
        'Vercel returned no analytics for that project — the key may not cover the team that owns it.',
        response.status,
      )
    }

    throw new VercelAnalyticsError(`Vercel analytics request failed (${response.status}): ${detail.slice(0, 200)}`, response.status)
  }

  return (await response.json()) as T
}

function targetParams(target: VercelAnalyticsTarget) {
  return {
    projectId: target.project,
    ...(target.team ? { teamId: target.team, slug: target.team } : {}),
  }
}

/** Total pageviews and visitors over a window. */
export async function getTrafficTotals(
  target: VercelAnalyticsTarget,
  { since, until, filter }: { since?: string; until?: string; filter?: string } = {},
  options?: { token?: string; fetchImpl?: typeof fetch },
): Promise<TrafficTotals> {
  const body = await query<{ data?: { pageviews?: number; visitors?: number } }>(
    'visits/count',
    { ...targetParams(target), since, until, filter },
    options,
  )
  return {
    pageviews: body.data?.pageviews ?? 0,
    visitors: body.data?.visitors ?? 0,
  }
}

/**
 * Traffic grouped by one dimension — day, route, country, referrerHostname,
 * deviceType, utmCampaign. Used for "what did people actually look at".
 */
export async function getTrafficBy(
  target: VercelAnalyticsTarget,
  dimension: string,
  { since, until, limit = 10, filter }: { since?: string; until?: string; limit?: number; filter?: string } = {},
  options?: { token?: string; fetchImpl?: typeof fetch },
): Promise<TrafficRow[]> {
  const body = await query<{ data?: Array<Record<string, unknown>> }>(
    'visits/aggregate',
    { ...targetParams(target), since, until, by: dimension, limit, filter },
    options,
  )

  return (body.data ?? []).map((row) => ({
    label: readLabel(row, dimension),
    pageviews: Number(row.pageviews ?? 0),
    visitors: Number(row.visitors ?? 0),
  }))
}

/** Custom events — signups, listings created, checkouts. */
export async function getEventsBy(
  target: VercelAnalyticsTarget,
  dimension: string,
  { since, until, limit = 10, filter }: { since?: string; until?: string; limit?: number; filter?: string } = {},
  options?: { token?: string; fetchImpl?: typeof fetch },
): Promise<EventRow[]> {
  const body = await query<{ data?: Array<Record<string, unknown>> }>(
    'events/aggregate',
    { ...targetParams(target), since, until, by: dimension, limit, filter },
    options,
  )

  return (body.data ?? []).map((row) => ({
    label: readLabel(row, dimension),
    count: Number(row.count ?? 0),
    visitors: Number(row.visitors ?? 0),
  }))
}

/**
 * Pull the grouped value out of a row.
 *
 * The API names the column after the dimension, EXCEPT for `eventData/<prop>`
 * which comes back as plain `eventData`, and time grouping which comes back as
 * `timestamp`. Guessing wrong yields "undefined" as a row label, which reads
 * like broken data to the owner.
 */
export function readLabel(row: Record<string, unknown>, dimension: string): string {
  if (dimension === 'day' || dimension === 'hour' || dimension === 'month') {
    const stamp = row.timestamp
    return typeof stamp === 'string' ? stamp.slice(0, 10) : 'unknown'
  }
  if (dimension.startsWith('eventData/') || dimension.startsWith('flags/')) {
    const key = dimension.startsWith('eventData/') ? 'eventData' : 'flags'
    const value = row[key] ?? row[dimension]
    return value === null || value === undefined || value === '' ? '(not set)' : String(value)
  }

  const value = row[dimension]
  if (value !== null && value !== undefined && value !== '') return String(value)

  // The empty-value wording has to match what the dimension MEANS. A blank
  // referrer genuinely is direct traffic; a blank page is not — printing
  // "most-read page: (direct / none)" is nonsense that reads as broken data.
  return EMPTY_LABEL[dimension] ?? '(not recorded)'
}

const EMPTY_LABEL: Record<string, string> = {
  referrerHostname: '(direct / none)',
  utmCampaign: '(no campaign tag)',
  country: '(unknown country)',
  deviceType: '(unknown device)',
  route: '(unknown page)',
  requestPath: '(unknown page)',
}

/** ISO date (YYYY-MM-DD) `days` ago, which is what `since` expects. */
export function daysAgo(days: number, now: Date): string {
  const then = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return then.toISOString().slice(0, 10)
}

/**
 * A complete date window.
 *
 * `until` is REQUIRED whenever `since` is sent — the live API answers a lone
 * `since` with "missing required property `until`" and no data at all. Building
 * the pair in one place means no caller can send half a window.
 */
export function dateWindow(days: number, now: Date): { since: string; until: string } {
  return { since: daysAgo(days, now), until: daysAgo(0, now) }
}
