/**
 * YouTube OAuth 2.0 initiation route.
 *
 * Redirects the user to Google's consent screen to authorise YouTube
 * upload + read scopes. A random state parameter is stored in a cookie
 * for CSRF protection, along with the brandId for the callback.
 */

import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ')

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const brandId = request.nextUrl.searchParams.get('brandId')
  if (!brandId) {
    return NextResponse.json(
      { error: 'brandId query parameter is required' },
      { status: 400 }
    )
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'YOUTUBE_CLIENT_ID is not configured' },
      { status: 500 }
    )
  }

  const redirectUri =
    process.env.YOUTUBE_OAUTH_REDIRECT_URI ??
    'https://www.notrealsmart.com.au/api/oauth/youtube/callback'

  // Generate CSRF state token
  const stateBytes = new Uint8Array(32)
  crypto.getRandomValues(stateBytes)
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Store state + brandId in cookies for the callback to verify
  const cookieStore = await cookies()
  cookieStore.set('youtube_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })
  cookieStore.set('youtube_oauth_brand_id', brandId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // Force consent screen to always get refresh_token
    state,
  })

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
}
