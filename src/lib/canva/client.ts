import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'
const REFRESH_LEASE_MS = 30_000
const LEASE_WAIT_ATTEMPTS = 5

export interface CanvaIntegration {
  id: string
  cachedData: Record<string, unknown>
  refreshVersion: number
}

export type CanvaHealthState = 'ready' | 'not_connected' | 'expired' | 'unavailable'

function cachedString(cached: Record<string, unknown>, key: string): string | null {
  const value = cached[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getCanvaIntegration(
  supabase: SupabaseClient,
  userId: string,
): Promise<CanvaIntegration | null> {
  const { data, error } = await supabase
    .from('user_integrations')
    .select('id, cached_data, refresh_version')
    .eq('user_id', userId)
    .eq('provider', 'canva')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data?.id) return null
  return {
    id: data.id as string,
    cachedData: (data.cached_data ?? {}) as Record<string, unknown>,
    refreshVersion: Number(data.refresh_version ?? 0),
  }
}

/** Persist only redacted connection state. OAuth credentials never enter health rows. */
export async function recordCanvaHealth(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string | null,
  state: CanvaHealthState,
  errorCode?: string,
): Promise<void> {
  const checkedAt = new Date().toISOString()

  if (integrationId) {
    const update: Record<string, unknown> = {
      last_error_code: errorCode ?? null,
      last_error_at: errorCode ? checkedAt : null,
    }
    // A failure now should not erase the timestamp of the last independently
    // successful Canva probe. That history is what distinguishes "was healthy
    // five minutes ago" from "has never worked" in Settings.
    if (state === 'ready') update.last_verified_at = checkedAt
    await supabase
      .from('user_integrations')
      .update(update)
      .eq('id', integrationId)
      .eq('user_id', userId)
      .eq('provider', 'canva')
  }

  // Best effort: a status check must never fail because a history insert did.
  try {
    const { error } = await supabase.from('connection_health_events').insert({
      integration_id: integrationId,
      user_id: userId,
      provider: 'canva',
      state,
      ...(errorCode ? { error_code: errorCode } : {}),
    })
    if (error) console.error('[canva] Health event write failed:', error.message)
  } catch (error) {
    console.error('[canva] Health event write failed:', error)
  }
}

async function waitForLeaseHolder(
  supabase: SupabaseClient,
  userId: string,
  previousToken: string | null,
  previousRefreshVersion: number,
): Promise<string | null> {
  for (let attempt = 0; attempt < LEASE_WAIT_ATTEMPTS; attempt++) {
    await delay(120 * (attempt + 1))
    const integration = await getCanvaIntegration(supabase, userId)
    const token = integration ? cachedString(integration.cachedData, 'api_key') : null
    if (integration && token && (token !== previousToken || integration.refreshVersion > previousRefreshVersion)) return token
  }
  return null
}

/**
 * Refresh Canva OAuth once for a user. The database lease prevents two web
 * requests from rotating the same refresh token simultaneously. A follower
 * waits for the lease holder's replacement token instead of refreshing again.
 */
export async function refreshCanvaToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const integration = await getCanvaIntegration(supabase, userId)
  if (!integration) return null

  const previousToken = cachedString(integration.cachedData, 'api_key')
  const refreshToken = cachedString(integration.cachedData, 'refresh_token')
  if (!refreshToken) {
    await recordCanvaHealth(supabase, userId, integration.id, 'expired', 'refresh_token_missing')
    return null
  }

  const leaseId = randomUUID()
  const leaseUntil = new Date(Date.now() + REFRESH_LEASE_MS).toISOString()
  const now = new Date().toISOString()
  const { data: leased, error: leaseError } = await supabase
    .from('user_integrations')
    .update({ refresh_lease_id: leaseId, refresh_lease_until: leaseUntil })
    .eq('id', integration.id)
    .eq('user_id', userId)
    .eq('provider', 'canva')
    .or(`refresh_lease_until.is.null,refresh_lease_until.lt.${now}`)
    .select('id')
    .maybeSingle()

  if (leaseError) {
    console.error('[canva] Refresh lease failed:', leaseError.message)
    await recordCanvaHealth(supabase, userId, integration.id, 'unavailable', 'refresh_lease_error')
    return null
  }
  if (!leased) return waitForLeaseHolder(supabase, userId, previousToken, integration.refreshVersion)

  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    await releaseRefreshLease(supabase, integration.id, userId, leaseId, {
      last_error_code: 'oauth_client_not_configured',
      last_error_at: new Date().toISOString(),
    })
    await recordCanvaHealth(supabase, userId, integration.id, 'expired', 'oauth_client_not_configured')
    return null
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const res = await fetch(`${CANVA_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })

    if (!res.ok) {
      console.error('[canva] Token refresh failed:', res.status)
      const code = res.status === 401 || res.status === 403 ? 'refresh_rejected' : `refresh_http_${res.status}`
      await releaseRefreshLease(supabase, integration.id, userId, leaseId, {
        last_error_code: code,
        last_error_at: new Date().toISOString(),
      })
      await recordCanvaHealth(supabase, userId, integration.id, res.status >= 500 ? 'unavailable' : 'expired', code)
      return null
    }

    const data = await res.json() as Record<string, unknown>
    const accessToken = typeof data.access_token === 'string' ? data.access_token : null
    if (!accessToken) {
      await releaseRefreshLease(supabase, integration.id, userId, leaseId, {
        last_error_code: 'refresh_response_invalid',
        last_error_at: new Date().toISOString(),
      })
      await recordCanvaHealth(supabase, userId, integration.id, 'expired', 'refresh_response_invalid')
      return null
    }

    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
    const nextCachedData = {
      ...integration.cachedData,
      api_key: accessToken,
      refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      token_type: 'oauth',
    }
    const { error: saveError } = await supabase
      .from('user_integrations')
      .update({
        cached_data: nextCachedData,
        last_refresh_at: new Date().toISOString(),
        last_error_code: null,
        last_error_at: null,
        refresh_lease_id: null,
        refresh_lease_until: null,
        refresh_version: integration.refreshVersion + 1,
      })
      .eq('id', integration.id)
      .eq('user_id', userId)
      .eq('refresh_lease_id', leaseId)

    if (saveError) {
      console.error('[canva] Refreshed token could not be saved:', saveError.message)
      await releaseRefreshLease(supabase, integration.id, userId, leaseId, {
        last_error_code: 'refresh_save_failed',
        last_error_at: new Date().toISOString(),
      })
      await recordCanvaHealth(supabase, userId, integration.id, 'unavailable', 'refresh_save_failed')
      return null
    }

    return accessToken
  } catch (error) {
    console.error('[canva] Token refresh transport error:', error)
    await releaseRefreshLease(supabase, integration.id, userId, leaseId, {
      last_error_code: 'refresh_transport_error',
      last_error_at: new Date().toISOString(),
    })
    await recordCanvaHealth(supabase, userId, integration.id, 'unavailable', 'refresh_transport_error')
    return null
  }
}

async function releaseRefreshLease(
  supabase: SupabaseClient,
  integrationId: string,
  userId: string,
  leaseId: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await supabase
    .from('user_integrations')
    .update({ refresh_lease_id: null, refresh_lease_until: null, ...extra })
    .eq('id', integrationId)
    .eq('user_id', userId)
    .eq('refresh_lease_id', leaseId)
}

/** Get a token without ever treating a legacy environment key as Canva Connect. */
export async function getCanvaToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const integration = await getCanvaIntegration(supabase, userId)
  if (!integration) return null

  const token = cachedString(integration.cachedData, 'api_key')
  const expiresAt = cachedString(integration.cachedData, 'expires_at')
  const expiresSoon = expiresAt ? new Date(expiresAt).getTime() < Date.now() + 60_000 : false
  if (token && !expiresSoon) return token
  return refreshCanvaToken(supabase, userId)
}

/** Make an authenticated Canva REST request. */
export async function canvaFetch(token: string, path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${CANVA_API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Canva no longer accepts this sign-in. Reconnect Canva in NRS Settings before continuing.')
    }
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`Canva API error (${res.status}): ${String(err.message ?? err.code ?? 'Unknown error')}`)
  }
  return res
}

export function isCanvaConfigured(token: string | null): boolean {
  return token !== null
}
