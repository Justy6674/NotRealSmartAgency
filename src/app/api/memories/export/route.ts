import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/memories/export — export all user memories as JSON download
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const brandId = new URL(request.url).searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()
  if (!brand) return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 404 })

  // Export only the active memories for this exact project (exclude embeddings).
  const { data: memories, error } = await supabase
    .from('agent_memories')
    .select(
      'id, key, value, namespace, memory_type, confidence, source, tags, created_at, updated_at'
    )
    .eq('user_id', user.id)
    .eq('brand_id', brand.id)
    .eq('isolation_status', 'active')
    .order('namespace')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[memories/export] Query error:', error.message)
    return NextResponse.json(
      { error: 'Failed to export memories' },
      { status: 500 }
    )
  }

  const payload = {
    exported_at: new Date().toISOString(),
    project: brand.name,
    memory_count: memories?.length ?? 0,
    memories: memories ?? [],
  }

  const body = JSON.stringify(payload, null, 2)
  const filename = `nrs-memories-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
