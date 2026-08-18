'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Instagram, Facebook, Linkedin, Youtube, Music2, type LucideIcon } from 'lucide-react'
import { useSocialAccounts, type SocialAccount } from '@/hooks/useSocialAccounts'
import { useAgencyStore } from '@/stores/agency-store'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import {
  AccountSelectorStrip,
  accountStripEntries,
  blockedReason,
  ONE_ACCOUNT_ONLY,
} from './AccountSelectorStrip'
import { isComposerPlatform } from '@/lib/social/capabilities'
import type { ContentType } from './ContentTypeSection'
import type { PostPlatform } from '@/types/database'

interface PlatformDef {
  value: PostPlatform
  label: string
  icon: LucideIcon
  compatibleTypes: ContentType[]
}

/**
 * The networks Compose offers, and what each will take.
 *
 * Membership is not decided here — `isComposerPlatform` decides it, from the
 * one retired-networks line in `lib/social/capabilities`. X was dropped on
 * 2026-08-19 and its row is gone from this table, but the filter is what stops
 * a future entry being added back here in isolation and quietly reappearing in
 * the picker while every other surface still refuses it.
 */
const PLATFORMS: PlatformDef[] = ([
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
] as PlatformDef[]).filter((def) => isComposerPlatform(def.value))

function asPostPlatform(value: string): PostPlatform | null {
  return PLATFORMS.some((p) => p.value === value) ? (value as PostPlatform) : null
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

  /**
   * The accounts it is safe to tick without anyone choosing.
   *
   * Stops at the first LinkedIn account for the same reason the avatars do:
   * LinkedIn treats the same words on several of its accounts at once as
   * manipulation, and has suspended accounts over it. Seeding two of them on
   * page load would reach that state before the owner had touched anything at
   * all. The set is the strip's, not a second copy — one rule, one place.
   */
  const compatibleIds = (list: SocialAccount[]) => {
    const oneOnly = ONE_ACCOUNT_ONLY
    const taken = new Set<string>()
    const ids: string[] = []
    for (const account of list) {
      const platform = asPostPlatform(canonicalSocialPlatform(account.platform))
      if (!platform) continue
      const def = PLATFORMS.find((p) => p.value === platform)
      if (!def?.compatibleTypes.includes(contentType)) continue
      if (oneOnly.has(platform)) {
        if (taken.has(platform)) continue
        taken.add(platform)
      }
      ids.push(account.id)
    }
    return ids
  }

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

  const labelFor = (platform: string) =>
    PLATFORMS.find((p) => p.value === platform)?.label ?? platform
  const isCompatible = (platform: string) => {
    const def = PLATFORMS.find((p) => p.value === platform)
    return def ? def.compatibleTypes.includes(contentType) : true
  }
  const entries = accountStripEntries(accounts, isCompatible, labelFor)

  const toggleAccount = (accountId: string) => {
    if (!onAccountIdsChange) return
    const entry = entries.find((candidate) => candidate.account.id === accountId)
    // The strip already disables a blocked avatar; this is the second half of
    // the same rule, because a handler is the last place that should trust the
    // button that called it. LinkedIn suspends accounts over simultaneous
    // posting, so "the click should not have happened" is not good enough.
    if (!entry || blockedReason(entry, selectedAccountIds, entries)) return
    const next = selectedAccountIds.includes(accountId)
      ? selectedAccountIds.filter((id) => id !== accountId)
      : [...selectedAccountIds, accountId]
    syncPlatformsFromIds(next)
  }

  /**
   * Tick all stops at the first account of a one-account-only network.
   *
   * Ticking every compatible account would put the same words on both LinkedIn
   * accounts in one press — the exact thing the per-avatar block exists to
   * prevent, reached through a different button.
   */
  const tickAll = () => {
    const chosen: string[] = []
    for (const entry of entries) {
      if (blockedReason(entry, chosen, entries)) continue
      chosen.push(entry.account.id)
    }
    syncPlatformsFromIds(chosen)
  }
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

  // Counted from the strip, not from the raw connection list. A business whose
  // only connected account is on a network Compose has retired has nowhere to
  // send this, and saying "0 of 1 ticked" over an empty row would be a puzzle.
  if (entries.length === 0) {
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
  const total = entries.length
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

      <AccountSelectorStrip
        entries={entries}
        selectedAccountIds={selectedAccountIds}
        onToggle={toggleAccount}
      />

      {selected.length === 0 && (
        <p className="mt-3 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          Tick one account, or Tick all, to choose where this goes.
        </p>
      )}
    </div>
  )
}

export { PLATFORMS }
