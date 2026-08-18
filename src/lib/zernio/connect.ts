/**
 * The headless connect flow: our own UI, Zernio's OAuth.
 *
 * Depended on by: `/api/zernio/connect/start`, `/api/zernio/connect/callback`,
 * `/api/zernio/connect/select`, `/api/zernio/connect/disconnect` and
 * `brand-profile.ts`.
 *
 * ── Why headless, and what it costs us ─────────────────────────────────
 *
 * `GET /v1/connect/{platform}` without `headless=true` sends the person into
 * ZERNIO'S account-picker. A subscriber connecting their own Facebook Page then
 * reads a third party's brand name on the screen that decides which of their
 * Pages this software may post to. `headless=true` sends them back to US with
 * the raw OAuth result instead, and we render the picker.
 *
 * The cost is that we now hold, for a few minutes, a platform access token that
 * is not ours. Three rules fall out of that and none of them is optional:
 *
 *   1. The `tempToken` and the decoded `userProfile` NEVER go back to the
 *      browser in a readable form. They live in an httpOnly cookie inside a
 *      signed continuation (`signConnectState`), the same shape
 *      `/api/zernio/connect` already used for its handshake. The browser sees
 *      page names and page ids; it never sees a credential.
 *   2. The state is signed and carries the brandId. Zernio's own `state` proves
 *      the OAuth round trip; it proves nothing about WHICH of our brands asked.
 *      Without our own signature, a person could start a connect on a brand they
 *      own and finish it onto a brand they do not.
 *   3. Ten minutes. Zernio expires its pending data in ten; a continuation that
 *      outlived it would be a token sitting in a browser for no purpose.
 *
 * ── The three upstream failures that are not "an error" ────────────────
 *
 * **A wrong path answers HTTP 200 with an HTML page.** Not 404. So the content
 * type is read BEFORE the status, always — see `errors.ts`, which carries the
 * measurement. `if (!res.ok)` cannot fire on the failure that matters.
 *
 * **402 is OUR bill, not theirs.** `PAYMENT_REQUIRED` means the NRS Zernio team
 * account is suspended or over its plan. It is not a fact about the subscriber
 * who happened to click Connect, and telling them "payment required" would be a
 * lie that costs a support ticket at best. Every tenant stops at the same
 * instant, so it is an operator page, not a user-facing error.
 *
 * **429 is shared.** The rate limit is per TEAM — ours — so one busy brand can
 * exhaust it for every other brand on the platform. `Retry-After` is honoured
 * rather than guessed at, and the wait is reported upward so a caller can queue
 * instead of hammering a limit that is already sore.
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { messageOf } from '@/lib/errors/user-safe'
import { ZERNIO_API_BASE } from './client'
import { assertZernioJson, ZernioError, ZernioNotConfiguredError } from './errors'

/** Upstream is a third party on someone else's network. Never hang the page. */
const TIMEOUT_MS = 9000

/** Zernio expires its pending OAuth data in ten minutes. Match it, do not exceed it. */
export const CONNECT_STATE_TTL_MS = 10 * 60 * 1000

/**
 * What the person clicking Connect is allowed to read.
 *
 * Named for the failure, not the vendor. "Zernio", "OAuth", "402" and "rate
 * limit" are words a business owner has never had to learn and must not start
 * here — the first rule in CLAUDE.md, applied to the one screen where a
 * subscriber meets our supplier's billing state.
 */
export const SUBSCRIBER_CONNECT_UNAVAILABLE =
  'Connecting accounts is temporarily unavailable across the whole site. Nothing has been changed, and the team has already been told.'

export const SUBSCRIBER_CONNECT_BUSY =
  'The account service is busy right now, so the connection was not started. Nothing has been changed. Try again shortly.'

export const SUBSCRIBER_CONNECT_UNREACHABLE =
  'Could not reach the service that connects your accounts. Nothing has been changed.'

/** Every platform `GET /v1/connect/{platform}` accepts, read off the SDK contract. */
export const CONNECTABLE_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'threads',
  'reddit',
  'pinterest',
  'bluesky',
  'googlebusiness',
  'telegram',
  'snapchat',
  'discord',
  'slack',
  'whatsapp',
] as const

export type ZernioConnectPlatform = (typeof CONNECTABLE_PLATFORMS)[number]

export function isConnectablePlatform(value: unknown): value is ZernioConnectPlatform {
  return typeof value === 'string'
    && (CONNECTABLE_PLATFORMS as readonly string[]).includes(value)
}

