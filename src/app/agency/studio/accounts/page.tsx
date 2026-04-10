import { AccountsPage } from '@/components/agency/studio/accounts/AccountsPage'

// force-dynamic because AccountsPage uses base-ui primitives + the
// zustand store + Mixpost API calls — all client-side state that
// can't be statically prerendered.
export const dynamic = 'force-dynamic'

export default function StudioAccountsRoute() {
  return <AccountsPage />
}
