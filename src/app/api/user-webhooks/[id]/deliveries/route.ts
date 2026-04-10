import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/user-webhooks/[id]/deliveries?limit=50&offset=0
 *
 * Paginated delivery log for a single webhook. RLS via the
 * "team members read deliveries" policy already restricts visibility
 * to brands the user can access.
 */

interface RouteParams {
  params: Promise<{ id: string }>
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 200

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  const { data, error, count } = await supabase
    .from('user_webhook_deliveries')
    .select('*', { count: 'exact' })
    .eq('webhook_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    deliveries: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