/**
 * Our supplier's bill, hitting every tenant at once.
 *
 * Kept as its own class so a route cannot accidentally render it to a
 * subscriber: `ownerMessage` deliberately says nothing about money.
 */
export class ZernioBillingSuspendedError extends ZernioError {
  readonly reason: string | null

  constructor(operation: string, detail: string, reason: string | null) {
    super(
      operation,
      `${operation}: PAYMENT_REQUIRED from the publisher — the NRS team account is suspended or over plan` +
        `${reason ? ` (${reason})` : ''}. Every tenant is affected. ${detail}`.trim(),
      { status: 402 },
    )
    this.name = 'ZernioBillingSuspendedError'
    this.reason = reason
  }

  override get ownerMessage(): string {
    return SUBSCRIBER_CONNECT_UNAVAILABLE
  }
}

/** The limit is per TEAM, so this is one tenant being slowed by another. */
export class ZernioRateLimitedError extends ZernioError {
  readonly retryAfterSeconds: number | null

  constructor(operation: string, retryAfterSeconds: number | null) {
    super(
      operation,
      `${operation}: rate limited by the publisher. The limit is shared across every tenant on this deployment.` +
        `${retryAfterSeconds === null ? '' : ` Retry after ${retryAfterSeconds}s.`}`,
      { status: 429 },
    )
    this.name = 'ZernioRateLimitedError'
    this.retryAfterSeconds = retryAfterSeconds
  }

  override get ownerMessage(): string {
    return SUBSCRIBER_CONNECT_BUSY
  }
}

/**
 * `Retry-After` is seconds OR an HTTP date, and both are common.
 *
 * Parsing only the integer form and defaulting the rest to "retry now" is how a
 * client turns a polite rate limit into a self-inflicted outage.
 */
export function retryAfterSeconds(header: string | null | undefined): number | null {
  const raw = (header ?? '').trim()
  if (raw === '') return null
  if (/^\d+$/.test(raw)) return Number(raw)
  const at = Date.parse(raw)
  if (Number.isNaN(at)) return null
  return Math.max(0, Math.ceil((at - Date.now()) / 1000))
}

interface ZernioRequestInit {
  method?: 'GET' | 'POST' | 'DELETE'
  query?: Record<string, string | undefined>
  body?: unknown
  headers?: Record<string, string>
}

/**
 * One raw call to the publisher, with the three failure modes read in the one
 * order that works.
 *
 * The SDK is not used for the connect surface on purpose: `unwrapZernio` folds
 * every non-2xx into a single `ZernioError`, which is exactly the distinction
 * that matters here — 402 pages an operator, 429 sets a retry clock, and a
 * wrong path is our bug. Losing all three to one class is how a billing
 * suspension gets reported to a subscriber as "could not connect".
 */
export async function zernioConnectRequest<T>(
  operation: string,
  path: string,
  init: ZernioRequestInit = {},
): Promise<T> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new ZernioNotConfiguredError(operation)

  const url = new URL(`${ZERNIO_API_BASE}${path}`)
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString(), {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  /*
   * CONTENT TYPE FIRST, and independently of the status.
   *
   * A wrong path under zernio.com/api/v1 answers 200 with the publisher's web
   * shell. Read the status first and a typo in a path below becomes "the
   * connection succeeded and returned nothing", which is indistinguishable from
   * "this account has no pages" on the screen the subscriber is looking at.
   *
   * So `isJson` gates the two status branches too: an HTML body carrying a 402
   * is a wrong path, not a billing suspension, and must not page an operator.
   */
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  const isJson = contentType.includes('application/json') || contentType.includes('+json')

  if (isJson && res.status === 402) {
    const payload = await res.json().catch(() => null) as
      | { error?: unknown; reason?: unknown }
      | null
    const reason = typeof payload?.reason === 'string' ? payload.reason : null
    const detail = typeof payload?.error === 'string' ? payload.error : ''
    throw new ZernioBillingSuspendedError(operation, detail, reason)
  }

  if (isJson && res.status === 429) {
    throw new ZernioRateLimitedError(operation, retryAfterSeconds(res.headers.get('retry-after')))
  }

  /*
   * 204 has no body and no content type, and cannot be produced by a wrong path
   * (that answers 200 with a page). It is the one status allowed past the guard.
   */
  if (res.status === 204) return undefined as T

  assertZernioJson(res, operation)
  return (await res.json()) as T
}

// ── The signed continuation ────────────────────────────────────────────

