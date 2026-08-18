'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * The reads behind the results desk, and the manners they have to keep.
 *
 * ── Why these live together ────────────────────────────────────────────
 * Everything on this screen shares one budget. The service that holds the
 * figures allows somewhere between 60 and 1,200 requests a minute **across
 * every business on the account**, so one screen polling hard does not slow
 * itself down — it slows down every other customer. Three rules follow, and
 * they are enforced here rather than remembered at each call site:
 *
 *  1. Ask once and share the answer. The accounts list is read a single time
 *     per business, not once per panel.
 *  2. Poll only while something is genuinely still landing, with a ceiling on
 *     how long that can go on.
 *  3. When the answer is "too many requests", wait the time we are told to
 *     wait. Retrying immediately is what turns a busy minute into an outage.
 *
 * ── Honest emptiness ───────────────────────────────────────────────────
 * Two of fourteen businesses are linked to a results profile. The comment that
 * used to sit here said the other twelve had "nothing connected yet", and the
 * screen said it too — which was wrong, and wrong in the worst direction.
 * Downscale has accounts connected and posts published; nobody is gathering
 * the numbers behind them. Four states, not two, and no hook here is allowed
 * to collapse them:
 *
 *   measured, with figures        → draw them
 *   measured, genuinely quiet     → say the period was quiet
 *   connected, nobody measuring   → say that, and never "nothing is connected"
 *   we could not look             → say that, and offer another go
 */

export type AnalyticsPeriod = '7_days' | '30_days' | '90_days'

export const ANALYTICS_PERIODS: { value: AnalyticsPeriod; label: string; spoken: string }[] = [
  { value: '7_days', label: '7 days', spoken: 'the last 7 days' },
  { value: '30_days', label: '30 days', spoken: 'the last 30 days' },
  { value: '90_days', label: '90 days', spoken: 'the last 90 days' },
]

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  '7_days': 7,
  '30_days': 30,
  '90_days': 90,
}

/** The window a period means, as two plain dates. */
export function periodRange(period: AnalyticsPeriod): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - PERIOD_DAYS[period] * 86_400_000)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function spokenPeriod(period: AnalyticsPeriod): string {
  return ANALYTICS_PERIODS.find((entry) => entry.value === period)?.spoken ?? 'this period'
}

/* ── One fetch, with the two answers that are not ordinary failures ─────── */

export interface DeskFailure {
  /** What the owner reads. Never a status code and never a vendor's words. */
  problem: string
  /** Seconds to wait before asking again, when we were told to wait. */
  retryAfterSeconds?: number
  /**
   * Our own billing has lapsed, which stops every business at once. It is an
   * operator problem and the desk says so plainly rather than blaming the
   * person reading it.
   */
  billingSuspended?: boolean
}

const GENERIC_PROBLEM =
  'These figures could not be read just now. Nothing has been changed — try again in a moment.'

export async function deskFetch<T>(url: string): Promise<
  { ok: true; data: T } | { ok: false; failure: DeskFailure }
> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return { ok: false, failure: { problem: GENERIC_PROBLEM } }
  }

  const body = (await res.json().catch(() => null)) as
    | (Record<string, unknown> & { problem?: string; error?: string })
    | null

  if (res.ok) return { ok: true, data: (body ?? {}) as T }

  // The wait is honoured whether it arrives in the body or the header — a
  // second request sent straight away is the thing that hurts everyone else.
  const header = Number(res.headers.get('Retry-After'))
  const wait = typeof body?.retryAfterSeconds === 'number'
    ? body.retryAfterSeconds
    : Number.isFinite(header) && header > 0
      ? header
      : undefined

  return {
    ok: false,
    failure: {
      problem: (typeof body?.problem === 'string' && body.problem)
        || (typeof body?.error === 'string' && body.error)
        || GENERIC_PROBLEM,
      ...(wait !== undefined ? { retryAfterSeconds: wait } : {}),
      ...(body?.billingSuspended === true ? { billingSuspended: true } : {}),
    },
  }
}

