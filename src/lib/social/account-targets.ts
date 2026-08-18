import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import type { PostPlatform } from '@/types/database'

interface AccountTarget {
  id: string
  platform: string
}

export function accountIdsForPlatform(
  selectedAccountIds: string[],
  accounts: AccountTarget[],
  platform: PostPlatform,
): string[] {
  const selected = new Set(selectedAccountIds)
  return accounts
    .filter(
      (account) =>
        selected.has(account.id) &&
        canonicalSocialPlatform(account.platform) === platform,
    )
    .map((account) => account.id)
}
