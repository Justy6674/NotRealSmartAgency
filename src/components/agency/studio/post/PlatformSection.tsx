'use client'

import { Instagram, Facebook, Linkedin, Twitter, Youtube, Music2, Check, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSocialAccounts, type SocialAccount } from '@/hooks/useSocialAccounts'
import { useAgencyStore } from '@/stores/agency-store'
import { PLATFORM_BRAND_COLOURS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import type { ContentType } from './ContentTypeSection'
import type { PostPlatform } from '@/types/database'

interface PlatformDef {
  value: PostPlatform
  label: string
  icon: LucideIcon
  colour: string
  selectedBg: string
  charLimit: number
  formats: string
  compatibleTypes: ContentType[]
}

const PLATFORMS: PlatformDef[] = [
  {
    value: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    colour: 'text-pink-400',
    selectedBg: 'border-pink-400 bg-pink-400/10',
    charLimit: 2200,
    formats: '1:1, 4:5, 9:16',
    compatibleTypes: ['post', 'carousel', 'short_video', 'story', 'ad'],
  },
  {
    value: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    colour: 'text-blue-400',
    selectedBg: 'border-blue-400 bg-blue-400/10',
    charLimit: 63206,
    formats: '1:1, 16:9, 9:16',
    compatibleTypes: ['post', 'carousel', 'short_video', 'long_video', 'story', 'ad'],
  },
  {
    value: 'tiktok',
    label: 'TikTok',
    icon: Music2,
    colour: 'text-cyan-400',
    selectedBg: 'border-cyan-400 bg-cyan-400/10',
    charLimit: 2200,
    formats: '9:16',
    compatibleTypes: ['post', 'short_video', 'ad'],
  },
  {
    value: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    colour: 'text-red-400',
    selectedBg: 'border-red-400 bg-red-400/10',
    charLimit: 5000,
    formats: '16:9, 9:16 (Shorts)',
    compatibleTypes: ['short_video', 'long_video', 'ad'],
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    colour: 'text-sky-400',
    selectedBg: 'border-sky-400 bg-sky-400/10',
    charLimit: 3000,
    formats: '1:1, 16:9',
    compatibleTypes: ['post', 'carousel', 'long_video', 'ad'],
  },
  {
    value: 'twitter',
    label: 'X / Twitter',
    icon: Twitter,
    colour: 'text-zinc-400',
    selectedBg: 'border-zinc-400 bg-zinc-400/10',
    charLimit: 280,
    formats: '16:9, 1:1',
    compatibleTypes: ['post', 'short_video', 'ad'],
  },
]

const PLATFORM_ICON_MAP: Record<string, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
  tiktok: Music2,
}

interface PlatformSectionProps {
  contentType: ContentType
  selected: PostPlatform[]
  onChange: (platforms: PostPlatform[]) => void
  /** Optional: selected Mixpost account IDs for multi-account publishing */
  selectedAccountIds?: string[]
  onAccountIdsChange?: (ids: string[]) => void
}

