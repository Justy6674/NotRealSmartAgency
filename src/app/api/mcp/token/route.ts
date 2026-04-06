import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateApiKey } from '@/lib/auth/api-key'

export const dynamic = 'force-dynamic'

/**
 * OAuth 2.0 Token Endpoint.
 * Claude Desktop exchanges an auth code for an access token.
 * The access token IS an nrs_sk_ API key — reuses our existing system.
 */
export async function POST(request: Request) {
  const body = await request.formData().catch(() => null)
  const params = body
    ? Object.fromEntries(body.entries())
    : await request.json()

  const grantType = params.grant_type as string
  const clientId = params.client_id as string
  const clientSecret = params.client_secret as string

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'client_id and client_secret required' },
      { status: 401 }
    )
  }

  const supabase = createAdminClient()

  // Validate client credentials
  const { data: client } = await supabase
    .from('oauth_clients')
    .select('client_id')
    .eq('client_id', clientId)
    .eq('client_secret', clientSecret)
    .single()

  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client credentials' },
      { status: 401 }
    )
  }

  if (grantType === 'authorization_code') {
    return handleAuthCodeExchange(params, supabase, clientId)
  }

  if (grantType === 'refresh_token') {
    return handleRefreshToken(params, supabase)
  }

  return NextResponse.json(
    { error: 'unsupported_grant_type' },
    { status: 400 }
  )
}

async function handleAuthCodeExchange(
  params: Record<string, unknown>,
  supabase: ReturnType<typeof createAdminClient>,
  clientId: string,
) {
  const code = params.code as string
  const codeVerifier = params.code_verifier as string
  const redirectUri = params.redirect_uri as string

  if (!code || !codeVerifier) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'code and code_verifier required' },
      { status: 400 }
    )
  }

  // Look up the auth code
  const { data: authCode } = await supabase
    .from('oauth_auth_codes')
    .select('*')
    .eq('code', code)
    .eq('client_id', clientId)
    .eq('used', false)
    .single()

  if (!authCode) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired auth code' },
      { status: 400 }
    )
  }

  // Check expiry
  if (new Date(authCode.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Auth code expired' },
      { status: 400 }
    )
  }

  // Check redirect_uri matches
  if (redirectUri && redirectUri !== authCode.redirect_uri) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'redirect_uri mismatch' },
      { status: 400 }
    )
  }

  // Validate PKCE — hash the code_verifier and compare to stored code_challenge
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier))
  const computedChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  if (computedChallenge !== authCode.code_challenge) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'PKCE verification failed' },
      { status: 400 }
    )
  }

  // Mark code as used
  await supabase
    .from('oauth_auth_codes')
    .update({ used: true })
    .eq('code', code)

  // Generate an API key as the access token (reuses existing system!)
  const { raw, hash, prefix } = generateApiKey()
  const keyHash = await hash

  await supabase.from('api_keys').insert({
    user_id: authCode.user_id,
    name: 'Claude (connected via OAuth)',
    prefix,
    key_hash: keyHash,
  })

  // Generate a refresh token (another API key, stored separately)
  const refresh = generateApiKey()
  const refreshHash = await refresh.hash

  await supabase.from('api_keys').insert({
    user_id: authCode.user_id,
    name: 'Claude refresh token',
    prefix: refresh.prefix,
    key_hash: refreshHash,
  })

  return NextResponse.json({
    access_token: raw,
    token_type: 'bearer',
    expires_in: 31536000, // 1 year
    refresh_token: refresh.raw,
  })
}

async function handleRefreshToken(
  params: Record<string, unknown>,
  supabase: ReturnType<typeof createAdminClient>,
) {
  const refreshToken = params.refresh_token as string
  if (!refreshToken) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'refresh_token required' },
      { status: 400 }
    )
  }

  // Validate the refresh token exists as an API key
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(refreshToken))
  const refreshHash = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const { data: existingKey } = await supabase
    .from('api_keys')
    .select('user_id, id')
    .eq('key_hash', refreshHash)
    .is('revoked_at', null)
    .single()

  if (!existingKey) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid refresh token' },
      { status: 400 }
    )
  }

  // Generate new access token
  const { raw, hash, prefix } = generateApiKey()
  const keyHash = await hash

  await supabase.from('api_keys').insert({
    user_id: existingKey.user_id,
    name: 'Claude (refreshed)',
    prefix,
    key_hash: keyHash,
  })

  return NextResponse.json({
    access_token: raw,
    token_type: 'bearer',
    expires_in: 31536000,
    refresh_token: refreshToken, // Keep same refresh token
  })
}
