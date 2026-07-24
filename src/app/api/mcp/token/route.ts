import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { issueRefreshToken, issueScopedMcpAccessKey } from '@/lib/auth/api-key'

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

  const untrustedProjectIds: unknown[] = Array.isArray(authCode.project_ids) ? authCode.project_ids : []
  const projectIds = untrustedProjectIds.filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
  if (projectIds.length === 0) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'This authorization code has no project scope' },
      { status: 400 },
    )
  }

  let access
  let refresh
  try {
    access = await issueScopedMcpAccessKey({
      userId: authCode.user_id,
      projectIds,
      name: 'NRS MCP connection',
    })
    refresh = await issueRefreshToken({
      userId: authCode.user_id,
      name: 'NRS MCP refresh token',
      parentKeyId: access.id,
    })
  } catch {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Could not create scoped MCP credentials' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    access_token: access.raw,
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
    .select('user_id, id, parent_key_id, token_kind')
    .eq('key_hash', refreshHash)
    .is('revoked_at', null)
    .single()

  if (!existingKey || existingKey.token_kind !== 'refresh' || !existingKey.parent_key_id) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid refresh token' },
      { status: 400 }
    )
  }

  const { data: previousMappings, error: mappingsError } = await supabase
    .from('api_key_project_grants')
    .select('project_access_grant_id, project_access_grants!inner(brand_id)')
    .eq('api_key_id', existingKey.parent_key_id)

  if (mappingsError || !previousMappings?.length) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'The original project grants are unavailable' },
      { status: 400 },
    )
  }

  const projectIds = previousMappings.map(
    (mapping) => (mapping.project_access_grants as unknown as { brand_id: string }).brand_id,
  )
  let access
  try {
    access = await issueScopedMcpAccessKey({
      userId: existingKey.user_id,
      projectIds,
      name: 'NRS MCP connection (refreshed)',
      parentKeyId: existingKey.parent_key_id,
    })
  } catch {
    return NextResponse.json(
      { error: 'server_error', error_description: 'Could not refresh scoped MCP credentials' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    access_token: access.raw,
    token_type: 'bearer',
    expires_in: 31536000,
    refresh_token: refreshToken, // Keep same refresh token
  })
}