export function PlatformSection({
  contentType,
  selected,
  onChange,
  selectedAccountIds = [],
  onAccountIdsChange,
}: PlatformSectionProps) {
  const { activeBrandId } = useAgencyStore()
  const { accounts } = useSocialAccounts(activeBrandId)

  const togglePlatform = (platform: PostPlatform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter(p => p !== platform))
      // Also deselect accounts for this platform
      if (onAccountIdsChange) {
        const platformAccounts = accounts.filter(a => a.platform === platform)
        const platformAccountIds = new Set(platformAccounts.map(a => a.id))
        onAccountIdsChange(selectedAccountIds.filter(id => !platformAccountIds.has(id)))
      }
    } else {
      onChange([...selected, platform])
      // Auto-select all accounts for this platform
      if (onAccountIdsChange) {
        const platformAccounts = accounts.filter(a => a.platform === platform)
        const newIds = platformAccounts.map(a => a.id).filter(id => !selectedAccountIds.includes(id))
        onAccountIdsChange([...selectedAccountIds, ...newIds])
      }
    }
  }

  const toggleAccount = (account: SocialAccount) => {
    if (!onAccountIdsChange) return
    const platform = account.platform as PostPlatform
    if (selectedAccountIds.includes(account.id)) {
      const next = selectedAccountIds.filter(id => id !== account.id)
      onAccountIdsChange(next)
      // If no accounts left for this platform, deselect the platform too
      const remaining = accounts.filter(a => a.platform === platform && next.includes(a.id))
      if (remaining.length === 0) {
        onChange(selected.filter(p => p !== platform))
      }
    } else {
      onAccountIdsChange([...selectedAccountIds, account.id])
      // Ensure platform is selected
      if (!selected.includes(platform)) {
        onChange([...selected, platform])
      }
    }
  }

  // Group connected accounts by platform
  const accountsByPlatform: Record<string, SocialAccount[]> = {}
  for (const account of accounts) {
    const p = account.platform
    if (!accountsByPlatform[p]) accountsByPlatform[p] = []
    accountsByPlatform[p].push(account)
  }

  // Check if any platform has multiple accounts (show account-level picker)
  const hasMultiAccount = Object.values(accountsByPlatform).some(arr => arr.length > 1)

  const selectedDefs = PLATFORMS.filter(p => selected.includes(p.value))

  return (
    <div className="space-y-3">
      {/* Platform pill row */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map(p => {
          const Icon = p.icon
          const isCompatible = p.compatibleTypes.includes(contentType)
          const isSelected = selected.includes(p.value)
          const connectedCount = accountsByPlatform[p.value]?.length ?? 0
          return (
            <button
              key={p.value}
              type="button"
              disabled={!isCompatible || connectedCount === 0}
              onClick={() => togglePlatform(p.value)}
              title={connectedCount === 0 ? `No ${p.label} account connected` : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition-all',
                connectedCount === 0 && 'opacity-25 cursor-not-allowed border-border text-muted-foreground',
                !isCompatible && connectedCount > 0 && 'opacity-25 cursor-not-allowed border-border text-muted-foreground',
                isCompatible && connectedCount > 0 && !isSelected && 'border-border text-foreground/80 hover:border-primary/50',
                isCompatible && connectedCount > 0 && isSelected && p.selectedBg,
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-foreground' : p.colour)} />
              {p.label}
              {connectedCount > 1 && (
                <span className="text-[10px] text-muted-foreground">({connectedCount})</span>
              )}
              {isSelected && <Check className="h-3 w-3 text-foreground ml-0.5" />}
            </button>
          )
        })}
      </div>

      {/* Per-account selection — shown when a selected platform has multiple accounts */}
      {hasMultiAccount && selected.length > 0 && onAccountIdsChange && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Select accounts to publish to
          </p>
          {selected.map(platform => {
            const platformAccounts = accountsByPlatform[platform]
            if (!platformAccounts || platformAccounts.length <= 1) return null
            const colour = PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? '#888'
            return (
              <div key={platform} className="space-y-1">
                {platformAccounts.map(account => {
                  const isChecked = selectedAccountIds.includes(account.id)
                  return (
                    <label
                      key={account.id}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 cursor-pointer transition-colors',
                        isChecked ? 'bg-primary/5' : 'hover:bg-muted',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAccount(account)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      {account.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={account.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: colour }}
                        >
                          {account.name.charAt(0)}
                        </span>
                      )}
                      <span className="text-xs text-foreground">{account.name}</span>
                      {account.username && (
                        <span className="text-[10px] text-muted-foreground">@{account.username}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {selectedDefs.length > 0 && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {selectedDefs.map((p, i) => (
            <span key={p.value}>
              {i > 0 && ' + '}
              <span className="font-medium text-foreground/70">{p.label}</span>
              {' '}({p.charLimit.toLocaleString()} chars, {p.formats})
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

export { PLATFORMS }
