import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'

/**
 * Phase 9 of the Mixpost UI port — Account Entities CRUD.
 *
 * Per-account hashtags, mentions, and variable defaults that get
 * injected into every post published from that specific social
 * account. Table schema in supabase/migrations/038_account_entities.sql.
 *
 * RLS is in force on the table — we use the user-auth client
 * (`createClient()`), not the admin client, so writes are gated by
 * `can_write_for_owner(brand_id)` per the migration policy.
 */

const EntityTypeEnum = z.enum(['hashtag', 'mention', 'variable'])

const CreateSchema = z.object({
  brand_id: z.string().uuid(),
  account_id: z.string().min(1),
  account_name: z.string().optional(),
  platform: z.string().optional(),
  entity_type: EntityTypeEnum,
  name: z.string().optional(),
  value: z.string().min(1),
  position: z.number().int().optional(),
})

const PatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  value: z.string().optional(),
  position: z.number().int().optional(),
})

// ── GET — list entities for a brand × account pair ─────────────────────────

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const accountId = searchParams.get('accountId')

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  let query = supabase
    .from('account_entities')
    .select('*')
    .eq('brand_id', brandId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── POST — create a new entity ──────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  // Strip leading '#' from hashtag values to keep storage clean — the
  // Accounts UI renders them with the prefix.
  const clean =
    parsed.data.entity_type === 'hashtag'
      ? { ...parsed.data, value: parsed.data.value.replace(/^#/, '') }
      : parsed.data

  const { data, error } = await supabase
    .from('account_entities')
    .insert(clean)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// ── PATCH — update an existing entity ───────────────────────────────────────

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { id, ...patch } = parsed.data
  const { data, error } = await supabase
    .from('account_entities')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── DELETE — remove an entity ───────────────────────────────────────────────

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('account_entities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
