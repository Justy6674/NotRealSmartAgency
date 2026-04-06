import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * OAuth 2.0 Authorization Endpoint.
 * Claude Desktop redirects the user here. We validate the request,
 * then redirect to our login page which handles auth + code generation.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const clientId = url.searchParams.get('client_id')
  const redirectUri = url.searchParams.get('redirect_uri')
  const state = url.searchParams.get('state')
  const codeChallenge = url.searchParams.get('code_challenge')
  const codeChallengeMethod = url.searchParams.get('code_challenge_method')
  const responseType = url.searchParams.get('response_type')

  // Validate required params
  if (!clientId || !redirectUri || !codeChallenge || !state) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      { status: 400 }
    )
  }

  if (responseType !== 'code') {
    return NextResponse.json(
      { error: 'unsupported_response_type' },
      { status: 400 }
    )
  }

  if (codeChallengeMethod && codeChallengeMethod !== 'S256') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Only S256 code challenge method is supported' },
      { status: 400 }
    )
  }

  // Validate client exists and redirect_uri matches
  const supabase = createAdminClient()
  const { data: client } = await supabase
    .from('oauth_clients')
    .select('redirect_uris')
    .eq('client_id', clientId)
    .single()

  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Unknown client_id' },
      { status: 400 }
    )
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'redirect_uri not registered' },
      { status: 400 }
    )
  }

  // Redirect to our login page with all OAuth params
  const loginUrl = new URL('/mcp-login', url.origin)
  loginUrl.searchParams.set('client_id', clientId)
  loginUrl.searchParams.set('redirect_uri', redirectUri)
  loginUrl.searchParams.set('state', state)
  loginUrl.searchParams.set('code_challenge', codeChallenge)

  return NextResponse.redirect(loginUrl.toString())
}
