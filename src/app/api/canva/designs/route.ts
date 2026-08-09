import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { describeCanvaFailure, getCanvaState } from '@/lib/canva/status'

export const dynamic = 'force-dynamic'

const CANVA_BASE_URL = 'https://api.canva.com/rest/v1'

/**
 * Fetch recent Canva designs for the selected brand.
 *
 * Connection health and refresh live in one service. This route never uses a
 * legacy environment token, and it never performs its own OAuth refresh.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const brandId = req.nextUrl.searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  let state = await getCanvaState(supabase, user.id)
  if (state.state !== 'ready') {
    return NextResponse.json({
      configured: state.state !== 'not_connected',
      state: state.state,
      designs: [],
      message: state.message,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const query = req.nextUrl.searchParams.get('query') ?? undefined
  const continuation = req.nextUrl.searchParams.get('continuation') ?? undefined
  const sortBy = req.nextUrl.searchParams.get('sort_by') ?? 'modified_descending'
  const fetchDesigns = async (token: string) => {
    const params = new URLSearchParams({ ownership: 'owned', sort_by: sortBy })
    if (query) params.set('query', query)
    if (continuation) params.set('continuation', continuation)
    return fetch(`${CANVA_BASE_URL}/designs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
  }

  try {
    let response = await fetchDesigns(state.token)
    // The token may expire between the cheap health probe and this endpoint.
    // Re-enter the shared service once instead of duplicating a refresh here.
    if (response.status === 401 || response.status === 403) {
      state = await getCanvaState(supabase, user.id)
      if (state.state === 'ready' && state.token !== undefined) response = await fetchDesigns(state.token)
    }

    if (!response.ok) {
      const failure = state.state === 'ready'
        ? describeCanvaFailure(response.status)
        : state
      return NextResponse.json({
        configured: failure.state !== 'not_connected',
        state: failure.state,
        designs: [],
        message: failure.message,
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    const data = await response.json() as Record<string, unknown>
    const items = (data.items ?? data.designs ?? []) as Array<Record<string, unknown>>
    const designs = items.map((design) => ({
      id: design.id,
      title: (design.title as string) ?? 'Untitled',
      thumbnail_url: (design.thumbnail as Record<string, unknown> | undefined)?.url ?? design.thumbnail_url ?? null,
      edit_url: (design.urls as Record<string, unknown> | undefined)?.edit_url ?? design.edit_url ?? null,
      view_url: (design.urls as Record<string, unknown> | undefined)?.view_url ?? design.view_url ?? null,
      updated_at: design.updated_at ?? design.created_at ?? null,
    }))

    const { data: brand } = await supabase.from('brands').select('name').eq('id', brandId).single()
    const brandName = brand?.name ?? null
    const sortedDesigns = brandName
      ? [
          ...designs.filter((design) => design.title.toLowerCase().includes(brandName.toLowerCase())),
          ...designs.filter((design) => !design.title.toLowerCase().includes(brandName.toLowerCase())),
        ]
      : designs

    return NextResponse.json({
      configured: true,
      state: 'ready',
      designs: sortedDesigns,
      brandName,
      ...(typeof data.continuation === 'string' ? { continuation: data.continuation } : {}),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[canva/designs] Error:', error)
    return NextResponse.json({
      configured: true,
      state: 'unavailable',
      designs: [],
      message: 'Canva could not be reached just now. Try again shortly.',
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
}
