import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CANVA_BASE_URL = 'https://api.canva.com/rest/v1'

/**
 * GET /api/canva/designs?brandId=xxx
 *
 * Fetches recent Canva designs for the brand. Checks user_integrations
 * first, falls back to platform-wide CANVA_API_KEY.
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

  // Get Canva API key — user-specific first, then platform
  let apiKey: string | null = null

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', user.id)
    .eq('provider', 'canva')
    .single()

  apiKey = (integration?.cached_data?.api_key as string) ?? null
  if (!apiKey) {
    apiKey = process.env.CANVA_API_KEY ?? null
  }

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      designs: [],
    })
  }

  try {
    // Fetch recent designs owned by the user
    const res = await fetch(`${CANVA_BASE_URL}/designs?ownership=owned&sort_by=relevance`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[canva/designs] API error:', res.status, err)
      return NextResponse.json({
        configured: true,
        designs: [],
        error: `Canva API error: ${res.status}`,
      })
    }

    const data = await res.json()
    const items = data.items ?? data.designs ?? []

    const designs = items.slice(0, 12).map((d: Record<string, unknown>) => ({
      id: d.id,
      title: (d.title as string) ?? 'Untitled',
      thumbnail_url: (d.thumbnail as Record<string, unknown>)?.url ?? (d.thumbnail_url as string) ?? null,
      edit_url: (d.urls as Record<string, unknown>)?.edit_url ?? d.edit_url ?? null,
      view_url: (d.urls as Record<string, unknown>)?.view_url ?? d.view_url ?? null,
      updated_at: d.updated_at ?? d.created_at ?? null,
    }))

    return NextResponse.json({
      configured: true,
      designs,
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
