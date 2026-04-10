/**
 * TikTok OAuth 2.0 initiation — redirects to TikTok auth page.
 *
 * Scopes: video.publish, user.info.basic
 *
 * Query params:
 *   brandId — the NRS brand to link this account to
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes, createHash } from 'crypto'

export const dynamic = 'force-dynamic'

const TIKTOK_SCOPES = 'video.publish,user.info.basic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const redirectUri = process.env.TIKTOK_OAUTH_REDIRECT_URI

  if (!clientKey || !redirectUri) {
    return NextResponse.json(
      { error: 'TikTok OAuth not configured (missing TIKTOK_CLIENT_KEY or TIKTOK_OAUTH_REDIRECT_URI)' },
      { status: 500 },
    )
  }

  // Generate CSRF state + PKCE code verifier
  const csrfToken = randomBytes(16).toString('hex')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

  const state = JSON.stringify({ brandId, csrf: csrfToken })

  // Store state + code_verifier in secure cookie
  const cookieStore = await cookies()
  cookieStore.set('tiktok_oauth_state', JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/oauth/tiktok/callback',
  })

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
  authUrl.searchParams.set('client_key', clientKey)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', TIKTOK_SCOPES)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  return NextResponse.redirect(authUrl.toString())
}
