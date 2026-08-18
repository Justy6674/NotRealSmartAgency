/**
 * TikTok OAuth 2.0 callback — exchanges code for tokens.
 *
 * Flow:
 *  1. Exchange code via POST /v2/oauth/token/
 *  2. Fetch user info via GET /v2/user/info/
 *  3. Save token to social_oauth_tokens
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { saveToken } from '@/lib/publishers/token-store'

export const dynamic = 'force-dynamic'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    const errorDesc = searchParams.get('error_description') ?? 'User denied access'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/social/accounts?error=${encodeURIComponent(errorDesc)}`,
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/social/accounts?error=Missing+code+or+state`,
    )
  }

  // Verify CSRF state + retrieve code_verifier
  const cookieStore = await cookies()
  const storedCookie = cookieStore.get('tiktok_oauth_state')?.value
  if (!storedCookie) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/social/accounts?error=Invalid+state+(cookie+missing)`,
    )
  }

  const { state: storedState, codeVerifier } = JSON.parse(storedCookie) as {
    state: string
    codeVerifier: string
  }

  if (storedState !== state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/social/accounts?error=Invalid+state+parameter`,
    )
  }

  cookieStore.delete('tiktok_oauth_state')

  const { brandId } = JSON.parse(state) as { brandId: string }

  const clientKey = process.env.TIKTOK_CLIENT_KEY!
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET!
  const redirectUri = process.env.TIKTOK_OAUTH_REDIRECT_URI!

  try {
    // Step 1: Exchange code for token
    const tokenRes = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      throw new Error(`Token exchange failed: ${err}`)
    }

    const tokenData = await tokenRes.json()
    const accessToken: string = tokenData.access_token
    const refreshToken: string = tokenData.refresh_token
    const expiresIn: number = tokenData.expires_in ?? 86400
    const openId: string = tokenData.open_id

    // Step 2: Fetch user info
    const userRes = await fetch(
      `${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name,avatar_url,username`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    let displayName = openId
    let username = ''
    if (userRes.ok) {
      const userData = await userRes.json()
      const user = userData?.data?.user
      displayName = user?.display_name ?? openId
      username = user?.username ?? ''
    }

    // Step 3: Save token
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    await saveToken({
      brand_id: brandId,
      platform: 'tiktok',
      account_id: openId,
      account_name: username || displayName,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scopes: ['video.publish', 'user.info.basic'],
      status: 'active',
      last_refreshed_at: new Date().toISOString(),
      metadata: {
        open_id: openId,
        display_name: displayName,
        username,
      },
    })

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/social/accounts?success=${encodeURIComponent(
        `Connected TikTok: @${username || displayName}`,
      )}`,
    )
  } catch (error) {
    console.error('[tiktok/callback] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/social/accounts?error=${encodeURIComponent(msg)}`,
    )
  }
}
