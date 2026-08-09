/**
 * Whether Canva is actually connected — asked plainly, answered plainly.
 *
 * `getCanvaToken` falls back to `process.env.CANVA_API_KEY` when no OAuth
 * token is stored. That fallback can NEVER work: Canva Connect is OAuth only,
 * it has no static API keys, and the value in the environment returns 401 for
 * every request. Verified against api.canva.com.
 *
 * So every Canva tool got a token, tried it, and failed with an opaque API
 * error — which the Director then reported as though Canva were connected but
 * misbehaving. The owner was told "the Canva connection is failing on my side"
 * with no way to know that nothing had ever been connected at all.
 *
 * The distinction that matters to a person is: is this MY setup, or is it
 * broken? Those need different words and different next steps.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshCanvaToken } from './client'

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

export type CanvaState =
  /** No OAuth token has ever been stored. Nothing is wrong; it is not set up. */
  | { state: 'not_connected'; message: string }
  /** A token exists but Canva rejected it — reconnect. */
  | { state: 'expired'; message: string }
  /** Connected and usable. */
  | { state: 'ready'; token: string }
  /** Canva itself is unreachable or erroring. */
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

/**
 * Read the stored OAuth token, and say what state Canva is in.
 *
 * A stored token is only a cache entry, not proof that Canva still accepts it.
 * Every caller goes through this live probe before it is allowed to claim a
 * connection is ready. If Canva rejects a token, refresh it once and probe the
 * refreshed token before asking the owner to reconnect.
 */
export async function getCanvaState(
  supabase: SupabaseClient,
  userId: string,
): Promise<CanvaState> {
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', userId)
    .eq('provider', 'canva')
    .maybeSingle()

  const cached = (integration?.cached_data ?? null) as Record<string, unknown> | null
  const token = typeof cached?.api_key === 'string' ? cached.api_key : null

  if (!token) return { state: 'not_connected', message: CONNECT_HINT }

  const expiresAt = typeof cached?.expires_at === 'string' ? cached.expires_at : null
  const refreshToken = typeof cached?.refresh_token === 'string' ? cached.refresh_token : null

  let usableToken = token
  let refreshed = false
  const expiresSoon = expiresAt
    ? new Date(expiresAt).getTime() < Date.now() + 60_000
    : false

  // Expired with nothing to refresh from cannot become usable. Do this before
  // a network request so the user gets the one action that will help.
  if (expiresSoon && !refreshToken) {
    return { state: 'expired', message: RECONNECT_HINT }
  }

  if (expiresSoon && refreshToken) {
    const newToken = await refreshCanvaToken(supabase, userId, refreshToken)
    if (!newToken) return { state: 'expired', message: RECONNECT_HINT }
    usableToken = newToken
    refreshed = true
  }

  const probe = (accessToken: string) =>
    fetch(`${CANVA_API_BASE}/brand-templates?limit=1`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

  try {
    let response = await probe(usableToken)

    if (response.ok) return { state: 'ready', token: usableToken }

    // OAuth tokens can be revoked before their advertised expiry. Treat a
    // rejected cached token exactly like an elapsed one: refresh once, then
    // only say reconnect when the refreshed credential is also rejected.
    if ((response.status === 401 || response.status === 403) && refreshToken && !refreshed) {
      const newToken = await refreshCanvaToken(supabase, userId, refreshToken)
      if (newToken) {
        response = await probe(newToken)
        if (response.ok) return { state: 'ready', token: newToken }
      }
    }

    return describeCanvaFailure(response.status)
  } catch {
    return describeCanvaFailure(503)
  }
}

/**
 * Turn a Canva HTTP failure into something worth reading.
 *
 * A 401 here means the stored token stopped working — that is a reconnect,
 * not a fault the owner can fix by trying again.
 */
export function describeCanvaFailure(status: number): CanvaFailureState {
  if (status === 401 || status === 403) {
    return { state: 'expired', message: RECONNECT_HINT }
  }
  return {
    state: 'unavailable',
    message:
      'Canva did not respond just now, so I could not read your templates. ' +
      'Try again shortly. Do NOT claim to have seen a template.',
  }
}
