import { NextResponse } from 'next/server'
import { describeCanvaFailure, getCanvaState } from '@/lib/canva/status'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CANVA_BASE_URL = 'https://api.canva.com/rest/v1'

/**
 * GET /api/canva/brand-kits
 *
 * Fetches Canva brand templates for the authenticated user.
 * Connected means Canva just accepted the credential, never merely that a
 * token remains in our database.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const state = await getCanvaState(supabase, user.id)
  if (state.state !== 'ready') {
    return NextResponse.json({
      connected: false,
      state: state.state,
      brand_kits: [],
      message: state.message,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
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
  try {
    const res = await fetch(`${CANVA_BASE_URL}/brand-templates?limit=100`, {
      headers: {
        Authorization: `Bearer ${state.token}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[canva/brand-kits] API error:', res.status, err)
      const failure = describeCanvaFailure(res.status)
      return NextResponse.json(
        {
          connected: false,
          state: failure.state,
          brand_kits: [],
          message: failure.message,
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
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
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (err) {
    console.error('[canva/brand-kits] Error:', err)
    return NextResponse.json({
      connected: false,
      state: 'unavailable',
      brand_kits: [],
      message: 'Canva could not be reached just now. Try again shortly.',
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
}
