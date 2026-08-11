import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createMediaIntakeToken,
  hashMediaIntakeToken,
} from '@/lib/media/intake-link'

export const runtime = 'nodejs'

const LINK_FIELDS = 'id, brand_id, label, token_prefix, status, expires_at, last_used_at, last_media_item_id, revoked_at, created_at, updated_at, brands(name, slug)'

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/** List capability links without ever returning the raw secret again. */
export async function GET(request: Request) {
  const { supabase, user } = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const brandId = new URL(request.url).searchParams.get('brandId')
  let query = supabase
    .from('media_intake_links')
    .select(LINK_FIELDS)
    .order('created_at', { ascending: false })

  if (brandId) query = query.eq('brand_id', brandId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Could not load quick-add links.' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * Create one narrowly scoped upload capability. The full link is returned
 * exactly once so it can be saved to the phone; the database only retains its
 * SHA-256 digest and a harmless visual prefix.
 */
export async function POST(request: Request) {
  const { supabase, user } = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null) as { brand_id?: unknown; label?: unknown } | null
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id : ''
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 80) : ''
  if (!brandId) return NextResponse.json({ error: 'Choose a brand first.' }, { status: 400 })

  // The session-scoped query proves the caller can see this exact project.
  // The insert below is also RLS-gated to owners/admins, so a viewer cannot
  // create a public write capability merely by knowing a brand ID.
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, user_id, name')
    .eq('id', brandId)
    .single()
  if (brandError || !brand) return NextResponse.json({ error: 'That brand is not available to you.' }, { status: 404 })

  const rawToken = createMediaIntakeToken()
  const { data: link, error } = await supabase
    .from('media_intake_links')
    .insert({
      brand_id: brand.id,
      owner_user_id: brand.user_id,
      created_by: user.id,
      label: label || `${brand.name} quick add`,
      token_prefix: rawToken.slice(0, 18),
      token_hash: hashMediaIntakeToken(rawToken),
    })
    .select(LINK_FIELDS)
    .single()

  if (error || !link) {
    return NextResponse.json({ error: 'Could not create the quick-add link. Check that you have admin access to this brand.' }, { status: 403 })
  }

  // Fragments are never sent in HTTP requests, which keeps the secret out of
  // server access logs and referrer headers while still giving the page access.
  const dropUrl = `${new URL(request.url).origin}/add-media#${rawToken}`
  return NextResponse.json({ link, drop_url: dropUrl }, { status: 201 })
}

/** Revoke a link instead of deleting its evidence trail. */
export async function PATCH(request: Request) {
  const { supabase, user } = await currentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown } | null
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id || body?.action !== 'revoke') return NextResponse.json({ error: 'A quick-add link and revoke action are required.' }, { status: 400 })

  const revokedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('media_intake_links')
    .update({ status: 'revoked', revoked_at: revokedAt })
    .eq('id', id)
    .eq('status', 'active')
    .select(LINK_FIELDS)
    .maybeSingle()

  if (error || !data) return NextResponse.json({ error: 'That link could not be revoked.' }, { status: 404 })
  return NextResponse.json(data)
}