export interface ConnectStateClaims {
  /** Which of OUR brands started this. Zernio's own state cannot tell us. */
  brandId: string
  platform: ZernioConnectPlatform
  profileId: string
  /** Present only on the continuation the callback mints, never on the start state. */
  tempToken?: string
  userProfile?: Record<string, unknown>
  connectToken?: string
  pendingDataToken?: string
  /**
   * LinkedIn only. `/connect/pending-data` is ONE-TIME and ten minutes long, so
   * the organisations it returned are carried forward rather than re-fetched —
   * a second call would 404 and the person would see an empty list with no
   * explanation.
   */
  organizations?: Array<{ id: string; name: string; urn?: string; vanityName?: string }>
  nonce: string
  exp: number
}

/**
 * The claims minus the two that only exist to make a token a token.
 *
 * What a selection actually needs to be carried out. Kept separate so the
 * callback can assemble one and hand it straight to `listConnectChoices`
 * without minting and then re-reading a signature it already holds.
 */
export type ConnectSelectionContext = Omit<ConnectStateClaims, 'nonce' | 'exp'>

/**
 * The signing key, in preference order, with a reason for each.
 *
 * `ZERNIO_CONNECT_STATE_SECRET` if someone has set one. Otherwise the webhook
 * secret, which is already a Zernio-scoped secret on this deployment. Otherwise
 * the service-role key, which is present in every server environment this code
 * can run in — a state that cannot be signed is a connect flow that cannot
 * start, and failing the whole feature closed over an unset optional variable
 * would be a worse outcome than reusing a key that never leaves the server.
 *
 * It throws rather than falling back to a constant. An unsigned or
 * predictably-signed state is not a state.
 */
function stateSecret(operation: string): string {
  const secret = process.env.ZERNIO_CONNECT_STATE_SECRET
    || process.env.ZERNIO_WEBHOOK_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new ZernioError(
      operation,
      `${operation}: no secret available to sign the connect state. Set ZERNIO_CONNECT_STATE_SECRET.`,
    )
  }
  return secret
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

export function signConnectState(
  claims: Omit<ConnectStateClaims, 'nonce' | 'exp'> & { nonce?: string; exp?: number },
): string {
  const payload: ConnectStateClaims = {
    ...claims,
    nonce: claims.nonce ?? randomUUID(),
    exp: claims.exp ?? Date.now() + CONNECT_STATE_TTL_MS,
  }
  const encoded = base64url(JSON.stringify(payload))
  const signature = createHmac('sha256', stateSecret('zernio.connect.state'))
    .update(encoded)
    .digest('base64url')
  return `${encoded}.${signature}`
}

/**
 * Verify, then read. Never the other way round.
 *
 * Returns null for every kind of no — missing, malformed, tampered, expired —
 * because a caller that can tell those apart will eventually branch on it, and
 * the branch that says "expired, so let them through" is the one that gets
 * written at 2am.
 */
export function verifyConnectState(token: string | null | undefined): ConnectStateClaims | null {
  if (!token || typeof token !== 'string') return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null

  const encoded = token.slice(0, dot)
  const provided = token.slice(dot + 1)

  let expected: string
  try {
    expected = createHmac('sha256', stateSecret('zernio.connect.state'))
      .update(encoded)
      .digest('base64url')
  } catch {
    return null
  }

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let claims: ConnectStateClaims
  try {
    claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ConnectStateClaims
  } catch {
    return null
  }

  if (typeof claims.brandId !== 'string' || claims.brandId === '') return null
  if (!isConnectablePlatform(claims.platform)) return null
  if (typeof claims.profileId !== 'string' || claims.profileId === '') return null
  if (typeof claims.exp !== 'number' || Date.now() > claims.exp) return null

  return claims
}

// ── Step 1: hand the person to the platform ────────────────────────────

/**
 * `userProfile` arrives as URL-encoded JSON on the redirect.
 *
 * Next already decodes query values once, so a naive `JSON.parse` works about
 * half the time and fails on any profile whose display name contains a `%` or a
 * `+`. Decoding is therefore attempted and then fallen back from, rather than
 * assumed either way.
 */
export function parseUserProfile(raw: string | null | undefined): Record<string, unknown> | null {
  const value = (raw ?? '').trim()
  if (value === '') return null

  const attempts: string[] = [value]
  try {
    const decoded = decodeURIComponent(value)
    if (decoded !== value) attempts.unshift(decoded)
  } catch {
    // A malformed escape sequence is not fatal — the raw form may still parse.
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Try the next form.
    }
  }
  return null
}

