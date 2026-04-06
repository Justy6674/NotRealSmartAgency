import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Resolve a Bearer token to a user ID.
 * Tokens are nrs_sk_ + 32 hex chars. Only the SHA-256 hash is stored.
 */
export async function resolveApiKey(
  bearerToken: string
): Promise<{ userId: string } | null> {
  if (!bearerToken.startsWith('nrs_sk_')) return null

  const hash = await hashKey(bearerToken)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .single()

  if (error || !data) return null

  // Update last_used_at (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { userId: data.user_id }
}

/**
 * Generate a new API key. Returns the raw key (show once) and the hash (store).
 */
export function generateApiKey(): { raw: string; hash: Promise<string>; prefix: string } {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const raw = `nrs_sk_${hex}`
  const prefix = raw.slice(0, 12)
  return { raw, hash: hashKey(raw), prefix }
}

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key)
  const buffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
