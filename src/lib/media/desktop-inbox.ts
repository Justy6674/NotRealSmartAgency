/** The brands intentionally available from the shared desktop media inbox. */
export const DESKTOP_INBOX_BRAND_SLUGS = ['scent-sell', 'downscale', 'do-today', 'endorseme'] as const

export type DesktopInboxBrandSlug = (typeof DESKTOP_INBOX_BRAND_SLUGS)[number]

export interface DesktopInboxBrand {
  id: string
  name: string
  slug: string
  user_id?: string
}

export interface TeamMembershipForUpload {
  role: string
  status: string
  brand_ids: string[] | null
}

export function isDesktopInboxBrandSlug(slug: string): slug is DesktopInboxBrandSlug {
  return (DESKTOP_INBOX_BRAND_SLUGS as readonly string[]).includes(slug)
}

export function desktopInboxDisplayName(brand: Pick<DesktopInboxBrand, 'name' | 'slug'>): string {
  return brand.slug === 'endorseme' ? 'Pathway to NP' : brand.name
}

/**
 * Team viewers can browse a library but cannot upload into it. Admins must
 * also be assigned this brand where their invitation is brand-scoped.
 */
export function canWriteDesktopInboxBrand(membership: TeamMembershipForUpload | null, brandId: string): boolean {
  if (!membership || membership.status !== 'accepted') return false
  if (membership.role !== 'owner' && membership.role !== 'admin') return false
  return membership.brand_ids === null || membership.brand_ids.includes(brandId)
}

/**
 * Keeps signed browser uploads separate from both public capability drops and
 * ordinary in-app uploads. The uploader id makes the completion claim specific
 * to the signed-in person who created the upload URL.
 */
export function desktopInboxStoragePrefix(input: { ownerUserId: string; brandId: string; uploaderUserId: string }): string {
  return `${input.ownerUserId}/${input.brandId}/desktop/${input.uploaderUserId}/`
}

export function buildDesktopInboxStoragePath(input: {
  ownerUserId: string
  brandId: string
  uploaderUserId: string
  uploadId: string
  fileName: string
  sanitizeFileName: (fileName: string) => string
}): string {
  return `${desktopInboxStoragePrefix(input)}${input.uploadId}_${input.sanitizeFileName(input.fileName)}`
}
