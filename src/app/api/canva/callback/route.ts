import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/canva/callback
 *
 * Handles Canva OAuth callback. Exchanges authorization code for
 * access token + refresh token and stores them in user_integrations.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    console.error('[canva/callback] OAuth error:', error)
    return NextResponse.redirect(new URL('/agency/connections/canva?canva_error=' + error, req.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/agency/connections/canva?canva_error=no_code', req.url))
  }

  // Verify state
  const storedState = req.cookies.get('canva_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL('/agency/connections/canva?canva_error=state_mismatch', req.url))
  }

  // Get code_verifier from cookie
  const codeVerifier = req.cookies.get('canva_code_verifier')?.value
  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/agency/connections/canva?canva_error=no_verifier', req.url))
  }

  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('[canva/callback] Missing CANVA_CLIENT_ID or CANVA_CLIENT_SECRET')
    return NextResponse.redirect(new URL('/agency/connections/canva?canva_error=config', req.url))
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://notrealsmart.com.au'}/api/canva/callback`

  try {
    // Exchange authorization code for access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('[canva/callback] Token exchange failed:', tokenRes.status, err)
      return NextResponse.redirect(new URL('/agency/connections/canva?canva_error=token_exchange', req.url))
    }

    const tokenData = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokenData

    // Store in user_integrations table
    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

    // Upsert — update if exists, insert if not
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert(
        {
          user_id: user.id,
          provider: 'canva',
          is_active: true,
          cached_data: {
            api_key: access_token,
            refresh_token,
            expires_at: expiresAt,
            token_type: 'oauth',
          },
        },
        { onConflict: 'user_id,provider' }
      )

    if (dbError) {
      console.error('[canva/callback] DB upsert error:', dbError)
      // Still redirect — the token is valid even if we couldn't store it
    }

    console.log('[canva/callback] Canva connected successfully for user:', user.id)

    // Clean up cookies and redirect to studio
    const response = NextResponse.redirect(new URL('/agency/connections/canva?canva=connected', req.url))
    response.cookies.delete('canva_code_verifier')
    response.cookies.delete('canva_oauth_state')
    return response
  } catch (err) {
    console.error('[canva/callback] Error:', err)
    return NextResponse.redirect(new URL('/agency/connections/canva?canva_error=unknown', req.url))
  }
}