export async function startHeadlessConnect(input: {
  platform: ZernioConnectPlatform
  profileId: string
  redirectUrl: string
  /** Instagram only: `facebook_login` routes through a Page and adds a selection step. */
  loginMethod?: 'instagram_login' | 'facebook_login'
}): Promise<{ authUrl: string; state?: string }> {
  const operation = `connect.getConnectUrl(${input.platform})`
  const data = await zernioConnectRequest<{ authUrl?: string; state?: string }>(
    operation,
    `/connect/${encodeURIComponent(input.platform)}`,
    {
      query: {
        headless: 'true',
        profileId: input.profileId,
        redirect_url: input.redirectUrl,
        ...(input.loginMethod ? { loginMethod: input.loginMethod } : {}),
      },
    },
  )

  if (typeof data?.authUrl !== 'string' || data.authUrl === '') {
    throw new ZernioError(operation, `${operation}: the publisher returned no authUrl.`)
  }
  return { authUrl: data.authUrl, ...(data.state ? { state: data.state } : {}) }
}

// ── Step 2: which selection, if any ────────────────────────────────────

export type SelectionKind = 'pages' | 'organizations' | 'boards' | 'locations' | 'profiles'

export interface SelectionPlan {
  kind: SelectionKind
  /** What our own UI should call these, in the owner's words. */
  label: string
  listPath: string
  selectPath: string
  /** Key on the list response carrying the array. Not uniform across platforms. */
  listField: string
}

/**
 * The five selection shapes, keyed by platform rather than by `step`.
 *
 * `step` tells us THAT a choice is needed; it does not reliably tell us which
 * endpoint serves it (Instagram's is `select_account` and lives under
 * `/connect/instagram/select-account`, Facebook's is `select_page`). Keying on
 * the platform means a new or renamed step value degrades to "no selection
 * plan" — a clear failure — instead of silently posting to the wrong endpoint.
 */
const SELECTION_PLANS: Partial<Record<ZernioConnectPlatform, SelectionPlan>> = {
  facebook: {
    kind: 'pages',
    label: 'Page',
    listPath: '/connect/facebook/select-page',
    selectPath: '/connect/facebook/select-page',
    listField: 'pages',
  },
  instagram: {
    kind: 'pages',
    label: 'Account',
    listPath: '/connect/instagram/select-account',
    selectPath: '/connect/instagram/select-account',
    listField: 'pages',
  },
  linkedin: {
    kind: 'organizations',
    label: 'Organisation',
    listPath: '/connect/linkedin/organizations',
    selectPath: '/connect/linkedin/select-organization',
    listField: 'organizations',
  },
  pinterest: {
    kind: 'boards',
    label: 'Board',
    listPath: '/connect/pinterest/select-board',
    selectPath: '/connect/pinterest/select-board',
    listField: 'boards',
  },
  snapchat: {
    kind: 'profiles',
    label: 'Public profile',
    listPath: '/connect/snapchat/select-profile',
    selectPath: '/connect/snapchat/select-profile',
    listField: 'publicProfiles',
  },
  googlebusiness: {
    kind: 'locations',
    label: 'Location',
    listPath: '/connect/googlebusiness/locations',
    selectPath: '/connect/googlebusiness/select-location',
    listField: 'locations',
  },
}

/** Every `step` value the headless redirect uses to mean "ask the person". */
const SELECTION_STEPS = new Set([
  'select_page',
  'select_account',
  'select_organization',
  'select_location',
  'select_board',
  'select_profile',
])

export function selectionPlanFor(platform: ZernioConnectPlatform): SelectionPlan | null {
  return SELECTION_PLANS[platform] ?? null
}

export function stepNeedsSelection(step: string | null | undefined): boolean {
  const value = (step ?? '').trim()
  return value !== '' && SELECTION_STEPS.has(value)
}