/* ── Accounts: what the selector row is made of ─────────────────────────── */

export interface AnalyticsAccount {
  id: string
  platform: string
  label: string
  username?: string
  image?: string
  followers?: number
  /** null means nobody could tell us — deliberately not the same as false. */
  canFetchAnalytics: boolean | null
  health: 'healthy' | 'warning' | 'error' | 'unknown'
}

export interface AnalyticsAccountsState {
  accounts: AnalyticsAccount[]
  /** False when this business has no publisher profile at all. */
  linked: boolean
  /**
   * False when nobody is gathering results for this business — which is true
   * of twelve of the fourteen. Deliberately separate from `accounts.length`:
   * an unmeasured business still has its accounts, and the row must show them.
   */
  resultsCollected: boolean
  /** The owner-facing sentence for that, when it applies. */
  notCollected: string | null
  loading: boolean
  problem: string | null
  billingSuspended: boolean
  refresh: () => void
}

/**
 * The accounts behind the selector row.
 *
 * ── Two reads, because there are two kinds of business ─────────────────
 * A business linked to a results profile is answered by the read that knows
 * about health, avatars and follower counts. A business that is not linked was
 * previously answered by that same read as "not linked", the row rendered
 * "nothing is connected", and for Downscale — accounts connected, posts
 * published — that was simply false. So the second read runs for exactly those
 * businesses and returns the accounts they really have, marked as unmeasured.
 *
 * "Connected but nobody is measuring" and "nothing connected" are different
 * answers with different actions, and this hook now carries both rather than
 * collapsing them into an empty list.
 */
