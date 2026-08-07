/**
 * Which projects a given Telegram account may work on.
 *
 * The grants belong to the NRS account. This fence belongs to the Telegram
 * user, and does two jobs at once:
 *
 *   1. it limits a second person to named brands, and
 *   2. it is the owner's own on/off switch for which projects appear in
 *      Telegram at all — fourteen in a picker is a list nobody reads.
 *
 * It exists in one place because it has to hold on EVERY Telegram surface.
 * When it lived only in the webhook, the Mini App — the surface that actually
 * receives traffic — showed every project to everyone.
 */

export interface FenceableGrant {
  projectId: string
}

/**
 * Null or empty means no fence: every granted project, which is what an
 * account with no explicit list has always done.
 */
export function readBrandFence(allowedBrandIds: unknown): Set<string> | null {
  if (!Array.isArray(allowedBrandIds) || allowedBrandIds.length === 0) return null
  const ids = allowedBrandIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return ids.length > 0 ? new Set(ids) : null
}

export function applyBrandFence<T extends FenceableGrant>(
  grants: readonly T[],
  allowedBrandIds: unknown,
): T[] {
  const fence = readBrandFence(allowedBrandIds)
  if (!fence) return [...grants]
  return grants.filter((grant) => fence.has(grant.projectId))
}

/**
 * Whether one project is reachable by this account.
 *
 * Checked on the way IN as well as on the way out: a project id arriving from
 * a client must be tested against the fence, not merely absent from a list the
 * client was shown.
 */
export function fenceAllows(allowedBrandIds: unknown, projectId: string): boolean {
  const fence = readBrandFence(allowedBrandIds)
  return fence ? fence.has(projectId) : true
}
