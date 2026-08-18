/**
 * YouTube OAuth 2.0 callback route.
 *
 * Handles the redirect from Google after the user consents. Exchanges the
 * authorisation code for tokens, fetches the channel info for display,
 * and writes the token row to social_oauth_tokens via the admin client.
 */

import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_CHANNELS_URL =
  'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true'

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

interface YouTubeChannelResponse {
  items?: Array<{
    id: string
    snippet?: {
      title?: string
      thumbnails?: {
        default?: { url?: string }
      }
    }
  }>
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()

  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verify CSRF state
  const state = request.nextUrl.searchParams.get('state')
  const storedState = cookieStore.get('youtube_oauth_state')?.value
  const brandId = cookieStore.get('youtube_oauth_brand_id')?.value

  // Clear cookies regardless of outcome
  cookieStore.delete('youtube_oauth_state')
  cookieStore.delete('youtube_oauth_brand_id')

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL('/agency/social/accounts?error=invalid_state', request.url)
    )
  }

  if (!brandId) {
    return NextResponse.redirect(
      new URL('/agency/social/accounts?error=missing_brand', request.url)
    )
  }

  // Check for OAuth error
  const oauthError = request.nextUrl.searchParams.get('error')
  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/agency/social/accounts?error=${encodeURIComponent(oauthError)}`,
        request.url
      )
    )
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(
      new URL('/agency/social/accounts?error=no_code', request.url)
    )
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri =
    process.env.YOUTUBE_OAUTH_REDIRECT_URI ??
    'https://www.notrealsmart.com.au/api/oauth/youtube/callback'

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/agency/social/accounts?error=server_config', request.url)
    )
  }

  // Exchange authorisation code for tokens
  let tokenData: GoogleTokenResponse
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('[YouTube OAuth] Token exchange failed:', errBody)
      return NextResponse.redirect(
        new URL('/agency/social/accounts?error=token_exchange', request.url)
      )
    }

    tokenData = (await tokenRes.json()) as GoogleTokenResponse
  } catch (err) {
    console.error('[YouTube OAuth] Token exchange network error:', err)
    return NextResponse.redirect(
      new URL('/agency/social/accounts?error=token_exchange', request.url)
    )
  }

  // Fetch channel info for display name + thumbnail
  let channelId = 'unknown'
  let channelName: string | null = null
  let channelThumbnail: string | null = null

  try {
    const channelRes = await fetch(YOUTUBE_CHANNELS_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (channelRes.ok) {
      const channelData = (await channelRes.json()) as YouTubeChannelResponse
      const channel = channelData.items?.[0]
      if (channel) {
        channelId = channel.id
        channelName = channel.snippet?.title ?? null
        channelThumbnail =
          channel.snippet?.thumbnails?.default?.url ?? null
      }
    }
  } catch (err) {
    // Non-fatal — we still have the token
    console.warn('[YouTube OAuth] Channel info fetch failed:', err)
  }

  // Write to social_oauth_tokens via admin client (bypasses RLS)
  const admin = createAdminClient()
  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000
  ).toISOString()

  const { error: upsertError } = await admin
    .from('social_oauth_tokens')
    .upsert(
      {
        brand_id: brandId,
        platform: 'youtube',
        account_id: channelId,
        account_name: channelName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        scopes: tokenData.scope.split(' '),
        status: 'active',
        last_refreshed_at: new Date().toISOString(),
        metadata: {
          channel_thumbnail: channelThumbnail,
          connected_by: user.id,
          connected_at: new Date().toISOString(),
        },
      },
      {
        onConflict: 'brand_id,platform,account_id',
      }
    )

  if (upsertError) {
    console.error('[YouTube OAuth] Token storage failed:', upsertError)
    return NextResponse.redirect(
      new URL('/agency/social/accounts?error=storage_failed', request.url)
    )
  }

  // Redirect back to accounts page with success
  return NextResponse.redirect(
    new URL(
      `/agency/social/accounts?connected=youtube&channel=${encodeURIComponent(channelName ?? channelId)}`,
      request.url
    )
  )
}
