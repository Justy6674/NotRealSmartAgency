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

export type CanvaState =
  /** No OAuth token has ever been stored. Nothing is wrong; it is not set up. */
  | { state: 'not_connected'; message: string }
  /** A token exists but Canva rejected it — reconnect. */
  | { state: 'expired'; message: string }
  /** Connected and usable. */
  | { state: 'ready'; token: string }
  /** Canva itself is unreachable or erroring. */
  | { state: 'unavailable'; message: string }

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
 * Deliberately does NOT fall back to the environment key. A credential that
 * cannot work is worse than none: it turns "not set up" into "mysteriously
 * broken", which is the harder problem to act on.
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

  // Expired with nothing to refresh from is the same as disconnected, and
  // saying "expired" without a refresh path just leaves someone waiting.
  if (expiresAt && new Date(expiresAt).getTime() < Date.now() && !refreshToken) {
    return { state: 'expired', message: RECONNECT_HINT }
  }

  return { state: 'ready', token }
}

/**
 * Turn a Canva HTTP failure into something worth reading.
 *
 * A 401 here means the stored token stopped working — that is a reconnect,
 * not a fault the owner can fix by trying again.
 */
export function describeCanvaFailure(status: number): CanvaState {
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
