import { createAdminClient } from '@/lib/supabase/admin'
import {
  createMcpPrincipal,
  type McpPrincipal,
  type ProjectCapability,
} from '@/lib/security/project-access'

interface ApiKeyRecord {
  id: string
  user_id: string
}

export interface ScopedGrantRow {
  id: string
  brand_id: string
  channel: string
  status: string
  revoked_at: string | null
  expires_at: string | null
  capabilities: string[] | null
}

export const DEFAULT_MCP_CAPABILITIES: readonly ProjectCapability[] = Object.freeze([
  'director:chat',
  'draft:post',
  'direct:read',
  'direct:utility',
])

/**
 * Convert only live MCP grants into the identity used by every MCP tool.
 * A user ID alone is deliberately not enough to access a project.
 */
export function toScopedMcpPrincipal(
  key: ApiKeyRecord,
  grants: readonly ScopedGrantRow[],
  now = new Date(),
): McpPrincipal | null {
  const liveGrants = grants.filter((grant) => {
    const expired = grant.expires_at ? new Date(grant.expires_at) <= now : false
    return grant.channel === 'mcp' && grant.status === 'active' && !grant.revoked_at && !expired
  })

  if (liveGrants.length === 0) return null

  return createMcpPrincipal({
    userId: key.user_id,
    keyId: key.id,
    grants: liveGrants.map((grant) => ({
      grantId: grant.id,
      projectId: grant.brand_id,
      capabilities: (grant.capabilities ?? []) as ProjectCapability[],
    })),
  })
}

/**
 * Issue an MCP access key bound to a caller-approved project set. The caller
 * must verify project visibility before invoking this service; this function
 * never infers a grant from ownership or a project name.
 */
export async function issueScopedMcpAccessKey(input: {
  userId: string
  projectIds: readonly string[]
  name: string
  parentKeyId?: string | null
}): Promise<{ id: string; raw: string; prefix: string }> {
  const projectIds = [...new Set(input.projectIds)]
  if (projectIds.length === 0) {
    throw new Error('Select at least one project for this MCP connection.')
  }

  const supabase = createAdminClient()
  const { raw, hash, prefix } = generateApiKey()
  const keyHash = await hash
  const { data: key, error: keyError } = await supabase
    .from('api_keys')
    .insert({
      user_id: input.userId,
      name: input.name.slice(0, 100),
      prefix,
      key_hash: keyHash,
      token_kind: 'access',
      parent_key_id: input.parentKeyId ?? null,
      policy_version: 1,
    })
    .select('id')
    .single()

  if (keyError || !key) {
    throw new Error('Could not create the MCP access key.')
  }

  try {
    const { error: grantError } = await supabase
      .from('project_access_grants')
      .upsert(
        projectIds.map((brandId) => ({
          actor_user_id: input.userId,
          brand_id: brandId,
          channel: 'mcp',
          capabilities: [...DEFAULT_MCP_CAPABILITIES],
          status: 'active',
          revoked_at: null,
          created_by: input.userId,
        })),
        { onConflict: 'actor_user_id,brand_id,channel' },
      )

    if (grantError) throw new Error('Could not create the project grants.')

    const { data: grants, error: grantsError } = await supabase
      .from('project_access_grants')
      .select('id, brand_id')
      .eq('actor_user_id', input.userId)
      .eq('channel', 'mcp')
      .eq('status', 'active')
      .in('brand_id', projectIds)

    if (grantsError || !grants || grants.length !== projectIds.length) {
      throw new Error('Could not verify the project grants.')
    }

    const { error: mappingError } = await supabase
      .from('api_key_project_grants')
      .insert(grants.map((grant) => ({
        api_key_id: key.id,
        project_access_grant_id: grant.id,
      })))

    if (mappingError) throw new Error('Could not bind the MCP key to its project grants.')
  } catch (error) {
    await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', key.id)
    throw error
  }

  return { id: key.id, raw, prefix }
}

export async function issueRefreshToken(input: {
  userId: string
  name: string
  parentKeyId: string
}): Promise<{ id: string; raw: string; prefix: string }> {
  const { raw, hash, prefix } = generateApiKey()
  const keyHash = await hash
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: input.userId,
      name: input.name.slice(0, 100),
      prefix,
      key_hash: keyHash,
      token_kind: 'refresh',
      parent_key_id: input.parentKeyId,
      policy_version: 1,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error('Could not create the refresh token.')
  return { id: data.id, raw, prefix }
}

/**
 * Resolve a Bearer token to a user ID.
 * Tokens are nrs_sk_ + 32 hex chars. Only the SHA-256 hash is stored.
 */
export async function resolveApiKey(
  bearerToken: string
): Promise<McpPrincipal | null> {
  if (!bearerToken.startsWith('nrs_sk_')) return null

  const hash = await hashKey(bearerToken)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .eq('token_kind', 'access')
    .single()

  if (error || !data) return null

  const key = data as ApiKeyRecord
  const { data: keyGrants, error: keyGrantError } = await supabase
    .from('api_key_project_grants')
    .select('project_access_grant_id')
    .eq('api_key_id', key.id)

  if (keyGrantError || !keyGrants?.length) return null

  const grantIds = keyGrants.map((grant) => grant.project_access_grant_id)
  const { data: grants, error: grantsError } = await supabase
    .from('project_access_grants')
    .select('id, brand_id, channel, status, revoked_at, expires_at, capabilities')
    .in('id', grantIds)

  if (grantsError || !grants) return null

  const principal = toScopedMcpPrincipal(key, grants as ScopedGrantRow[])
  if (!principal) return null

  // Update last_used_at (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id)
    .then(() => {})

  return principal
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
