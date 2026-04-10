'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Loader2 } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useSocialAccounts, type SocialAccount } from '@/hooks/useSocialAccounts'
import { AccountCard } from './AccountCard'
import { AccountEntitiesEditor } from './AccountEntitiesEditor'
import { ConnectAccountDialog } from './ConnectAccountDialog'

/**
 * Accounts management page — native NRS replacement for Mixpost's
 * Accounts/Accounts.vue.
 *
 * Phase 9 of the Mixpost UI port. Reads accounts via the shared
 * `useSocialAccounts` hook (Mixpost-backed for now, native-backed
 * after Phase 10).
 */
export function AccountsPage() {
  const { activeBrandId } = useAgencyStore()
  const { accounts, loading, error, refetch } = useSocialAccounts(activeBrandId)
  const [managingAccount, setManagingAccount] = useState<SocialAccount | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Select a brand first to view its connected accounts.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Connected accounts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Social accounts connected to this brand. Manage per-account hashtags, mentions, and variables that get injected into every post.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={refetch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Connect account
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[oklch(0.65_0.2_25/0.3)] bg-[oklch(0.65_0.2_25/0.08)] px-4 py-3 text-xs text-[oklch(0.55_0.2_25)]">
          Could not load accounts: {error}
        </div>
      )}

      {loading && accounts.length === 0 && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !error && accounts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
          <p className="text-sm text-foreground font-medium mb-1">No accounts connected yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Connect an Instagram, Facebook, LinkedIn, TikTok, or YouTube account to start publishing from this brand.
          </p>
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect your first account
          </button>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((account: SocialAccount) => (
            <AccountCard
              key={account.id}
              account={account}
              onManage={() => setManagingAccount(account)}
            />
          ))}
        </div>
      )}

      {managingAccount && (
        <AccountEntitiesEditor
          brandId={activeBrandId}
          account={managingAccount}
          onClose={() => setManagingAccount(null)}
        />
      )}

      {connectOpen && (
        <ConnectAccountDialog onClose={() => setConnectOpen(false)} onRefresh={refetch} />
      )}
    </div>
  )
}
