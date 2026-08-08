import type { SupabaseClient } from '@supabase/supabase-js'

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

/**
 * Get a valid Canva access token, refreshing it if expired.
 *
 * There is deliberately NO fallback to CANVA_API_KEY. Canva Connect is OAuth
 * only — it issues no static API keys — and the value in the environment
 * returns 401 for every request. Handing it out meant every caller believed it
 * had a token, so "never connected" was reported as "connected but failing",
 * which is a far harder thing for anyone to act on. Null means not connected,
 * and callers must say so rather than try anyway.
 */
export async function getCanvaToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', userId)
    .eq('provider', 'canva')
    .single()

  if (!integration?.cached_data) return null

  const cachedData = integration.cached_data as Record<string, unknown>
  let token = cachedData.api_key as string | undefined
  const refreshToken = cachedData.refresh_token as string | undefined
  const expiresAt = cachedData.expires_at as string | undefined

  // Check if token is expired or expiring within 60 seconds
  if (expiresAt && refreshToken) {
    const expiryTime = new Date(expiresAt).getTime()
    const now = Date.now()
    if (now > expiryTime - 60_000) {
      const newToken = await refreshCanvaToken(supabase, userId, refreshToken)
      if (newToken) token = newToken
    }
  }

  return token ?? null
}

/**
 * Refresh a Canva OAuth token using the refresh_token.
 * Uses Basic auth (client_id:client_secret) as required by the Canva API.
 * Updates the user_integrations record with the new token.
 */
export async function refreshCanvaToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch(`${CANVA_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) {
      console.error('[canva] Token refresh failed:', res.status, await res.text().catch(() => ''))
      return null
    }

    const data = await res.json()
    const { access_token, refresh_token: newRefreshToken, expires_in } = data
    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

    // Update stored tokens
    await supabase
      .from('user_integrations')
      .update({
        cached_data: {
          api_key: access_token,
          refresh_token: newRefreshToken ?? refreshToken,
          expires_at: expiresAt,
          token_type: 'oauth',
        },
      })
      .eq('user_id', userId)
      .eq('provider', 'canva')

    console.log('[canva] Token refreshed successfully')
    return access_token
  } catch (err) {
    console.error('[canva] Token refresh error:', err)
    return null
  }
}

/**
 * Make an authenticated request to the Canva REST API.
 * Throws on non-OK responses with a descriptive error message.
 */
export async function canvaFetch(
  token: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  const res = await fetch(`${CANVA_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Canva API error (${res.status}): ${err.message || err.code || 'Unknown error'}`
    )
  }

  return res
}

/**
 * Check if a Canva token is available.
 */
export function isCanvaConfigured(token: string | null): boolean {
  return token !== null
}
