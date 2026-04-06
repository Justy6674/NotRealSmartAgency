import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * RFC 7591 — Dynamic Client Registration.
 * Claude Desktop calls this to register itself as an OAuth client.
 */
export async function POST(request: Request) {
  const body = await request.json()
  const { client_name, redirect_uris } = body as {
    client_name?: string
    redirect_uris?: string[]
  }

  if (!redirect_uris?.length) {
    return NextResponse.json(
      { error: 'invalid_client_metadata', error_description: 'redirect_uris is required' },
      { status: 400 }
    )
  }

  // Generate client credentials
  const clientId = `nrs_c_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  const clientSecret = `nrs_s_${crypto.randomUUID().replace(/-/g, '')}`

  const supabase = createAdminClient()
  const { error } = await supabase.from('oauth_clients').insert({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: client_name ?? 'Claude',
    redirect_uris,
  })

  if (error) {
    return NextResponse.json(
      { error: 'server_error', error_description: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: client_name ?? 'Claude',
    redirect_uris,
    token_endpoint_auth_method: 'client_secret_post',
  }, { status: 201 })
}
