export const dynamic = 'force-dynamic'

import { AccountsPage } from '@/components/agency/studio/accounts/AccountsPage'

export default function SocialAccountsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AccountsPage />
    </div>
  )
}
