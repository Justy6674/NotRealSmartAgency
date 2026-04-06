import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateApiKey } from '@/lib/auth/api-key'

export const dynamic = 'force-dynamic'

// List user's API keys
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, name, prefix, last_used_at, revoked_at, created_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keys })
}

// Create a new API key
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const name = (body.name || 'Untitled key').slice(0, 100)

  const { raw, hash, prefix } = generateApiKey()
  const keyHash = await hash

  const { error } = await supabase.from('api_keys').insert({
    user_id: user.id,
    name,
    prefix,
    key_hash: keyHash,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return the raw key exactly once — never stored, never retrievable again
  return NextResponse.json({ key: raw, prefix, name })
}

// Revoke an API key
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const keyId = searchParams.get('id')
  if (!keyId) return NextResponse.json({ error: 'Missing key ID' }, { status: 400 })

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revoked: true })
}
