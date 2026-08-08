import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CANVA_BASE_URL = 'https://api.canva.com/rest/v1'

/**
 * Refresh an expired Canva OAuth token using the refresh_token.
 * Returns the new access token, or null if refresh fails.
 */
async function refreshCanvaToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  refreshToken: string,
): Promise<string | null> {
  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch('https://api.canva.com/rest/v1/oauth/token', {
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
 * GET /api/canva/brand-kits
 *
 * Fetches Canva brand kits for the authenticated user.
 * Auto-refreshes expired OAuth tokens. Cached for 1 hour via Cache-Control.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Get Canva token from user_integrations
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', user.id)
    .eq('provider', 'canva')
    .single()

  let apiKey: string | null = (integration?.cached_data?.api_key as string) ?? null
  const refreshToken = (integration?.cached_data?.refresh_token as string) ?? null
  const expiresAt = (integration?.cached_data?.expires_at as string) ?? null

  // NO fallback to CANVA_API_KEY. Canva Connect is OAuth only — it issues no
  // static API keys, and the value in the environment returns 401 for every
  // request. Handing it out turned "never connected" into "connected but
  // failing", which is a far harder thing for anyone to act on.
  if (!apiKey) {
    return NextResponse.json({
      connected: false,
      state: 'not_connected',
      brand_kits: [],
      message: 'Canva is not connected. Connect it to use your brand templates.',
    })
  }

  // Check if token is expired and refresh proactively
  if (expiresAt && refreshToken) {
    const isExpired = new Date(expiresAt).getTime() < Date.now() + 60000 // 1 min buffer
    if (isExpired) {
      const newToken = await refreshCanvaToken(supabase, user.id, refreshToken)
      if (newToken) {
        apiKey = newToken
      }
    }
  }

  /**
   * `/brand-kits` DOES NOT EXIST in the Canva Connect API.
   *
   * The real endpoint is `/v1/brand-templates`, guarded by the
   * `brandtemplate:meta:read` scope — which NRS already requests at consent.
   * So every call here hit a URL Canva has never had, failed, and was reported
   * as the connection misbehaving. That is why designs worked and "brand kits"
   * never did.
   */
  const fetchBrandKits = async (token: string) => {
    const res = await fetch(`${CANVA_BASE_URL}/brand-templates?limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return res
  }

  try {
    let res = await fetchBrandKits(apiKey)

    // If 401, try refreshing the token once
    if (res.status === 401 && refreshToken) {
      const newToken = await refreshCanvaToken(supabase, user.id, refreshToken)
      if (newToken) {
        apiKey = newToken
        res = await fetchBrandKits(newToken)
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[canva/brand-kits] API error:', res.status, err)
      // `connected: false` is the field the UI reads. This used to answer 200
      // with an `error` in the body and nothing else, and the panel — which
      // only checked whether the REQUEST succeeded — rendered a dead
      // connection as "Connected — 0 brand kits".
      return NextResponse.json(
        {
          connected: false,
          state: res.status === 401 ? 'expired' : res.status === 403 ? 'missing_scope' : 'unavailable',
          brand_kits: [],
          message:
            res.status === 401
              ? 'Canva sign-in has expired. Reconnect to use your brand templates.'
              : res.status === 403
                ? 'Connected, but NRS was not granted permission to read brand kits. Reconnect and allow brand kit access.'
                : 'Canva did not respond just now. Try again shortly.',
        },
        { headers: { 'Cache-Control': 'private, max-age=60' } },
      )
    }

    const data = await res.json()
    const items = data.items ?? data.brand_kits ?? []

    const brandKits = items.map((kit: Record<string, unknown>) => ({
      id: kit.id,
      // Brand templates carry `title`, not `name`.
      name: (kit.title as string) ?? (kit.name as string) ?? 'Untitled template',
      is_default: kit.is_default ?? false,
    }))

    return NextResponse.json(
      { connected: true, state: 'ready', brand_kits: brandKits },
      {
        headers: { 'Cache-Control': 'private, max-age=3600' }, // 1 hour cache
      },
    )
  } catch (err) {
    console.error('[canva/brand-kits] Error:', err)
    return NextResponse.json({
      connected: false,
      state: 'unavailable',
      brand_kits: [],
      message: 'Canva could not be reached just now. Try again shortly.',
    })
  }
}
