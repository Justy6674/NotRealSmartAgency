/**
 * OAuth token storage for native publishers.
 *
 * Reads/writes the social_oauth_tokens table via the admin client
 * (service role — no RLS, used server-side only).
 *
 * For MVP, access_token is stored as plaintext. pgcrypto encryption
 * can be added in a follow-up hardening pass (encrypt on write,
 * decrypt on read via pgcrypto symmetric key in a Vault secret).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { OAuthToken, PublisherPlatform } from './types'

const REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 minutes before expiry

/**
 * Fetch the active token for a brand + platform.
 * Returns null if no active token exists.
 */
export async function getToken(
  brandId: string,
  platform: PublisherPlatform,
  accountId?: string,
): Promise<OAuthToken | null> {
  const supabase = createAdminClient()

  let query = supabase
    .from('social_oauth_tokens')
    .select('*')
    .eq('brand_id', brandId)
    .eq('platform', platform)
    .eq('status', 'active')

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error || !data?.length) return null

  // Previously this took the most recently updated row. With several accounts
  // on one platform for one project that is an arbitrary choice of destination,
  // and for a regulated health brand publishing to the wrong account is the
  // expensive kind of wrong. Ambiguity is refused rather than guessed; the
  // caller passes accountId to say which.
  if (data.length > 1 && !accountId) {
    console.error(
      `[token-store] ${data.length} active ${platform} accounts for project ${brandId} ` +
      `(${data.map((t) => (t as OAuthToken).account_name).join(', ')}). ` +
      'Refusing to choose — pass accountId.',
    )
    return null
  }

  return data[0] as OAuthToken
}

/**
 * Upsert a token (insert or update on conflict).
 */
export async function saveToken(
  token: Omit<OAuthToken, 'id' | 'created_at' | 'updated_at'>,
): Promise<OAuthToken | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('social_oauth_tokens')
    .upsert(
      {
        brand_id: token.brand_id,
        platform: token.platform,
        account_id: token.account_id,
        account_name: token.account_name,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        scopes: token.scopes,
        status: token.status,
        last_refreshed_at: token.last_refreshed_at,
        metadata: token.metadata,
      },
      { onConflict: 'brand_id,platform,account_id' },
    )
    .select()
    .single()

  if (error) {
    console.error('[token-store] saveToken error:', error.message)
    return null
  }

  return data as OAuthToken
}

/**
 * Check if a token needs refreshing and refresh it if a refresh_token
 * is available. Returns the (possibly refreshed) token or null on failure.
 *
 * Platform-specific refresh logic is injected via the refreshFn callback
 * so each publisher can implement its own token refresh endpoint.
 */
export async function refreshTokenIfNeeded(
  token: OAuthToken,
  refreshFn?: (
    refreshToken: string,
  ) => Promise<{
    access_token: string
    refresh_token?: string
    expires_in?: number
  } | null>,
): Promise<OAuthToken | null> {
  // No expiry set — token doesn't expire (e.g. long-lived tokens)
  if (!token.expires_at) return token

  const expiresAt = new Date(token.expires_at).getTime()
  const now = Date.now()

  // Still valid with buffer
  if (expiresAt - now > REFRESH_BUFFER_MS) return token

  // No refresh token or no refresh function — mark as expired
  if (!token.refresh_token || !refreshFn) {
    await markTokenExpired(token.id)
    return null
  }

  // Attempt refresh
  const refreshed = await refreshFn(token.refresh_token)
  if (!refreshed) {
    await markTokenExpired(token.id)
    return null
  }

  const expiresAtNew = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : token.expires_at

  return saveToken({
    ...token,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? token.refresh_token,
    expires_at: expiresAtNew,
    last_refreshed_at: new Date().toISOString(),
    status: 'active',
  })
}

/**
 * Mark a token as expired in the database.
 */
async function markTokenExpired(tokenId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('social_oauth_tokens')
    .update({ status: 'expired' })
    .eq('id', tokenId)
}
