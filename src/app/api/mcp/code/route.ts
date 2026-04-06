import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Generate an OAuth authorization code after the user logs in.
 * Called by the /mcp-login page after successful Supabase auth.
 */
export async function POST(request: Request) {
  // Verify the user is authenticated (via Supabase session cookie)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', error_description: 'Not logged in' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const { client_id, code_challenge, redirect_uri, state } = body as {
    client_id: string
    code_challenge: string
    redirect_uri: string
    state: string
  }

  if (!client_id || !code_challenge || !redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing parameters' },
      { status: 400 }
    )
  }

  // Validate client exists
  const admin = createAdminClient()
  const { data: client } = await admin
    .from('oauth_clients')
    .select('redirect_uris')
    .eq('client_id', client_id)
    .single()

  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Unknown client or redirect_uri mismatch' },
      { status: 400 }
    )
  }

  // Generate a random auth code
  const code = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

  // Store it (expires in 5 minutes)
  const { error } = await admin.from('oauth_auth_codes').insert({
    code,
    client_id,
    user_id: user.id,
    code_challenge,
    redirect_uri,
    state,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  if (error) {
    return NextResponse.json(
      { error: 'server_error', error_description: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ code })
}
