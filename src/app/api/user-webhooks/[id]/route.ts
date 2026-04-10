import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isWebhookEvent } from '@/lib/webhooks/events'

/**
 * GET /api/user-webhooks/[id]
 * PATCH /api/user-webhooks/[id]
 * DELETE /api/user-webhooks/[id]
 *
 * RLS guarantees that only team members with brand access can read,
 * and only owners/admins can write or delete.
 */

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_webhooks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: {
    name?: string | null
    url?: string
    method?: string
    secret?: string | null
    events?: string[]
    active?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = body.name?.trim() || null

  if (body.url !== undefined) {
    if (!isValidUrl(body.url)) {
      return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
    }
    updates.url = body.url
  }

  if (body.method !== undefined) {
    const cleaned = body.method.toUpperCase()
    if (!['POST', 'PUT'].includes(cleaned)) {
      return NextResponse.json({ error: 'method must be POST or PUT' }, { status: 400 })
    }
    updates.method = cleaned
  }

  if (body.secret !== undefined) updates.secret = body.secret?.trim() || null

  if (body.events !== undefined) {
    if (!Array.isArray(body.events)) {
      return NextResponse.json({ error: 'events must be an array' }, { status: 400 })
    }
    const cleaned = body.events.filter(isWebhookEvent)
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'Pick at least one event for this webhook' },
        { status: 400 }
      )
    }
    updates.events = cleaned
  }

  if (body.active !== undefined) updates.active = !!body.active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_webhooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { error } = await supabase.from('user_webhooks').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
