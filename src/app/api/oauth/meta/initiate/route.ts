/**
 * Meta OAuth 2.0 initiation — redirects to Facebook login dialog.
 *
 * Scopes requested:
 *   pages_manage_posts — publish to Pages
 *   pages_read_engagement — read Page insights
 *   instagram_basic — read IG profile
 *   instagram_content_publish — publish to IG Business
 *
 * Query params:
 *   brandId — the NRS brand to link this account to
 *   state — optional CSRF token (generated if not provided)
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const META_SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',')

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const appId = process.env.META_APP_ID
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: 'Meta OAuth not configured (missing META_APP_ID or META_OAUTH_REDIRECT_URI)' },
      { status: 500 },
    )
  }

  // Generate CSRF state token
  const state = JSON.stringify({
    brandId,
    csrf: randomBytes(16).toString('hex'),
  })

  // Store state in a secure cookie for verification on callback
  const cookieStore = await cookies()
  cookieStore.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/api/oauth/meta/callback',
  })

  const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', META_SCOPES)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
