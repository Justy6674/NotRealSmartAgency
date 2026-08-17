'use client'

import Image from 'next/image'
import { CheckCircle2, AlertCircle, LogOut, Settings2 } from 'lucide-react'
import {
  PLATFORM_BRAND_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'
import type { SocialAccount } from '@/hooks/useSocialAccounts'

interface AccountCardProps {
  account: SocialAccount
  onManage?: (accountId: string) => void
  onDisconnect?: (accountId: string) => void
}

/**
 * Per-account card rendered on the Accounts management page.
 *
 * Phase 9 of the Mixpost UI port — matches the feel of Mixpost's
 * Accounts/Accounts.vue but uses NRS oklch tokens + base-ui aesthetic.
 */
export function AccountCard({ account, onManage, onDisconnect }: AccountCardProps) {
  const platformKey = account.platform as PlatformKey
  const platformColour = PLATFORM_BRAND_COLOURS[platformKey] ?? '#6366f1'
  const platformLabel = PLATFORM_LABELS[platformKey] ?? account.platform

  const statusIcon =
    account.status === 'active'
      ? <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.55_0.15_145)]" />
      : <AlertCircle className="h-3.5 w-3.5 text-[oklch(0.55_0.2_25)]" />

  return (
    <div
      className="group relative rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
      style={{ borderLeftWidth: 3, borderLeftColor: platformColour }}
    >
      <div className="flex items-start gap-3">
        <div
          className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-muted"
          style={{ borderWidth: 2, borderStyle: 'solid', borderColor: platformColour }}
        >
          {account.image ? (
            <Image
              src={account.image}
              alt={account.name}
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-[14px] font-semibold"
              style={{ color: platformColour }}
            >
              {account.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: platformColour }}
            >
              {platformLabel}
            </span>
            {statusIcon}
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground truncate">{account.name}</h3>
            {account.is_zernio && (
              <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                SaaS Active
              </span>
            )}
          </div>
          {account.username && (
            <p className="text-[11px] text-muted-foreground truncate">@{account.username}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => onManage?.(account.id)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Manage per-account hashtags, mentions, and variables"
        >
          <Settings2 className="h-3 w-3" />
          Manage
        </button>
        <div className="flex-1" />
        {onDisconnect && (
          <button
            type="button"
            onClick={() => onDisconnect(account.id)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-[oklch(0.65_0.2_25/0.1)] hover:text-[oklch(0.65_0.2_25)] transition-colors"
            title="Disconnect this account"
          >
            <LogOut className="h-3 w-3" />
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}
