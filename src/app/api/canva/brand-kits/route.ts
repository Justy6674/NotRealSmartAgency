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

  // Fall back to platform-wide key
  if (!apiKey) {
    apiKey = process.env.CANVA_API_KEY ?? null
  }

  if (!apiKey) {
    return NextResponse.json({ brand_kits: [], configured: false })
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

  // Fetch brand kits
  const fetchBrandKits = async (token: string) => {
    const res = await fetch(`${CANVA_BASE_URL}/brand-kits`, {
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
      return NextResponse.json(
        {
          configured: true,
          brand_kits: [],
          error:
            res.status === 401
              ? 'Canva session expired — visit /api/canva/auth to reconnect'
              : res.status === 403
                ? 'Brand kits not available — OAuth scope may not include brand_kit:read'
                : `Canva API error: ${res.status}`,
        },
        {
          headers: { 'Cache-Control': 'private, max-age=300' }, // 5 min on error
        },
      )
    }

    const data = await res.json()
    const items = data.items ?? data.brand_kits ?? []

    const brandKits = items.map((kit: Record<string, unknown>) => ({
      id: kit.id,
      name: (kit.name as string) ?? 'Untitled Brand Kit',
      is_default: kit.is_default ?? false,
    }))

    return NextResponse.json(
      { configured: true, brand_kits: brandKits },
      {
        headers: { 'Cache-Control': 'private, max-age=3600' }, // 1 hour cache
      },
    )
  } catch (err) {
    console.error('[canva/brand-kits] Error:', err)
    return NextResponse.json({
      configured: true,
      brand_kits: [],
      error: 'Failed to fetch Canva brand kits',
    })
  }
}
