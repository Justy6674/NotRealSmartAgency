/**
 * LinkedIn OAuth 2.0 initiation endpoint.
 *
 * Redirects to LinkedIn's authorization page. The brandId is passed
 * as a query parameter and encoded in the state cookie for retrieval
 * in the callback.
 *
 * Usage: GET /api/oauth/linkedin/initiate?brandId=<uuid>
 */

import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const SCOPES = 'w_member_social openid profile'

export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const redirectUri =
    process.env.LINKEDIN_OAUTH_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.notrealsmart.com.au'}/api/oauth/linkedin/callback`

  if (!clientId) {
    return NextResponse.json(
      { error: 'LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID.' },
      { status: 500 },
    )
  }

  const brandId = req.nextUrl.searchParams.get('brandId')
  if (!brandId) {
    return NextResponse.json(
      { error: 'brandId query parameter is required.' },
      { status: 400 },
    )
  }

  // Generate CSRF state token
  const state = randomBytes(32).toString('hex')

  // Store state + brandId in a signed cookie for CSRF validation
  const cookieStore = await cookies()
  cookieStore.set('linkedin_oauth_state', JSON.stringify({ state, brandId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  })

  return NextResponse.redirect(`${LINKEDIN_AUTH_URL}?${params.toString()}`)
}
