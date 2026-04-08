import { NextRequest, NextResponse } from 'next/server'
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
 * GET /api/canva/designs?brandId=xxx
 *
 * Fetches recent Canva designs. Auto-refreshes expired OAuth tokens.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const brandId = req.nextUrl.searchParams.get('brandId')
  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }
  const showAll = req.nextUrl.searchParams.get('showAll') === 'true'

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
    return NextResponse.json({ configured: false, designs: [] })
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

  // Read pagination / search params
  const query = req.nextUrl.searchParams.get('query') ?? undefined
  const continuation = req.nextUrl.searchParams.get('continuation') ?? undefined
  const sortBy = req.nextUrl.searchParams.get('sort_by') ?? 'modified_descending'

  // Fetch designs with pagination support
  const fetchDesigns = async (token: string) => {
    const params = new URLSearchParams({
      ownership: 'owned',
      sort_by: sortBy,
    })
    if (query) params.set('query', query)
    if (continuation) params.set('continuation', continuation)

    const res = await fetch(`${CANVA_BASE_URL}/designs?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return res
  }

  try {
    let res = await fetchDesigns(apiKey)

    // If 401, try refreshing the token once
    if (res.status === 401 && refreshToken) {
      const newToken = await refreshCanvaToken(supabase, user.id, refreshToken)
      if (newToken) {
        apiKey = newToken
        res = await fetchDesigns(newToken)
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[canva/designs] API error:', res.status, err)
      return NextResponse.json({
        configured: true,
        designs: [],
        error: res.status === 401 ? 'Canva session expired — visit /api/canva/auth to reconnect' : `Canva API error: ${res.status}`,
      })
    }

    const data = await res.json()
    const items = data.items ?? data.designs ?? []
    const nextContinuation: string | undefined = data.continuation ?? undefined

    const designs = items.map((d: Record<string, unknown>) => ({
      id: d.id,
      title: (d.title as string) ?? 'Untitled',
      thumbnail_url: (d.thumbnail as Record<string, unknown>)?.url ?? (d.thumbnail_url as string) ?? null,
      edit_url: (d.urls as Record<string, unknown>)?.edit_url ?? d.edit_url ?? null,
      view_url: (d.urls as Record<string, unknown>)?.view_url ?? d.view_url ?? null,
      updated_at: d.updated_at ?? d.created_at ?? null,
    }))

    // Filter designs by brand name if not showing all
    let filteredDesigns = designs
    let brandName: string | null = null
    if (!showAll) {
      const { data: brand } = await supabase
        .from('brands')
        .select('name')
        .eq('id', brandId)
        .single()
      brandName = brand?.name ?? null
      if (brandName) {
        const needle = brandName.toLowerCase()
        filteredDesigns = designs.filter((d: { title: string }) =>
          d.title.toLowerCase().includes(needle)
        )
      }
    }

    return NextResponse.json({
      configured: true,
      designs: filteredDesigns,
      totalDesigns: designs.length,
      brandName,
      ...(nextContinuation ? { continuation: nextContinuation } : {}),
    })
  } catch (err) {
    console.error('[canva/designs] Error:', err)
    return NextResponse.json({
      configured: true,
      designs: [],
      error: 'Failed to fetch Canva designs',
    })
  }
}
