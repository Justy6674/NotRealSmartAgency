import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'
import type { BoardAccountInput } from '@/lib/macro/board'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import { brandIsPublisherLinked, ownerFacingAccounts } from './social-read-source'
import { zernioProfileIdFromSocialUrls } from './overview-accounts'

export interface OwnerFacingBrandStub {
  id: string
  name: string
  slug: string
  social_urls?: unknown
}

/**
 * Connected-account chips for many brands at once.
 *
 * A linked brand is answered only from its own publisher list (filtered
 * after normaliseAccount — never trust the vendor's profileId query).
 * An unlinked brand keeps the brand-mapped workspace subset. The two
 * are never merged, even when the linked list is empty.
 *
 * Returns null when no source answered, so callers can say "not known"
 * instead of "none connected".
 */
export async function loadOwnerFacingBoardAccounts(
  brands: OwnerFacingBrandStub[],
): Promise<BoardAccountInput[] | null> {
  if (brands.length === 0) return []

  const linked = brands.filter((b) => brandIsPublisherLinked(b.social_urls))
  const unlinked = brands.filter((b) => !brandIsPublisherLinked(b.social_urls))

  const rows: BoardAccountInput[] = []
  let anySource = false

  if (linked.length > 0) {
    if (!process.env.ZERNIO_API_KEY) {
      // Linked brands stay empty rather than falling through to the workspace.
    } else {
      const seen = new Set<string>()
      for (const brand of linked) {
        const profileId = zernioProfileIdFromSocialUrls(brand.social_urls)
        if (!profileId || seen.has(profileId)) continue
        seen.add(profileId)
        const accounts = await fetchZernioAccounts(profileId)
        anySource = true
        const mine = brands.filter(
          (b) => zernioProfileIdFromSocialUrls(b.social_urls) === profileId,
        )
        for (const owner of mine) {
          const scoped = ownerFacingAccounts({
            linked: true,
            linkedAccounts: accounts,
            mixpostBrandAccounts: [],
          })
          for (const account of scoped) {
            rows.push({
              brandId: owner.id,
              accountName: account.displayName || account.username || account.platform,
              authorized: true,
            })
          }
        }
      }
    }
  }

  if (unlinked.length > 0) {
    const mixpost = await fetchMixpostAccounts()
    if (mixpost) {
      anySource = true
      const mapped = mapMixpostAccountsToBrands(
        mixpost,
        unlinked.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          social_urls: (b.social_urls ?? {}) as Record<string, string>,
        })),
      )
      for (const brand of unlinked) {
        const subset = ownerFacingAccounts({
          linked: false,
          linkedAccounts: [],
          mixpostBrandAccounts: mapped[brand.id] ?? [],
        })
        for (const account of subset) {
          rows.push({
            brandId: brand.id,
            accountName: account.accountName,
            authorized: account.authorized !== false,
          })
        }
      }
    }
  }

  if (!anySource && (linked.length > 0 || unlinked.length > 0)) return null
  return rows
}
