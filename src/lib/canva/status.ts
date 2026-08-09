import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCanvaIntegration,
  recordCanvaHealth,
  refreshCanvaToken,
  type CanvaHealthState,
} from './client'

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

export type CanvaState =
  | { state: 'not_connected'; message: string }
  | { state: 'expired'; message: string }
  | { state: 'ready'; token: string }
  | { state: 'unavailable'; message: string }

export type CanvaFailureState = Exclude<CanvaState, { state: 'ready'; token: string }>

const CONNECT_HINT =
  'Canva is not connected to NRS yet, so I cannot see your brand templates. ' +
  'Connect it once in NRS Settings → Integrations → Canva, then ask me again. ' +
  'Do NOT claim to have looked at a Canva template or brand kit — say this plainly instead.'

const RECONNECT_HINT =
  'The Canva connection has expired, so I cannot see your brand templates right now. ' +
  'Reconnect it in NRS Settings → Integrations → Canva. ' +
  'Do NOT claim to have looked at a Canva template — say this plainly instead.'

function cachedString(cached: Record<string, unknown>, key: string): string | null {
  const value = cached[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

async function recordFailure(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string | null,
  state: Exclude<CanvaHealthState, 'ready'>,
  errorCode: string,
): Promise<CanvaFailureState> {
  await recordCanvaHealth(supabase, userId, integrationId, state, errorCode)
  return state === 'not_connected'
    ? { state, message: CONNECT_HINT }
    : state === 'expired'
      ? { state, message: RECONNECT_HINT }
      : {
          state,
          message:
            'Canva did not respond just now, so I could not read your templates. ' +
            'Try again shortly. Do NOT claim to have seen a template.',
        }
}

/**
 * Verify Canva live before any caller says it is connected. A stored token is
 * merely a cache entry. Refresh is leased in client.ts, so simultaneous page
 * loads cannot rotate the same OAuth credential twice.
 */
export async function getCanvaState(supabase: SupabaseClient, userId: string): Promise<CanvaState> {
  const integration = await getCanvaIntegration(supabase, userId)
  if (!integration) return recordFailure(supabase, userId, null, 'not_connected', 'integration_missing')

  const token = cachedString(integration.cachedData, 'api_key')
  const refreshToken = cachedString(integration.cachedData, 'refresh_token')
  const expiresAt = cachedString(integration.cachedData, 'expires_at')
  const expiresSoon = expiresAt ? new Date(expiresAt).getTime() < Date.now() + 60_000 : false

  if (!token) return recordFailure(supabase, userId, integration.id, 'not_connected', 'access_token_missing')
  if (expiresSoon && !refreshToken) return recordFailure(supabase, userId, integration.id, 'expired', 'refresh_token_missing')

  let usableToken = token
  let refreshed = false
  if (expiresSoon) {
    const refreshedToken = await refreshCanvaToken(supabase, userId)
    if (!refreshedToken) return recordFailure(supabase, userId, integration.id, 'expired', 'refresh_failed')
    usableToken = refreshedToken
    refreshed = true
  }

  const probe = (accessToken: string) => fetch(`${CANVA_API_BASE}/brand-templates?limit=1`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  })

  try {
    let response = await probe(usableToken)
    if (response.ok) {
      await recordCanvaHealth(supabase, userId, integration.id, 'ready')
      return { state: 'ready', token: usableToken }
    }

    // A provider can revoke a token before the advertised expiry. One leased
    // refresh/re-probe is safe; a second is a loop and would hide a real revoke.
    if ((response.status === 401 || response.status === 403) && refreshToken && !refreshed) {
      const refreshedToken = await refreshCanvaToken(supabase, userId)
      if (refreshedToken) {
        response = await probe(refreshedToken)
        if (response.ok) {
          await recordCanvaHealth(supabase, userId, integration.id, 'ready')
          return { state: 'ready', token: refreshedToken }
        }
      }
    }

    return describeCanvaFailure(response.status, supabase, userId, integration.id)
  } catch {
    return recordFailure(supabase, userId, integration.id, 'unavailable', 'probe_transport_error')
  }
}

/** Backwards-compatible pure form for call sites/tests without a database client. */
export function describeCanvaFailure(status: number): CanvaFailureState
export function describeCanvaFailure(
  status: number,
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
): Promise<CanvaFailureState>
export function describeCanvaFailure(
  status: number,
  supabase?: SupabaseClient,
  userId?: string,
  integrationId?: string,
): CanvaFailureState | Promise<CanvaFailureState> {
  const state: Exclude<CanvaHealthState, 'ready'> = status === 401 || status === 403 ? 'expired' : 'unavailable'
  const code = state === 'expired' ? `probe_http_${status}` : `probe_http_${status || 503}`
  if (supabase && userId && integrationId) return recordFailure(supabase, userId, integrationId, state, code)
  if (state === 'expired') return { state, message: RECONNECT_HINT }
  return {
    state,
    message:
      'Canva did not respond just now, so I could not read your templates. ' +
      'Try again shortly. Do NOT claim to have seen a template.',
  }
}
