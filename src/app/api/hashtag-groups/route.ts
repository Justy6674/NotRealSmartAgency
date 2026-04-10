import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureHashtagGroupTagInMixpost } from '@/lib/mixpost/sync-tags'

// Fire-and-forget Mixpost mirror — runs after the user response is
// returned so the UI doesn't wait on Mixpost. We use the admin client
// because the sync writes to mixpost_tag_id/uuid/synced_at, which the
// user's RLS policy doesn't cover. Errors are swallowed and logged —
// this is enrichment, not a source of truth.
function mirrorToMixpost(groupId: string) {
  void (async () => {
    try {
      const admin = createAdminClient()
      await ensureHashtagGroupTagInMixpost(admin, groupId)
    } catch (err) {
      console.warn(`[hashtag-groups] Mixpost mirror warning for ${groupId}:`, err)
    }
  })()
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('hashtag_groups')
    .select('*')
    .eq('brand_id', brandId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { brandId, name, tags, category } = await request.json()
  if (!brandId || !name || !tags?.length) {
    return NextResponse.json({ error: 'brandId, name, and tags required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('hashtag_groups')
    .insert({ user_id: user.id, brand_id: brandId, name, tags, category: category ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  mirrorToMixpost(data.id as string)
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id, name, tags, category } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (tags !== undefined) updates.tags = tags
  if (category !== undefined) updates.category = category

  const { data, error } = await supabase
    .from('hashtag_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Only mirror on name change — renaming an existing group won't
  // rename the Mixpost tag (tags are cached by id), but if the group
  // was created before this feature and has no mixpost_tag_id yet,
  // the next PATCH will lazily create it.
  if (updates.name !== undefined) mirrorToMixpost(data.id as string)
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('hashtag_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
