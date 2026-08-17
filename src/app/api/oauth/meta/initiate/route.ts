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
 *   brandId — the project to link this account to. Checked against the session.
 *
 * Why the check is here and not only in the callback.
 *
 * This route took `brandId` from the query string, asked nobody who was calling,
 * and then MINTED the `meta_oauth_state` cookie for whatever brand it was given.
 * The callback then "verified" that the cookie matched the state parameter —
 * both halves of which this route had just written for the caller's chosen
 * brand. So the CSRF check proved the flow started in the same browser and
 * nothing else, and the full chain was: hit this URL with a victim's brand uuid,
 * log in with your OWN Facebook account, and the callback files your Page tokens
 * against their project. Every post that project published afterwards went to
 * your Page. /api/oauth/youtube/initiate one directory over already called
 * getUser first; this route never did.
 *
 * The brand is resolved through the workspace rules, so a project belonging to
 * anyone else simply is not found — the same answer as one that does not exist,
 * so ids cannot be enumerated by asking.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import {
  BrandWorkspaceAccessError,
  resolveBrandWorkspaceContext,
} from '@/lib/auth/brand-workspace'

export const dynamic = 'force-dynamic'

const META_SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',')

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'You are not signed in, so no connection was started. Sign in and try again.' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  try {
    await resolveBrandWorkspaceContext(supabase, user.id, brandId)
  } catch (err) {
    if (err instanceof BrandWorkspaceAccessError) {
      return NextResponse.json(
        {
          error:
            'That project could not be opened under this sign-in, so no connection was started. If it belongs to someone else’s workspace, it has to be connected from their account.',
        },
        { status: 403 },
      )
    }
    throw err
  }

  const appId = process.env.META_APP_ID
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: 'Meta OAuth not configured (missing META_APP_ID or META_OAUTH_REDIRECT_URI)' },
      { status: 500 },
    )
  }

  // Generate CSRF state token. It is a CSRF token and nothing more — the
  // callback checks the session again rather than believing this blob.
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
