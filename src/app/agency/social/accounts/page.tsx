export const dynamic = 'force-dynamic'

import { AccountsPage } from '@/components/agency/studio/accounts/AccountsPage'

/**
 * The department shell owns the scrolling, padded pane. This page adds nothing
 * around the screen — a second scroller here is how the accounts grid ended up
 * with two scrollbars.
 */
export default function SocialAccountsPage() {
  return <AccountsPage padded={false} />
}
