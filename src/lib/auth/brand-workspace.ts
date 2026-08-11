import type { SupabaseClient } from '@supabase/supabase-js'

interface WorkspaceBrand {
  id: string
  user_id: string
}

interface WorkspaceMembership {
  owner_id: string
  role: string
  status: string
  brand_ids: string[] | null
}

export interface BrandWorkspaceIdentity {
  actorUserId: string
  workspaceOwnerId: string
  brandId: string
}

export class BrandWorkspaceAccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 = 403,
  ) {
    super(message)
    this.name = 'BrandWorkspaceAccessError'
  }
}

export function resolveBrandWorkspaceIdentity(input: {
  actorUserId: string
  brand: WorkspaceBrand
  membership: WorkspaceMembership | null
}): BrandWorkspaceIdentity {
  const { actorUserId, brand, membership } = input

  if (brand.user_id === actorUserId) {
    return { actorUserId, workspaceOwnerId: brand.user_id, brandId: brand.id }
  }

  const canWrite = membership?.owner_id === brand.user_id
    && membership.status === 'accepted'
    && (membership.role === 'owner' || membership.role === 'admin')
    && (membership.brand_ids === null || membership.brand_ids.includes(brand.id))

  if (!canWrite) {
    throw new BrandWorkspaceAccessError('You do not have permission to change this business.')
  }

  return { actorUserId, workspaceOwnerId: brand.user_id, brandId: brand.id }
}

export async function resolveBrandWorkspaceContext<TBrand extends WorkspaceBrand = WorkspaceBrand & Record<string, unknown>>(
  supabase: SupabaseClient,
  actorUserId: string,
  brandId: string,
): Promise<BrandWorkspaceIdentity & { brand: TBrand }> {
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    throw new BrandWorkspaceAccessError('Business not found.', 404)
  }

  let membership: WorkspaceMembership | null = null
  if (brand.user_id !== actorUserId) {
    const { data } = await supabase
      .from('team_members')
      .select('owner_id, role, status, brand_ids')
      .eq('owner_id', brand.user_id)
      .eq('member_id', actorUserId)
      .maybeSingle()
    membership = data
  }

  return {
    ...resolveBrandWorkspaceIdentity({ actorUserId, brand, membership }),
    brand: brand as TBrand,
  }
}
