import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/canva/auth
 *
 * Initiates Canva OAuth 2.0 + PKCE flow.
 * Generates code_verifier, stores it in a cookie, redirects to Canva.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const clientId = process.env.CANVA_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'CANVA_CLIENT_ID not configured' }, { status: 500 })
  }

  // PKCE: generate code_verifier and code_challenge
  const codeVerifier = crypto.randomBytes(64).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  // State for CSRF protection
  const state = crypto.randomBytes(32).toString('base64url')

  // Scopes we need for the dashboard
  const scopes = [
    'design:content:read',
    'design:meta:read',
    'folder:read',
    'asset:read',
    'profile:read',
  ].join(' ')

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://notrealsmart.com.au'}/api/canva/callback`

  const authUrl = new URL('https://www.canva.com/api/oauth/authorize')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  // Store code_verifier and state in cookies (httpOnly, short-lived)
  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('canva_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })
  response.cookies.set('canva_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
