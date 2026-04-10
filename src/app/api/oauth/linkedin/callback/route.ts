/**
 * LinkedIn OAuth 2.0 callback endpoint.
 *
 * Exchanges the authorisation code for tokens, fetches the user's
 * LinkedIn profile (for display name), and saves the token to
 * social_oauth_tokens. Redirects to /agency/studio/accounts on success.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { saveToken } from '@/lib/publishers/token-store'

export const dynamic = 'force-dynamic'

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_PROFILE_URL = 'https://api.linkedin.com/v2/userinfo'

export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  const redirectUri =
    process.env.LINKEDIN_OAUTH_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.notrealsmart.com.au'}/api/oauth/linkedin/callback`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.notrealsmart.com.au'

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_not_configured`,
    )
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  // LinkedIn sends error param if user denied access
  if (errorParam) {
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_denied&detail=${encodeURIComponent(errorParam)}`,
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_missing_params`,
    )
  }

  // CSRF validation
  const cookieStore = await cookies()
  const stateCookie = cookieStore.get('linkedin_oauth_state')

  if (!stateCookie) {
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_csrf_expired`,
    )
  }

  let storedState: { state: string; brandId: string }
  try {
    storedState = JSON.parse(stateCookie.value)
  } catch {
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_csrf_invalid`,
    )
  }

  if (storedState.state !== state) {
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_csrf_mismatch`,
    )
  }

  // Clear the state cookie
  cookieStore.delete('linkedin_oauth_state')

  // ── Exchange code for token ─────────────────────────────────────────────

  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '')
    console.error('[linkedin-oauth] Token exchange failed:', tokenRes.status, errText)
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_token_failed`,
    )
  }

  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  const refreshToken: string | undefined = tokenData.refresh_token
  const expiresIn: number | undefined = tokenData.expires_in // seconds

  // ── Fetch LinkedIn profile for display name + account_id ────────────────

  let accountId = 'unknown'
  let accountName = 'LinkedIn User'

  try {
    const profileRes = await fetch(LINKEDIN_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (profileRes.ok) {
      const profile = await profileRes.json()
      // OpenID Connect userinfo endpoint returns sub, name, given_name, etc.
      accountId = profile.sub ?? 'unknown'
      const fullName = `${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim()
      accountName = profile.name ?? (fullName || 'LinkedIn User')
    }
  } catch (err) {
    console.error('[linkedin-oauth] Profile fetch error:', err)
    // Continue with defaults — we still have the token
  }

  // ── Save token to database ──────────────────────────────────────────────

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

  const saved = await saveToken({
    brand_id: storedState.brandId,
    platform: 'linkedin',
    account_id: accountId,
    account_name: accountName,
    access_token: accessToken,
    refresh_token: refreshToken ?? null,
    expires_at: expiresAt,
    scopes: ['w_member_social', 'openid', 'profile'],
    status: 'active',
    last_refreshed_at: new Date().toISOString(),
    metadata: {},
  })

  if (!saved) {
    console.error('[linkedin-oauth] Failed to save token to database')
    return NextResponse.redirect(
      `${appUrl}/agency/studio?error=linkedin_save_failed`,
    )
  }

  // Success — redirect to accounts page
  return NextResponse.redirect(
    `${appUrl}/agency/studio?tab=accounts&linkedin=connected`,
  )
}