/** One thing our UI can draw a row for. Never carries a token. */
export interface ConnectChoice {
  id: string
  name: string
  /** Only ever descriptive — a handle, a category, an address. */
  detail?: string
  imageUrl?: string
  /** LinkedIn needs the URN back on select; Google Business needs its account. */
  urn?: string
  vanityName?: string
  accountId?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normaliseChoice(kind: SelectionKind, raw: unknown): ConnectChoice | null {
  const rec = asRecord(raw)
  const id = str(rec.id)
  if (id === '') return null

  if (kind === 'profiles') {
    const name = str(rec.display_name) || str(rec.username) || id
    return {
      id,
      name,
      ...(str(rec.username) ? { detail: `@${str(rec.username)}` } : {}),
      ...(str(rec.profile_image_url) ? { imageUrl: str(rec.profile_image_url) } : {}),
    }
  }

  if (kind === 'organizations') {
    return {
      id,
      name: str(rec.name) || str(rec.vanityName) || id,
      ...(str(rec.industry) ? { detail: str(rec.industry) } : {}),
      ...(str(rec.logoUrl) ? { imageUrl: str(rec.logoUrl) } : {}),
      ...(str(rec.urn) ? { urn: str(rec.urn) } : {}),
      ...(str(rec.vanityName) ? { vanityName: str(rec.vanityName) } : {}),
    }
  }

  if (kind === 'locations') {
    return {
      id,
      name: str(rec.name) || id,
      ...(str(rec.address) ? { detail: str(rec.address) } : {}),
      // The Google Business ACCOUNT that owns the location, not our account id.
      // Passing it back on select resolves the location directly instead of
      // enumerating an account that may own thousands.
      ...(str(rec.accountId) ? { accountId: str(rec.accountId) } : {}),
    }
  }

  if (kind === 'boards') {
    return {
      id,
      name: str(rec.name) || id,
      ...(str(rec.description) ? { detail: str(rec.description) } : {}),
    }
  }

  // pages — Facebook, and Instagram via a Facebook Page.
  const instagram = asRecord(rec.instagram_business_account)
  const igUsername = str(instagram.username)
  return {
    id,
    name: str(rec.name) || id,
    ...(igUsername
      ? { detail: `@${igUsername}` }
      : str(rec.username)
        ? { detail: `@${str(rec.username)}` }
        : str(rec.category)
          ? { detail: str(rec.category) }
          : {}),
    ...(str(instagram.profile_picture_url) ? { imageUrl: str(instagram.profile_picture_url) } : {}),
  }
}

/**
 * List what the person has to choose between.
 *
 * Note what is NOT returned: `access_token` is present on every Facebook and
 * Instagram page row and is deliberately dropped by `normaliseChoice` rather
 * than filtered by the caller. A Page access token is a credential for someone
 * else's business, and the only reliable way not to leak it into a JSON
 * response is for it never to be on the object.
 */
export async function listConnectChoices(claims: ConnectSelectionContext): Promise<{
  plan: SelectionPlan
  choices: ConnectChoice[]
  /** Google Business bounds its list; say so rather than implying it is complete. */
  hasMore: boolean
}> {
  const plan = selectionPlanFor(claims.platform)
  if (!plan) {
    throw new ZernioError(
      `connect.list(${claims.platform})`,
      `connect.list(${claims.platform}): this platform has no selection step.`,
    )
  }

  const operation = `connect.list(${claims.platform})`

  // LinkedIn's organisations came out of the one-time pending-data exchange.
  // Re-listing needs orgIds we no longer have, so the carried copy is the answer.
  if (claims.platform === 'linkedin') {
    const carried = claims.organizations ?? []
    if (carried.length > 0) {
      return {
        plan,
        choices: carried
          .map((org) => normaliseChoice('organizations', org))
          .filter((choice): choice is ConnectChoice => choice !== null),
        hasMore: false,
      }
    }
  }

  const query: Record<string, string | undefined> = { profileId: claims.profileId }
  const headers: Record<string, string> = {}

  if (claims.platform === 'googlebusiness') {
    // pendingDataToken keeps the tokens server-side at Zernio and is preferred
    // over tempToken wherever both are offered.
    if (claims.pendingDataToken) query.pendingDataToken = claims.pendingDataToken
    else query.tempToken = claims.tempToken
  } else {
    query.tempToken = claims.tempToken
  }

  if (claims.connectToken) headers['X-Connect-Token'] = claims.connectToken

  const data = await zernioConnectRequest<Record<string, unknown>>(operation, plan.listPath, {
    query,
    headers,
  })

  const rows = Array.isArray(data?.[plan.listField]) ? (data[plan.listField] as unknown[]) : []
  return {
    plan,
    choices: rows
      .map((row) => normaliseChoice(plan.kind, row))
      .filter((choice): choice is ConnectChoice => choice !== null),
    hasMore: data?.hasMore === true,
  }
}

/**
 * Exchange a `pendingDataToken` for the OAuth data Zernio is holding.
 *
 * ONE-TIME USE, ten minutes. Calling it twice returns nothing the second time,
 * so the result is folded into the signed continuation immediately rather than
 * re-fetched per screen — a second call would render an empty organisation list
 * with no explanation for why the first one worked.
 *
 * No Authorization is required by this endpoint (the token IS the credential),
 * but sending ours costs nothing and keeps one code path.
 */
export async function fetchPendingOAuthData(token: string): Promise<{
  platform: string
  profileId: string
  tempToken: string
  userProfile: Record<string, unknown> | null
  organizations: Array<{ id: string; name: string; urn?: string; vanityName?: string }>
}> {
  const operation = 'connect.getPendingOAuthData'
  const data = await zernioConnectRequest<Record<string, unknown>>(
    operation,
    '/connect/pending-data',
    { query: { token } },
  )

  const organizations = (Array.isArray(data?.organizations) ? data.organizations : [])
    .map((raw) => {
      const rec = asRecord(raw)
      const id = str(rec.id)
      if (id === '') return null
      return {
        id,
        name: str(rec.name) || str(rec.vanityName) || id,
        ...(str(rec.urn) ? { urn: str(rec.urn) } : {}),
        ...(str(rec.vanityName) ? { vanityName: str(rec.vanityName) } : {}),
      }
    })
    .filter((org): org is { id: string; name: string; urn?: string; vanityName?: string } => org !== null)

  const userProfile = data?.userProfile && typeof data.userProfile === 'object'
    ? (data.userProfile as Record<string, unknown>)
    : null

  return {
    platform: str(data?.platform),
    profileId: str(data?.profileId),
    tempToken: str(data?.tempToken),
    userProfile,
    organizations,
  }
}

/** What a finished connection is, in our words. */
export interface ConnectedAccount {
  accountId: string
  platform: string
  username: string | null
  displayName: string | null
}

function readConnectedAccount(operation: string, payload: unknown): ConnectedAccount {
  const account = asRecord(asRecord(payload).account)
  // Zernio returns `accountId` here and `_id` on /v1/accounts. Both are read
  // because the two surfaces have disagreed before and a publish path must not
  // depend on which one answered.
  const accountId = str(account.accountId) || str(account.id) || str(account._id)
  if (accountId === '') {
    throw new ZernioError(operation, `${operation}: the publisher created no account id.`)
  }
  return {
    accountId,
    platform: str(account.platform),
    username: str(account.username) || null,
    displayName: str(account.displayName) || null,
  }
}

/**
 * Post the person's choice back and let Zernio mint the account.
 *
 * Each platform wants the chosen thing under a different key, and two of them
 * want the whole object rather than an id. That is per-platform detail, so it
 * lives here once instead of in a route that would have to grow a switch.
 */
export async function submitConnectChoice(input: {
  claims: ConnectSelectionContext
  choice: ConnectChoice
  /** LinkedIn only: a person may connect their own profile instead of a company. */
  accountType?: 'personal' | 'organization'
}): Promise<ConnectedAccount> {
  const { claims, choice } = input
  const plan = selectionPlanFor(claims.platform)
  if (!plan) {
    throw new ZernioError(
      `connect.select(${claims.platform})`,
      `connect.select(${claims.platform}): this platform has no selection step.`,
    )
  }

  const operation = `connect.select(${claims.platform})`
  const headers: Record<string, string> = claims.connectToken
    ? { 'X-Connect-Token': claims.connectToken }
    : {}

  let body: Record<string, unknown>

  switch (claims.platform) {
    case 'facebook':
      body = {
        profileId: claims.profileId,
        pageId: choice.id,
        tempToken: claims.tempToken,
        userProfile: claims.userProfile ?? {},
      }
      break

    case 'instagram':
      body = {
        profileId: claims.profileId,
        pageId: choice.id,
        tempToken: claims.tempToken,
      }
      break

    case 'linkedin':
      body = {
        profileId: claims.profileId,
        tempToken: claims.tempToken,
        userProfile: claims.userProfile ?? {},
        accountType: input.accountType ?? 'organization',
        ...(input.accountType === 'personal'
          ? {}
          : {
              selectedOrganization: {
                id: choice.id,
                // The URN is required and is NOT derivable from the id with any
                // confidence, so it is carried through from the listing rather
                // than rebuilt. A guessed URN connects the wrong company.
                urn: choice.urn ?? `urn:li:organization:${choice.id}`,
                name: choice.name,
                ...(choice.vanityName ? { vanityName: choice.vanityName } : {}),
              },
            }),
      }
      break

    case 'pinterest':
      body = {
        profileId: claims.profileId,
        boardId: choice.id,
        boardName: choice.name,
        tempToken: claims.tempToken,
        userProfile: claims.userProfile ?? {},
      }
      break

    case 'snapchat':
      body = {
        profileId: claims.profileId,
        selectedPublicProfile: {
          id: choice.id,
          display_name: choice.name,
        },
        tempToken: claims.tempToken,
        userProfile: claims.userProfile ?? {},
      }
      break

    case 'googlebusiness':
      body = {
        profileId: claims.profileId,
        locationId: choice.id,
        ...(choice.accountId ? { accountId: choice.accountId } : {}),
        pendingDataToken: claims.pendingDataToken,
      }
      break

    default:
      throw new ZernioError(operation, `${operation}: no selection body is defined for this platform.`)
  }

  const payload = await zernioConnectRequest<Record<string, unknown>>(operation, plan.selectPath, {
    method: 'POST',
    body,
    headers,
  })

  return readConnectedAccount(operation, payload)
}

/**
 * Take the account off the publisher.
 *
 * A 404 is success. The only thing this call promises the owner is that the
 * account is gone, and an account that was never there satisfies that; treating
 * it as a failure leaves a row we can never tidy up because every retry fails
 * the same way.
 */
export async function deleteZernioAccount(accountId: string): Promise<{ alreadyGone: boolean }> {
  const operation = 'accounts.deleteAccount'
  try {
    await zernioConnectRequest<unknown>(
      operation,
      `/accounts/${encodeURIComponent(accountId)}`,
      { method: 'DELETE' },
    )
    return { alreadyGone: false }
  } catch (err) {
    if (err instanceof ZernioError && err.status === 404) {
      console.error(`[zernio] ${operation}: ${accountId} was already gone upstream`)
      return { alreadyGone: true }
    }
    throw err
  }
}

// ── The tenant map. Isolation is ours, never Zernio's. ─────────────────

/**
 * Write the accountId → brand mapping.
 *
 * This row, not Zernio, is what decides whose account this is.
 * `listAccounts({ profileId })` accepts the filter and ignores it — measured on
 * 2026-08-17, pinned by `account-scoping.test.ts` — so a Zernio profile is an
 * organisational boundary and never a security one.
 *
 * Upsert on (account_id, brand_id) and clear `disconnected_at`, so reconnecting
 * an account someone removed last month revives the original row rather than
 * colliding with it.
 */
export async function recordZernioAccountMapping(
  supabase: SupabaseClient,
  input: {
    accountId: string
    brandId: string
    profileId: string
    platform: string
    username?: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('zernio_account_map')
    .upsert(
      {
        account_id: input.accountId,
        brand_id: input.brandId,
        profile_id: input.profileId,
        platform: input.platform,
        username: input.username ?? null,
        disconnected_at: null,
      },
      { onConflict: 'account_id,brand_id' },
    )

  if (error) {
    throw new ZernioError(
      'zernio.map.record',
      `zernio.map.record: could not save the account mapping — ${messageOf(error)}`,
    )
  }
}

/**
 * Mark, do not delete.
 *
 * The row is the only record that this account was ever this brand's. Deleting
 * it orphans every `publisher_runs` row that names the account, and the webhook
 * handler drops any inbox event whose accountId resolves to nothing — so a
 * comment arriving on a post published last week would vanish with no trace of
 * why. `disconnected_at` keeps the history and still reads as "not live" to
 * every query that filters on it.
 */
export async function markZernioAccountDisconnected(
  supabase: SupabaseClient,
  input: { brandId: string; accountId: string },
): Promise<void> {
  const { error } = await supabase
    .from('zernio_account_map')
    .update({ disconnected_at: new Date().toISOString() })
    .eq('brand_id', input.brandId)
    .eq('account_id', input.accountId)

  if (error) {
    throw new ZernioError(
      'zernio.map.disconnect',
      `zernio.map.disconnect: could not mark the account disconnected — ${messageOf(error)}`,
    )
  }
}

/**
 * Which of this brand's accounts on one platform are already written down.
 *
 * Used by the callback when the redirect names no accountId and the accounts
 * have to be read back. Without it, re-connecting Instagram would re-upsert
 * every Facebook row too and REVIVE one the owner had disconnected last month —
 * `disconnected_at: null` is part of the upsert, so a blanket re-map silently
 * undoes a deliberate removal.
 *
 * Rows are returned regardless of `disconnected_at`, because a disconnected row
 * is exactly the one that must not be touched by a blanket write.
 */
export async function mappedAccountIdsFor(
  supabase: SupabaseClient,
  input: { brandId: string; platform: string },
): Promise<Set<string>> {
  const { data } = await supabase
    .from('zernio_account_map')
    .select('account_id')
    .eq('brand_id', input.brandId)
    .eq('platform', input.platform)

  return new Set((data ?? []).map((row) => String(row.account_id)))
}

/**
 * Is this account this brand's, according to US?
 *
 * Every route that acts on an accountId asks this first. Zernio validates an
 * account id against the whole TEAM, so upstream will happily delete another
 * customer's Facebook Page on a request that names it — the check has to be
 * ours and it has to be before the call, not after.
 */
export async function liveMappingFor(
  supabase: SupabaseClient,
  input: { brandId: string; accountId: string },
): Promise<{ platform: string; profileId: string } | null> {
  const { data, error } = await supabase
    .from('zernio_account_map')
    .select('platform, profile_id, disconnected_at')
    .eq('brand_id', input.brandId)
    .eq('account_id', input.accountId)
    .maybeSingle()

  if (error || !data) return null
  if (data.disconnected_at !== null) return null
  return { platform: String(data.platform ?? ''), profileId: String(data.profile_id ?? '') }
}

// ── Route plumbing: cookies, and one translation of upstream failure ───

/**
 * One path for both cookies, covering `/start`, `/callback` and `/select`.
 *
 * The path MUST be repeated when deleting. A bare `delete(name)` expires a
 * cookie at path '/', which is a DIFFERENT cookie from one set here — the old
 * handshake survived its own use that way and stayed replayable for its full
 * ten minutes.
 */
export const CONNECT_COOKIE_PATH = '/api/zernio/connect'
export const CONNECT_COOKIE_TTL_SECONDS = CONNECT_STATE_TTL_MS / 1000

/** Minted by `/start`, spent by `/callback`: proves the same browser came back. */
export const START_COOKIE = 'zernio_connect_start'

/** Minted by `/callback`, spent by `/select`: holds the tokens, httpOnly. */
export const SELECTION_COOKIE = 'zernio_connect_selection'

/**
 * One options object, so the two cookies cannot drift apart.
 *
 * `sameSite: 'lax'` is required rather than incidental: the browser arrives back
 * at the callback by a top-level redirect from zernio.com, and 'strict' would
 * withhold the cookie there and break every connection.
 *
 * `secure` is off outside production ONLY because a secure cookie is silently
 * dropped over plain http, so `npm run dev` on localhost would set nothing and
 * every connection would fail with "it was not started here" — an error that
 * describes a security check rather than the missing TLS that actually caused
 * it. In production it is always on.
 */
export function connectCookieOptions(): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: CONNECT_COOKIE_PATH,
    maxAge: CONNECT_COOKIE_TTL_SECONDS,
  }
}

