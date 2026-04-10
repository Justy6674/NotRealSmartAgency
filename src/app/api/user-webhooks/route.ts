import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { WEBHOOK_EVENTS, isWebhookEvent } from '@/lib/webhooks/events'

/**
 * GET /api/user-webhooks?brandId=...
 * List all webhooks for a brand the current user can access.
 *
 * POST /api/user-webhooks
 * Create a new webhook subscription. RLS enforces brand access via
 * can_write_for_owner — viewers can list but not create.
 */

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function generateSecret(): string {
  // 32 bytes of randomness, hex encoded — 64 chars, plenty for HMAC.
  return randomBytes(32).toString('hex')
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_webhooks')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: {
    brandId?: string
    name?: string
    url?: string
    method?: string
    secret?: string
    events?: string[]
    active?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { brandId, name, url, method, secret, events, active } = body

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }
  if (!url || !isValidUrl(url)) {
    return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
  }

  const cleanedEvents = Array.isArray(events) ? events.filter(isWebhookEvent) : []
  if (cleanedEvents.length === 0) {
    return NextResponse.json(
      { error: 'Pick at least one event for this webhook' },
      { status: 400 }
    )
  }

  const cleanedMethod = method && ['POST', 'PUT'].includes(method.toUpperCase())
    ? method.toUpperCase()
    : 'POST'

  const { data, error } = await supabase
    .from('user_webhooks')
    .insert({
      brand_id: brandId,
      name: name?.trim() || null,
      url,
      method: cleanedMethod,
      secret: secret?.trim() || generateSecret(),
      events: cleanedEvents,
      active: active ?? true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// Re-export the canonical event list so the editor UI can fetch it as
// metadata in the future without importing from a server module.
export const ALLOWED_EVENTS = WEBHOOK_EVENTS
