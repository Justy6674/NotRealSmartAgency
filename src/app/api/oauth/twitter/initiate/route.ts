/**
 * X (Twitter) OAuth 2.0 initiation with PKCE.
 *
 * Scopes: tweet.read, tweet.write, users.read, offline.access
 *
 * X requires PKCE (S256) — no client_secret in the browser redirect.
 *
 * Query params:
 *   brandId — the NRS brand to link this account to
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes, createHash } from 'crypto'

export const dynamic = 'force-dynamic'

const TWITTER_SCOPES = 'tweet.read tweet.write users.read offline.access'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const clientId = process.env.TWITTER_CLIENT_ID
  const redirectUri = process.env.TWITTER_OAUTH_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'X OAuth not configured (missing TWITTER_CLIENT_ID or TWITTER_OAUTH_REDIRECT_URI)' },
      { status: 500 },
    )
  }

  // PKCE: generate code_verifier and code_challenge
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  // CSRF state
  const state = JSON.stringify({
    brandId,
    csrf: randomBytes(16).toString('hex'),
  })

  // Store state + code_verifier in secure cookie
  const cookieStore = await cookies()
  cookieStore.set('twitter_oauth_state', JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/oauth/twitter/callback',
  })

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', TWITTER_SCOPES)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  return NextResponse.redirect(authUrl.toString())
}
