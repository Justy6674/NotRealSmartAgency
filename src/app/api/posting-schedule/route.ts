import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PostPlatform } from '@/types/database'

// CRUD for the per-brand weekly posting schedule slots used by the
// Phase 7 queue. RLS handles ownership checks via
// can_access_brand / can_write_for_owner — we just authenticate the
// session user.

const VALID_PLATFORMS: PostPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
]

function isValidPlatform(p: unknown): p is PostPlatform {
  return typeof p === 'string' && (VALID_PLATFORMS as string[]).includes(p)
}

function isValidDayOfWeek(d: unknown): d is number {
  return typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6
}

function isValidTime(t: unknown): t is string {
  return typeof t === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(t)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('posting_schedule_slots')
    .select('*')
    .eq('brand_id', brandId)
    .order('day_of_week', { ascending: true })
    .order('time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { brandId, platform, day_of_week, time, timezone } = body as {
    brandId?: string
    platform?: unknown
    day_of_week?: unknown
    time?: unknown
    timezone?: unknown
  }

  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: 'platform must be one of: ' + VALID_PLATFORMS.join(', ') }, { status: 400 })
  }
  if (!isValidDayOfWeek(day_of_week)) {
    return NextResponse.json({ error: 'day_of_week must be an integer 0-6 (0 = Sunday)' }, { status: 400 })
  }
  if (!isValidTime(time)) {
    return NextResponse.json({ error: 'time must be HH:MM or HH:MM:SS' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('posting_schedule_slots')
    .insert({
      brand_id: brandId,
      platform,
      day_of_week,
      time,
      timezone: typeof timezone === 'string' && timezone.length > 0 ? timezone : 'Australia/Brisbane',
    })
    .select()
    .single()

  if (error) {
    // Unique constraint collision → 409 so the UI can show "already exists"
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A slot already exists at that day/time for that platform' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { id, platform, day_of_week, time, timezone } = body as {
    id?: string
    platform?: unknown
    day_of_week?: unknown
    time?: unknown
    timezone?: unknown
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (platform !== undefined) {
    if (!isValidPlatform(platform)) return NextResponse.json({ error: 'invalid platform' }, { status: 400 })
    updates.platform = platform
  }
  if (day_of_week !== undefined) {
    if (!isValidDayOfWeek(day_of_week)) return NextResponse.json({ error: 'invalid day_of_week' }, { status: 400 })
    updates.day_of_week = day_of_week
  }
  if (time !== undefined) {
    if (!isValidTime(time)) return NextResponse.json({ error: 'invalid time' }, { status: 400 })
    updates.time = time
  }
  if (timezone !== undefined) {
    if (typeof timezone !== 'string') return NextResponse.json({ error: 'invalid timezone' }, { status: 400 })
    updates.timezone = timezone
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('posting_schedule_slots')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A slot already exists at that day/time for that platform' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('posting_schedule_slots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
