/**
 * X (Twitter) OAuth 2.0 callback — exchanges code + code_verifier for tokens.
 *
 * Flow:
 *  1. Exchange code via POST /2/oauth2/token with PKCE code_verifier
 *  2. Fetch user via GET /2/users/me
 *  3. Save token to social_oauth_tokens
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { saveToken } from '@/lib/publishers/token-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    const errorDesc = searchParams.get('error_description') ?? 'User denied access'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=${encodeURIComponent(errorDesc)}`,
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=Missing+code+or+state`,
    )
  }

  // Verify CSRF state + retrieve code_verifier
  const cookieStore = await cookies()
  const storedCookie = cookieStore.get('twitter_oauth_state')?.value
  if (!storedCookie) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=Invalid+state+(cookie+missing)`,
    )
  }

  const { state: storedState, codeVerifier } = JSON.parse(storedCookie) as {
    state: string
    codeVerifier: string
  }

  if (storedState !== state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=Invalid+state+parameter`,
    )
  }

  cookieStore.delete('twitter_oauth_state')

  const { brandId } = JSON.parse(state) as { brandId: string }

  const clientId = process.env.TWITTER_CLIENT_ID!
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!
  const redirectUri = process.env.TWITTER_OAUTH_REDIRECT_URI!

  try {
    // Step 1: Exchange code for token
    // X requires Basic auth header with client_id:client_secret for confidential clients
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
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
    const refreshToken: string | null = tokenData.refresh_token ?? null
    const expiresIn: number = tokenData.expires_in ?? 7200 // 2 hours default

    // Step 2: Fetch user info
    const userRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    let userId = ''
    let username = ''
    let displayName = ''

    if (userRes.ok) {
      const userData = await userRes.json()
      userId = userData?.data?.id ?? ''
      username = userData?.data?.username ?? ''
      displayName = userData?.data?.name ?? ''
    }

    // Step 3: Save token
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    await saveToken({
      brand_id: brandId,
      platform: 'twitter',
      account_id: userId,
      account_name: username,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      status: 'active',
      last_refreshed_at: new Date().toISOString(),
      metadata: {
        user_id: userId,
        username,
        display_name: displayName,
      },
    })

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?success=${encodeURIComponent(
        `Connected X: @${username || displayName}`,
      )}`,
    )
  } catch (error) {
    console.error('[twitter/callback] Error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=${encodeURIComponent(msg)}`,
    )
  }
}
