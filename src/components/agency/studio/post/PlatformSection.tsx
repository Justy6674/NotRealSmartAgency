'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Twitter, Youtube, Music2, Check, type LucideIcon } from 'lucide-react'
import { useSocialAccounts, type SocialAccount } from '@/hooks/useSocialAccounts'
import { useAgencyStore } from '@/stores/agency-store'
import { PLATFORM_BRAND_COLOURS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import type { ContentType } from './ContentTypeSection'
import type { PostPlatform } from '@/types/database'

interface PlatformDef {
  value: PostPlatform
  label: string
  icon: LucideIcon
  compatibleTypes: ContentType[]
}

const PLATFORMS: PlatformDef[] = [
  {
    value: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    compatibleTypes: ['post', 'carousel', 'short_video', 'story', 'ad'],
  },
  {
    value: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    compatibleTypes: ['post', 'carousel', 'short_video', 'long_video', 'story', 'ad'],
  },
  {
    value: 'tiktok',
    label: 'TikTok',
    icon: Music2,
    compatibleTypes: ['post', 'short_video', 'ad'],
  },
  {
    value: 'youtube',
    label: 'YouTube',
    icon: Youtube,
    compatibleTypes: ['short_video', 'long_video', 'ad'],
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    compatibleTypes: ['post', 'carousel', 'long_video', 'ad'],
  },
  {
    value: 'twitter',
    label: 'X / Twitter',
    icon: Twitter,
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

function asPostPlatform(value: string): PostPlatform | null {
  return PLATFORMS.some((p) => p.value === value) ? (value as PostPlatform) : null
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

interface PlatformSectionProps {
  contentType: ContentType
  selected: PostPlatform[]
  onChange: (platforms: PostPlatform[]) => void
  selectedAccountIds?: string[]
  onAccountIdsChange?: (ids: string[]) => void
  onAccountsChange?: (accounts: SocialAccount[]) => void
  brandName?: string
}

export function PlatformSection({
  contentType,
  selected,
  onChange,
  selectedAccountIds = [],
  onAccountIdsChange,
  onAccountsChange,
  brandName,
}: PlatformSectionProps) {
  const { activeBrandId } = useAgencyStore()
  const { accounts, loading, error } = useSocialAccounts(activeBrandId)
  const seededFor = useRef<string | null>(null)

  useEffect(() => {
    onAccountsChange?.(accounts)
  }, [accounts, onAccountsChange])

  const compatibleIds = (list: SocialAccount[]) =>
    list
      .filter((account) => {
        const platform = asPostPlatform(canonicalSocialPlatform(account.platform))
        if (!platform) return false
        const def = PLATFORMS.find((p) => p.value === platform)
        return def?.compatibleTypes.includes(contentType) ?? false
      })
      .map((account) => account.id)

  useEffect(() => {
    if (!onAccountIdsChange || accounts.length === 0) return
    const key = `${activeBrandId}:${accounts.map((a) => a.id).join(',')}`
    if (seededFor.current === key) return
    seededFor.current = key
    const ids = compatibleIds(accounts)
    onAccountIdsChange(ids)
    const platforms = [...new Set(
      accounts
        .filter((a) => ids.includes(a.id))
        .map((a) => asPostPlatform(canonicalSocialPlatform(a.platform)))
        .filter((p): p is PostPlatform => p !== null),
    )]
    onChange(platforms)
    // Seed once per connected set. Re-running on contentType would fight Tick all / None.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, activeBrandId])

  const syncPlatformsFromIds = (ids: string[]) => {
    onAccountIdsChange?.(ids)
    const platforms = [...new Set(
      accounts
        .filter((a) => ids.includes(a.id))
        .map((a) => asPostPlatform(canonicalSocialPlatform(a.platform)))
        .filter((p): p is PostPlatform => p !== null),
    )]
    onChange(platforms)
  }

  const toggleAccount = (account: SocialAccount) => {
    if (!onAccountIdsChange) return
    const platform = asPostPlatform(canonicalSocialPlatform(account.platform))
    const def = PLATFORMS.find((p) => p.value === platform)
    if (def && !def.compatibleTypes.includes(contentType)) return
    const next = selectedAccountIds.includes(account.id)
      ? selectedAccountIds.filter((id) => id !== account.id)
      : [...selectedAccountIds, account.id]
    syncPlatformsFromIds(next)
  }

  const tickAll = () => syncPlatformsFromIds(compatibleIds(accounts))
  const tickNone = () => syncPlatformsFromIds([])

  if (loading && accounts.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
        Loading the accounts connected to this business…
      </p>
    )
  }

  if (error) {
    return (
      <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
        The connected accounts could not be read just now. Open Social accounts and try again.
      </p>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          No accounts are connected for this business yet, so there is nowhere to send this.
        </p>
        <Link
          href="/agency/social/accounts"
          className="inline-flex text-[12.5px] font-semibold"
          style={{ color: 'var(--brand-deep)' }}
        >
          Connect accounts
        </Link>
      </div>
    )
  }

  const ticked = selectedAccountIds.length
  const total = accounts.length
  const onlyLabel = brandName ? `${brandName} only` : 'This business only'

  return (
    <div
      className="overflow-hidden rounded-[12px] border px-[15px] py-[13px]"
      style={{
        borderColor: 'var(--line)',
        background: 'var(--panel)',
        boxShadow:
          '0 1px 2px oklch(0.2 0.02 240 / 0.05), 0 8px 24px -16px oklch(0.2 0.02 240 / 0.28)',
      }}
    >
      <div className="mb-[11px] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--ink-3)' }}
          >
            Post to
          </span>
          <span
            className="rounded-[5px] px-[6px] py-[2px] text-[10px] font-semibold tracking-[0.04em]"
            style={{
              background: 'var(--brand-wash)',
              color: 'var(--brand-deep)',
            }}
          >
            {onlyLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] font-semibold tabular-nums">
          <button
            type="button"
            onClick={tickAll}
            className="bg-transparent p-0 font-semibold"
            style={{ color: 'var(--brand-deep)' }}
          >
            Tick all
          </button>
          <button
            type="button"
            onClick={tickNone}
            className="bg-transparent p-0 font-semibold"
            style={{ color: 'var(--brand-deep)' }}
          >
            None
          </button>
          <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>
            {ticked} of {total} ticked
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-[9px]">
        {accounts.map((account) => {
          const platform = canonicalSocialPlatform(account.platform)
          const def = PLATFORMS.find((p) => p.value === platform)
          const compatible = def ? def.compatibleTypes.includes(contentType) : true
          const isTicked = selectedAccountIds.includes(account.id)
          const Icon = PLATFORM_ICON_MAP[platform] ?? Facebook
          const badge = PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? 'oklch(0.45 0.02 240)'
          const platformLabel = def?.label ?? platform
          return (
            <button
              key={account.id}
              type="button"
              disabled={!compatible}
              onClick={() => toggleAccount(account)}
              title={
                compatible
                  ? account.name
                  : `${platformLabel} does not take this kind of post`
              }
              className="flex max-w-full items-center gap-[9px] rounded-[10px] border px-[9px] py-[7px] text-left transition-colors duration-150 disabled:cursor-not-allowed"
              style={{
                opacity: compatible ? 1 : 0.45,
                borderColor: isTicked ? 'var(--brand)' : 'var(--line)',
                background: isTicked ? 'var(--brand-wash)' : 'var(--panel-2)',
              }}
            >
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-[11px]"
                style={{
                  borderColor: isTicked ? 'transparent' : 'var(--line)',
                  background: isTicked ? 'var(--brand-deep)' : 'var(--panel)',
                  color: isTicked ? 'var(--brand-ink)' : 'transparent',
                }}
              >
                {isTicked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              <span className="relative shrink-0">
                <span
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border text-[10.5px] font-semibold"
                  style={{
                    borderColor: 'var(--line)',
                    background: 'var(--panel)',
                    color: 'var(--ink-2)',
                  }}
                >
                  {account.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={account.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(account.name)
                  )}
                </span>
                <span
                  className="absolute -bottom-[3px] -right-[3px] flex h-4 w-4 items-center justify-center rounded-full border-2 text-white"
                  style={{ background: badge, borderColor: 'var(--panel)' }}
                >
                  <Icon className="h-[10px] w-[10px]" />
                </span>
              </span>
              <span className="min-w-0">
                <span
                  className="block truncate text-[12.5px] font-semibold"
                  style={{ color: isTicked ? 'var(--ink)' : 'var(--ink-2)' }}
                >
                  {account.name}
                </span>
                <span className="block truncate text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                  {platformLabel}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {selected.length === 0 && (
        <p className="mt-3 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          Tick one account, or Tick all, to choose where this goes.
        </p>
      )}
    </div>
  )
}

export { PLATFORMS }
