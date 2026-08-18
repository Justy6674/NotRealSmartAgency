'use client'

import { Instagram, Facebook, Linkedin, Youtube, Music2, Check, type LucideIcon } from 'lucide-react'
import { PLATFORM_BRAND_COLOURS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import { isComposerPlatform } from '@/lib/social/capabilities'
import type { SocialAccount } from '@/hooks/useSocialAccounts'

const PLATFORM_ICON_MAP: Record<string, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
}

/**
 * Networks that refuse the same words on two accounts at once.
 *
 * LinkedIn treats near-identical posts from several accounts in one breath as
 * platform manipulation, and has suspended accounts for it. Mixpost encodes
 * exactly this with `simultaneousPosting(false)`, and it is the one rule in the
 * account strip that is a safety rule rather than a convenience: it protects a
 * live account the owner cannot get back if it goes wrong.
 *
 * The block is per-provider and only bites once one of that provider's accounts
 * is already ticked — a business with a single LinkedIn account never sees it.
 *
 * Exported so the picker's seeding and Tick all obey the same set rather than
 * keeping a second copy that can drift out of step with this one.
 */
export const ONE_ACCOUNT_ONLY = new Set(['linkedin'])

const ONE_ACCOUNT_REASON: Record<string, string> = {
  linkedin:
    'LinkedIn only takes one account per post. Untick the other LinkedIn account to use this one.',
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export interface AccountStripEntry {
  account: SocialAccount
  platform: string
  platformLabel: string
  /** False when this content type cannot go to this network at all. */
  compatible: boolean
}

/**
 * Why one avatar cannot be ticked right now, or null when it can.
 *
 * Exported so the strip and anything that reasons about the same selection —
 * a test, a Director fill — reach the same verdict rather than each writing
 * their own version of the rule.
 */
export function blockedReason(
  entry: AccountStripEntry,
  selectedAccountIds: readonly string[],
  all: readonly AccountStripEntry[],
): string | null {
  if (!entry.compatible) {
    return `${entry.platformLabel} does not take this kind of post.`
  }
  if (selectedAccountIds.includes(entry.account.id)) return null
  if (!ONE_ACCOUNT_ONLY.has(entry.platform)) return null
  const anotherTicked = all.some(
    (other) =>
      other.account.id !== entry.account.id &&
      other.platform === entry.platform &&
      selectedAccountIds.includes(other.account.id),
  )
  if (!anotherTicked) return null
  return ONE_ACCOUNT_REASON[entry.platform] ?? `${entry.platformLabel} only takes one account per post.`
}

/**
 * The connected accounts this composer will offer, as strip entries.
 *
 * A retired network is dropped here rather than greyed out. Greying it would
 * be the honest treatment of "this post cannot go there", but a network the
 * product no longer offers is a different statement — leaving a permanently
 * dead avatar in the row invites the owner to keep asking why it will not tick.
 * The account itself is untouched, and anything already published to it still
 * reads back everywhere else.
 */
export function accountStripEntries(
  accounts: readonly SocialAccount[],
  isCompatible: (platform: string) => boolean,
  labelFor: (platform: string) => string,
): AccountStripEntry[] {
  return accounts
    .map((account) => {
      const platform = canonicalSocialPlatform(account.platform)
      return {
        account,
        platform,
        platformLabel: labelFor(platform),
        compatible: isCompatible(platform),
      }
    })
    .filter((entry) => isComposerPlatform(entry.platform))
}

interface AccountSelectorStripProps {
  entries: AccountStripEntry[]
  selectedAccountIds: string[]
  onToggle: (accountId: string) => void
}

/**
 * Every connected account as a clickable avatar, grey until it is ticked.
 *
 * This replaced six platform pills. A pill could only ever say "send this to
 * Instagram", which on a business with two Instagram accounts is not a
 * sentence anybody can act on — and it is what made two accounts on one post
 * impossible to express at all. An avatar names the account, so per-account
 * words become sayable.
 */
export function AccountSelectorStrip({
  entries,
  selectedAccountIds,
  onToggle,
}: AccountSelectorStripProps) {
  return (
    <div className="flex flex-wrap gap-[9px]">
      {entries.map((entry) => {
        const { account, platform, platformLabel } = entry
        const isTicked = selectedAccountIds.includes(account.id)
        const blocked = blockedReason(entry, selectedAccountIds, entries)
        const Icon = PLATFORM_ICON_MAP[platform] ?? Facebook
        const badge = PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? 'oklch(0.45 0.02 240)'

        return (
          <button
            key={account.id}
            type="button"
            disabled={Boolean(blocked)}
            aria-pressed={isTicked}
            onClick={() => onToggle(account.id)}
            title={blocked ?? account.name}
            className="flex max-w-full items-center gap-[9px] rounded-[10px] border px-[9px] py-[7px] text-left transition-colors duration-150 disabled:cursor-not-allowed"
            style={{
              opacity: blocked ? 0.45 : 1,
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
                  // Grey until chosen, exactly as the account grid does. The
                  // colour arriving is the feedback that the tick landed.
                  filter: isTicked ? 'none' : 'grayscale(1)',
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
  )
}