export function useAnalyticsAccounts(brandId: string | null): AnalyticsAccountsState {
  const [accounts, setAccounts] = useState<AnalyticsAccount[]>([])
  const [linked, setLinked] = useState(false)
  const [resultsCollected, setResultsCollected] = useState(false)
  const [notCollected, setNotCollected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [billingSuspended, setBilling] = useState(false)

  const load = useCallback(async () => {
    if (!brandId) {
      setAccounts([])
      setLinked(false)
      setResultsCollected(false)
      setNotCollected(null)
      setProblem(null)
      return
    }
    setLoading(true)
    const result = await deskFetch<{
      configured?: boolean
      accounts?: AnalyticsAccount[]
      problem?: string | null
    }>(`/api/zernio/analytics?view=accounts&brandId=${encodeURIComponent(brandId)}`)

    if (!result.ok) {
      setLoading(false)
      setAccounts([])
      setLinked(false)
      setResultsCollected(false)
      setNotCollected(null)
      setProblem(result.failure.problem)
      setBilling(result.failure.billingSuspended === true)
      return
    }

    setBilling(false)

    if (result.data.configured === true) {
      setLoading(false)
      setLinked(true)
      setResultsCollected(true)
      setNotCollected(null)
      setAccounts(Array.isArray(result.data.accounts) ? result.data.accounts : [])
      setProblem(result.data.problem ?? null)
      return
    }

    // Not linked to a results profile. That says nothing about whether this
    // business has accounts, so ask the question that does.
    const fallback = await deskFetch<{
      accounts?: AnalyticsAccount[]
      resultsCollected?: boolean
      notCollected?: string | null
      problem?: string | null
    }>(`/api/studio/analytics/accounts?brandId=${encodeURIComponent(brandId)}`)
    setLoading(false)
    setLinked(false)
    setResultsCollected(false)

    if (!fallback.ok) {
      setAccounts([])
      setNotCollected(null)
      setProblem(fallback.failure.problem)
      return
    }

    setAccounts(Array.isArray(fallback.data.accounts) ? fallback.data.accounts : [])
    setNotCollected(fallback.data.notCollected ?? null)
    setProblem(fallback.data.problem ?? null)
  }, [brandId])

  useEffect(() => { void load() }, [load])

  return {
    accounts,
    linked,
    resultsCollected,
    notCollected,
    loading,
    problem,
    billingSuspended,
    refresh: load,
  }
}

/* ── Sync: how current the figures are ──────────────────────────────────── */

export interface AnalyticsSyncState {
  lastSync: string | null
  dataStaleness: string | null
  publishedPosts: number | null
  scheduledPosts: number | null
  collecting: boolean
  problem: string | null
  /**
   * Our own billing has lapsed, which stops every business at once.
   *
   * It surfaces here rather than on the accounts read because the accounts
   * list swallows its failures by design — it returns an empty list rather
   * than throwing, so that a failed read can never be mistaken for permission
   * to show somebody else's accounts. This read is the one that can still
   * carry the reason.
   */
  billingSuspended: boolean
  loading: boolean
  refresh: () => void
}

/** Long enough to catch a first collection, short of hammering a shared budget. */
const POLL_SECONDS = 20
const MAX_POLLS = 15

export function useAnalyticsSync(
  brandId: string | null,
  period: AnalyticsPeriod,
): AnalyticsSyncState {
  const [state, setState] = useState<Omit<AnalyticsSyncState, 'refresh' | 'loading'>>({
    lastSync: null,
    dataStaleness: null,
    publishedPosts: null,
    scheduledPosts: null,
    collecting: false,
    problem: null,
    billingSuspended: false,
  })
  const [loading, setLoading] = useState(false)
  const polls = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const range = useMemo(() => periodRange(period), [period])

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const result = await deskFetch<{
      lastSync?: string | null
      dataStaleness?: string | null
      publishedPosts?: number | null
      scheduledPosts?: number | null
      collecting?: boolean
      problem?: string | null
    }>(
      `/api/zernio/analytics?view=sync&brandId=${encodeURIComponent(brandId)}` +
        `&from=${range.from}&to=${range.to}`,
    )
    setLoading(false)

    if (!result.ok) {
      setState((prev) => ({
        ...prev,
        collecting: false,
        problem: result.failure.problem,
        billingSuspended: result.failure.billingSuspended === true,
      }))
      // Told to wait means waited. This is the one place a retry is scheduled,
      // and it is scheduled once.
      if (result.failure.retryAfterSeconds && polls.current < MAX_POLLS) {
        polls.current += 1
        timer.current = setTimeout(() => { void load() }, result.failure.retryAfterSeconds * 1000)
      }
      return
    }

    setState({
      lastSync: result.data.lastSync ?? null,
      dataStaleness: result.data.dataStaleness ?? null,
      publishedPosts: result.data.publishedPosts ?? null,
      scheduledPosts: result.data.scheduledPosts ?? null,
      collecting: result.data.collecting === true,
      problem: result.data.problem ?? null,
      billingSuspended: false,
    })

    // Poll ONLY while something is genuinely still landing, and not forever.
    if (result.data.collecting === true && polls.current < MAX_POLLS) {
      polls.current += 1
      timer.current = setTimeout(() => { void load() }, POLL_SECONDS * 1000)
    }
  }, [brandId, range.from, range.to])

  useEffect(() => {
    polls.current = 0
    void load()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [load])

  const refresh = useCallback(() => {
    polls.current = 0
    void load()
  }, [load])

  return { ...state, loading, refresh }
}

/* ── One post's own curve ───────────────────────────────────────────────── */

export interface PostTimelinePoint {
  at: string
  metrics: Record<string, number>
}

export interface PostTimelineState {
  points: PostTimelinePoint[]
  metricKeys: string[]
  totals: Record<string, number>
  publishedAt: string | null
  problem: string | null
  loading: boolean
}

