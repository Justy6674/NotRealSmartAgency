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

function handleLabel(account: SocialAccount): string {
  const handle = account.username?.replace(/^@/, '') ?? account.name
  return handle.length > 12 ? `${handle.slice(0, 11)}…` : handle
}

interface PlatformSectionProps {
  contentType: ContentType
  selected: PostPlatform[]
  onChange: (platforms: PostPlatform[]) => void
  selectedAccountIds?: string[]
  onAccountIdsChange?: (ids: string[]) => void
  brandName?: string
}

export function PlatformSection({
  contentType,
  selected,
  onChange,
  selectedAccountIds = [],
  onAccountIdsChange,
  brandName,
}: PlatformSectionProps) {
  const { activeBrandId } = useAgencyStore()
  const { accounts, loading, error } = useSocialAccounts(activeBrandId)
  const seededFor = useRef<string | null>(null)

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
      className="rounded-[14px] border p-3.5"
      style={{
        borderColor: 'var(--line)',
        background: 'var(--panel)',
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--ink-3)' }}
          >
            Post to
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
            style={{
              background: 'var(--brand-wash)',
              color: 'var(--brand-deep)',
            }}
          >
            {onlyLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] font-semibold">
          <button
            type="button"
            onClick={tickAll}
            className="bg-transparent p-0"
            style={{ color: 'var(--brand-deep)' }}
          >
            Tick all
          </button>
          <button
            type="button"
            onClick={tickNone}
            className="bg-transparent p-0"
            style={{ color: 'var(--brand-deep)' }}
          >
            None
          </button>
          <span style={{ color: 'var(--brand-deep)' }}>
            {ticked} of {total} ticked
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {accounts.map((account) => {
          const platform = canonicalSocialPlatform(account.platform)
          const def = PLATFORMS.find((p) => p.value === platform)
          const compatible = def ? def.compatibleTypes.includes(contentType) : true
          const isTicked = selectedAccountIds.includes(account.id)
          const Icon = PLATFORM_ICON_MAP[platform] ?? Facebook
          const badge = PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? 'oklch(0.45 0.02 240)'
          return (
            <button
              key={account.id}
              type="button"
              disabled={!compatible}
              onClick={() => toggleAccount(account)}
              title={
                compatible
                  ? account.name
                  : `${def?.label ?? platform} does not take this kind of post`
              }
              className="flex w-[72px] flex-col items-center gap-1.5 bg-transparent p-0 disabled:cursor-not-allowed"
              style={{ opacity: compatible ? 1 : 0.35 }}
            >
              <span className="relative">
                <span
                  className="flex size-[52px] items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold"
                  style={{
                    background: 'var(--panel-2)',
                    color: 'var(--ink)',
                    boxShadow: isTicked ? '0 0 0 3px var(--brand)' : '0 0 0 1px var(--line)',
                    filter: isTicked ? 'none' : 'grayscale(0.35)',
                  }}
                >
                  {account.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={account.image} alt="" className="size-full object-cover" />
                  ) : (
                    initials(account.name)
                  )}
                </span>
                {isTicked && (
                  <span
                    className="absolute -left-0.5 -top-0.5 flex size-[16px] items-center justify-center rounded-[4px]"
                    style={{ background: 'var(--brand-deep)', color: 'var(--brand-ink)' }}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full text-white"
                  style={{ background: badge }}
                >
                  <Icon className="size-[10px]" />
                </span>
              </span>
              <span
                className="w-full truncate text-center text-[11px] font-medium"
                style={{ color: isTicked ? 'var(--ink)' : 'var(--ink-3)' }}
              >
                {handleLabel(account)}
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
