/**
 * Meta OAuth 2.0 callback — exchanges code for tokens.
 *
 * Flow:
 *  1. Exchange code for short-lived token
 *  2. Exchange short-lived for long-lived token (~60 days)
 *  3. Fetch connected Pages via /me/accounts
 *  4. For each Page, check for linked IG Business account
 *  5. Save tokens to social_oauth_tokens for both facebook + instagram
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { saveToken } from '@/lib/publishers/token-store'
import {
  BrandWorkspaceAccessError,
  resolveBrandWorkspaceContext,
} from '@/lib/auth/brand-workspace'
import { userSafeError } from '@/lib/errors/user-safe'

export const dynamic = 'force-dynamic'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'


/** "DownscaleDerm" and "Downscale-Derm (Brisbane)" name the same brand. */
function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Whether a Facebook Page belongs to the project the owner is connecting.
 *
 * Meta returns every Page the signed-in user administers. Filing all of them
 * under the connecting project let a Downscale weight-loss post publish to the
 * Man Clinic or Downscale-Derm Page, because the publisher then picked among
 * them by whichever row was touched last. Matching is bidirectional because a
 * Page is usually named slightly longer than the project.
 */
function pageBelongsToBrand(pageName: string, brandName: string): boolean {
  const page = normaliseName(pageName)
  const brand = normaliseName(brandName)
  if (!page || !brand) return false
  return page === brand || page.includes(brand) || brand.includes(page)
}

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

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('meta_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=Invalid+state+parameter`,
    )
  }

  // Clear the state cookie
  cookieStore.delete('meta_oauth_state')

  /*
   * Establish WHO is connecting, and that the project is theirs.
   *
   * The state cookie above is a CSRF check and nothing more: it proves the same
   * browser began the flow, because that browser set the cookie and chose the
   * state. It does not say whose account this is. `brandId` was then read
   * straight out of that same attacker-chosen blob and handed to the service
   * role — which bypasses RLS — so anyone could start a Meta flow, name someone
   * else's project in the state, finish with their own Facebook Page, and have
   * their tokens written onto that project. Every later publish for it would
   * have gone to their Page. /api/oauth/youtube/callback already authenticated
   * first; this route never did.
   */
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?redirect=${encodeURIComponent('/agency/studio/accounts')}`,
    )
  }

  let brandId: string
  try {
    ;({ brandId } = JSON.parse(state) as { brandId: string })
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=Invalid+state+parameter`,
    )
  }

  /*
   * Read through the session client, so the workspace rules decide. A project
   * belonging to anyone else is simply not found, which is the same answer as
   * one that does not exist — ids cannot be enumerated by asking.
   *
   * The project's NAME comes from this same read. It used to come from
   * `createAdminClient()`, which bypasses Row Level Security entirely: the
   * service role would fetch any tenant's project name for an attacker-chosen
   * uuid. There is no admin client in this file now, which is a stronger
   * position than having one behind a check.
   */
  let brandName: string
  try {
    const workspace = await resolveBrandWorkspaceContext<{
      id: string
      user_id: string
      name: string | null
    }>(supabase, user.id, brandId)
    brandName = workspace.brand.name ?? ''
  } catch (err) {
    if (err instanceof BrandWorkspaceAccessError) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=${encodeURIComponent('That project is not yours to connect')}`,
      )
    }
    throw err
  }

  const appId = process.env.META_APP_ID!
  const appSecret = process.env.META_APP_SECRET!
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI!

  try {
    // Step 1: Exchange code for short-lived token
    const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      throw new Error(`Token exchange failed: ${err}`)
    }
    const tokenData = await tokenRes.json()
    const shortLivedToken: string = tokenData.access_token

    // Step 2: Exchange for long-lived token
    const longLivedUrl = new URL(`${GRAPH_BASE}/oauth/access_token`)
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.set('client_id', appId)
    longLivedUrl.searchParams.set('client_secret', appSecret)
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken)

    const longLivedRes = await fetch(longLivedUrl.toString())
    if (!longLivedRes.ok) {
      const err = await longLivedRes.text()
      throw new Error(`Long-lived token exchange failed: ${err}`)
    }
    const longLivedData = await longLivedRes.json()
    const longLivedToken: string = longLivedData.access_token
    const expiresIn: number = longLivedData.expires_in ?? 5184000 // ~60 days

    // Step 3: Fetch connected Pages
    const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`)
    pagesUrl.searchParams.set('access_token', longLivedToken)
    pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account')

    const pagesRes = await fetch(pagesUrl.toString())
    if (!pagesRes.ok) {
      throw new Error('Failed to fetch Facebook Pages')
    }
    const pagesData = await pagesRes.json()
    const pages: Array<{
      id: string
      name: string
      access_token: string
      instagram_business_account?: { id: string }
    }> = pagesData.data ?? []

    if (pages.length === 0) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=No+Facebook+Pages+found`,
      )
    }

    const savedAccounts: string[] = []
    const skippedAccounts: string[] = []

    for (const page of pages) {
      // A Page that is not this project's is left unconnected rather than
      // filed here. Connect it from its own project instead.
      if (!brandName || !pageBelongsToBrand(page.name, brandName)) {
        skippedAccounts.push(page.name)
        continue
      }

      // Save Facebook Page token (each page has its own long-lived token)
      const fbExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

      await saveToken({
        brand_id: brandId,
        platform: 'facebook',
        account_id: page.id,
        account_name: page.name,
        access_token: page.access_token,
        refresh_token: page.access_token, // Meta uses token itself for refresh
        expires_at: fbExpiresAt,
        scopes: ['pages_manage_posts', 'pages_read_engagement'],
        status: 'active',
        last_refreshed_at: new Date().toISOString(),
        metadata: { page_id: page.id },
      })
      savedAccounts.push(`Facebook: ${page.name}`)

      // Step 4: Check for linked IG Business account
      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id

        // Fetch IG username
        const igInfoUrl = new URL(`${GRAPH_BASE}/${igId}`)
        igInfoUrl.searchParams.set('fields', 'username,name')
        igInfoUrl.searchParams.set('access_token', page.access_token)

        const igInfoRes = await fetch(igInfoUrl.toString())
        const igInfo = igInfoRes.ok
          ? await igInfoRes.json()
          : { username: igId, name: null }

        await saveToken({
          brand_id: brandId,
          platform: 'instagram',
          account_id: igId,
          account_name: igInfo.username ?? igInfo.name ?? igId,
          access_token: page.access_token, // IG uses the Page token
          refresh_token: page.access_token,
          expires_at: fbExpiresAt,
          scopes: ['instagram_basic', 'instagram_content_publish'],
          status: 'active',
          last_refreshed_at: new Date().toISOString(),
          metadata: {
            ig_user_id: igId,
            linked_page_id: page.id,
            linked_page_name: page.name,
          },
        })
        savedAccounts.push(`Instagram: @${igInfo.username ?? igId}`)
      }
    }

    // Say plainly what was skipped. Silently connecting nothing looks identical
    // to a broken sign-in, and the owner needs to know the other Pages are
    // connected from their own projects rather than here.
    const message = savedAccounts.length
      ? `Connected: ${savedAccounts.join(', ')}` +
        (skippedAccounts.length
          ? `. Not connected here (belongs to another project): ${skippedAccounts.join(', ')}`
          : '')
      : `No account matched this project. Skipped: ${skippedAccounts.join(', ')}. Connect each Page from its own project.`

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?${savedAccounts.length ? 'success' : 'error'}=${encodeURIComponent(message)}`,
    )
  } catch (error) {
    // This message is redirected into the browser's address bar, so it was
    // carrying raw Graph API bodies — upstream request detail, written for a
    // developer — where the owner reads it. The real one goes to the log.
    const msg = userSafeError(
      'oauth/meta/callback',
      error,
      'Those accounts could not be connected just now. Nothing has been changed. Try connecting them again from the accounts page.',
    )
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/agency/studio/accounts?error=${encodeURIComponent(msg)}`,
    )
  }
}