export function usePostTimeline(params: {
  brandId: string | null
  postId: string | null
  period: AnalyticsPeriod
  enabled?: boolean
}): PostTimelineState {
  const { brandId, postId, period, enabled = true } = params
  const [state, setState] = useState<Omit<PostTimelineState, 'loading'>>({
    points: [],
    metricKeys: [],
    totals: {},
    publishedAt: null,
    problem: null,
  })
  const [loading, setLoading] = useState(false)
  const range = useMemo(() => periodRange(period), [period])

  useEffect(() => {
    if (!brandId || !postId || !enabled) {
      setState({ points: [], metricKeys: [], totals: {}, publishedAt: null, problem: null })
      return
    }
    let cancelled = false
    setLoading(true)

    void deskFetch<{
      points?: PostTimelinePoint[]
      metricKeys?: string[]
      totals?: Record<string, number>
      publishedAt?: string | null
      problem?: string | null
    }>(
      `/api/zernio/analytics?view=post&brandId=${encodeURIComponent(brandId)}` +
        `&postId=${encodeURIComponent(postId)}&from=${range.from}&to=${range.to}`,
    ).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setState({
          points: [],
          metricKeys: [],
          totals: {},
          publishedAt: null,
          problem: result.failure.problem,
        })
        return
      }
      setState({
        points: result.data.points ?? [],
        metricKeys: result.data.metricKeys ?? [],
        totals: result.data.totals ?? {},
        publishedAt: result.data.publishedAt ?? null,
        problem: result.data.problem ?? null,
      })
    })

    return () => { cancelled = true }
  }, [brandId, postId, enabled, range.from, range.to])

  return { ...state, loading }
}

/* ── The channel's own extra figures ────────────────────────────────────── */

export interface NativeMetric {
  key: string
  label: string
  total: number | null
  points: { date: string; value: number }[]
}

export interface NativeInsightsState {
  metrics: NativeMetric[]
  unavailable: string[]
  problem: string | null
  loading: boolean
}

export function useNativeInsights(params: {
  brandId: string | null
  accountId: string | null
  platform: string | null
  period: AnalyticsPeriod
}): NativeInsightsState {
  const { brandId, accountId, platform, period } = params
  const [state, setState] = useState<Omit<NativeInsightsState, 'loading'>>({
    metrics: [],
    unavailable: [],
    problem: null,
  })
  const [loading, setLoading] = useState(false)
  const range = useMemo(() => periodRange(period), [period])

  useEffect(() => {
    if (!brandId || !accountId || !platform) {
      setState({ metrics: [], unavailable: [], problem: null })
      return
    }
    let cancelled = false
    setLoading(true)

    void deskFetch<{
      metrics?: NativeMetric[]
      unavailable?: string[]
      problem?: string | null
    }>(
      `/api/zernio/analytics?view=native&brandId=${encodeURIComponent(brandId)}` +
        `&accountId=${encodeURIComponent(accountId)}&platform=${encodeURIComponent(platform)}` +
        `&from=${range.from}&to=${range.to}`,
    ).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setState({ metrics: [], unavailable: [], problem: result.failure.problem })
        return
      }
      setState({
        metrics: result.data.metrics ?? [],
        unavailable: result.data.unavailable ?? [],
        problem: result.data.problem ?? null,
      })
    })

    return () => { cancelled = true }
  }, [brandId, accountId, platform, range.from, range.to])

  return { ...state, loading }
}

/* ── Bringing in a post published somewhere else ────────────────────────── */

export async function bringInExternalPost(params: {
  brandId: string
  accountId: string
  url: string
}): Promise<{ ok: boolean; problem: string | null }> {
  let res: Response
  try {
    res = await fetch('/api/zernio/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch {
    return { ok: false, problem: GENERIC_PROBLEM }
  }

  const body = (await res.json().catch(() => null)) as
    | { synced?: boolean; problem?: string | null; error?: string }
    | null

  if (!res.ok) {
    return {
      ok: false,
      problem: body?.problem || body?.error || GENERIC_PROBLEM,
    }
  }
  return { ok: body?.synced === true, problem: body?.problem ?? null }
}