/**
 * Turn an upstream failure into a status, a sentence, and an operator page.
 *
 * The reason this is one function rather than a catch block per route: the 402
 * branch has a side effect that must not be forgotten. Our team account being
 * suspended stops every tenant at the same instant, and the only person who can
 * fix it is the operator — so it emails them (on a cooldown) and returns a
 * sentence that says nothing about money to the subscriber who happened to be
 * the one clicking Connect at the time.
 *
 * 429 is relayed as 503 with `Retry-After`, not as 429. Passing the upstream
 * status through would tell the browser that IT was rate limited and invite a
 * client-side retry loop against a limit that is shared across every tenant.
 */
export function zernioConnectFailure(
  scope: string,
  err: unknown,
): { status: number; body: { error: string; retryAfterSeconds?: number }; headers?: Record<string, string> } {
  console.error(`[${scope}] ${messageOf(err)}`)

  if (err instanceof ZernioBillingSuspendedError) {
    void alertOperatorBillingSuspended(scope)
    return { status: 503, body: { error: err.ownerMessage } }
  }

  if (err instanceof ZernioRateLimitedError) {
    const wait = err.retryAfterSeconds
    return {
      status: 503,
      body: { error: err.ownerMessage, ...(wait === null ? {} : { retryAfterSeconds: wait }) },
      ...(wait === null ? {} : { headers: { 'Retry-After': String(wait) } }),
    }
  }

  if (err instanceof ZernioNotConfiguredError) {
    return { status: 503, body: { error: err.ownerMessage } }
  }

  if (err instanceof ZernioError) {
    return { status: 502, body: { error: SUBSCRIBER_CONNECT_UNREACHABLE } }
  }

  return {
    status: 500,
    body: {
      error: 'That could not be done just now. Nothing has been changed. Try again in a moment.',
    },
  }
}

/**
 * Imported lazily so a page render that merely touches this module does not
 * pull in Resend and the service-role client. It also keeps the failure path
 * free of a hard dependency: if the alert itself throws, the subscriber still
 * gets their sentence.
 */
async function alertOperatorBillingSuspended(scope: string): Promise<void> {
  try {
    const { emailJustinBillingPaused } = await import('@/lib/publishers/billing-pause')
    await emailJustinBillingPaused()
  } catch (err) {
    console.error(`[${scope}] could not raise the billing alert: ${messageOf(err)}`)
  }
}
