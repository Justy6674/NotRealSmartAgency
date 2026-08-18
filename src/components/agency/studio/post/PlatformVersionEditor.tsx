'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RotateCcw, X } from 'lucide-react'
import type { PostPlatform } from '@/types/database'
import type { PostVersions } from '@/lib/post-versions'
import { customisePlatform, resetPlatformToMaster } from '@/lib/post-versions'
import { limitFor } from '@/hooks/usePostCharacterLimit'
import { PLATFORM_CHAR_LIMITS, PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import type { ZernioTikTokCreatorInfo } from '@/lib/zernio/accounts'
import { isComposerPlatform } from '@/lib/social/capabilities'
import { PlatformOptions, FirstComment } from './PlatformOptions'
import { UrlShortener } from './UrlShortener'

export interface VersionAccount {
  id: string
  name: string
  platform: string
}

interface PlatformVersionEditorProps {
  platforms: PostPlatform[]
  /** Every ticked account, in the order the strip shows them. */
  accounts?: VersionAccount[]
  masterCaption: string
  masterHashtags: string[]
  versions: PostVersions
  /** Words belonging to ONE account, overriding both its network and the master. */
  captionsByAccountId?: Record<string, string>
  onCaptionsByAccountIdChange?: (next: Record<string, string>) => void
  onMasterChange: (caption: string, hashtags: string[]) => void
  onVersionsChange: (versions: PostVersions) => void
  /** Per-platform metadata options keyed by platform name */
  platformOptions?: Record<string, Record<string, unknown>>
  /** Called when platform-specific metadata changes */
  onPlatformOptionsChange?: (platformOptions: Record<string, Record<string, unknown>>) => void
  transport?: 'zernio' | 'mixpost'
  /** Ceilings the publisher reported. Falls back to our table per platform. */
  publisherLimits?: Partial<Record<PlatformKey, number>>
  tiktokCreatorInfo?: ZernioTikTokCreatorInfo | null
}

/** Networks where a long link in the words is worth shortening before it goes. */
const LINK_PLATFORMS = new Set(['facebook', 'linkedin'])
const URL_PATTERN = /https?:\/\/[^\s]+/

type Tab =
  | { kind: 'master' }
  | { kind: 'platform'; platform: PostPlatform }
  | { kind: 'account'; accountId: string; platform: string }

const platformLabel = (platform: string): string =>
  (PLATFORM_LABELS as Record<string, string>)[platform]
  ?? platform.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/**
 * The words each account will publish — network versions, and account versions.
 *
 * ── Why a second layer of tabs ────────────────────────────────────────────
 * A per-PLATFORM version is the wrong unit for a business with two Instagram
 * accounts. It can only say "what Instagram sees", which is not a sentence
 * anybody can act on when one account is the clinic and the other is the
 * founder. Mixpost's own version tabs are per account for exactly this reason.
 *
 * What made it possible is `platforms[].customContent` on the publishing side:
 * per-account words now travel to the wire instead of being flattened into one
 * row per platform. The composer stores them under the account id and the
 * publisher reads them back per account, so two Instagram accounts on one post
 * genuinely carry different words.
 *
 * Resolution order, and it is deliberate: an account's own words beat its
 * network's version, which beats the master. Anything else and rewriting the
 * master would silently overwrite work the owner did on one account.
 */
export function resolveAccountCaption(
  accountId: string,
  platform: string,
  captionsByAccountId: Record<string, string>,
  versions: PostVersions,
  masterCaption: string,
): { caption: string; source: 'account' | 'platform' | 'master' } {
  const own = captionsByAccountId[accountId]
  if (typeof own === 'string') return { caption: own, source: 'account' }
  const version = versions[platform as PostPlatform]
  if (version?.isCustomised) return { caption: version.caption, source: 'platform' }
  return { caption: masterCaption, source: 'master' }
}

export function PlatformVersionEditor({
  platforms: selectedPlatforms,
  accounts: selectedAccounts = [],
  masterCaption,
  masterHashtags,
  versions,
  captionsByAccountId = {},
  onCaptionsByAccountIdChange,
  onMasterChange,
  onVersionsChange,
  platformOptions,
  onPlatformOptionsChange,
  transport = 'mixpost',
  publisherLimits,
  tiktokCreatorInfo,
}: PlatformVersionEditorProps) {
  const [tab, setTab] = useState<Tab>({ kind: 'master' })

  /**
   * A draft saved before a network was retired still carries it.
   *
   * The picker cannot produce one any more, but a draft loaded from before
   * 2026-08-19 can, and a version tab for a network nothing will publish to is
   * an invitation to write words that go nowhere. The stored words are not
   * touched — they are simply not offered for editing.
   */
  const platforms = selectedPlatforms.filter((platform) => isComposerPlatform(platform))
  const accounts = selectedAccounts.filter((account) => isComposerPlatform(account.platform))

  // A tab whose account or platform has since been unticked would otherwise
  // keep editing words nothing will publish.
  const activeTab: Tab =
    tab.kind === 'platform' && !platforms.includes(tab.platform) ? { kind: 'master' }
    : tab.kind === 'account' && !accounts.some((a) => a.id === tab.accountId) ? { kind: 'master' }
    : tab

  const activeAccount =
    activeTab.kind === 'account'
      ? accounts.find((a) => a.id === activeTab.accountId) ?? null
      : null

  const activePlatform: string | null =
    activeTab.kind === 'platform' ? activeTab.platform
    : activeAccount ? activeAccount.platform
    : null

  const resolved =
    activeTab.kind === 'master' ? { caption: masterCaption, source: 'master' as const }
    : activeAccount
      ? resolveAccountCaption(activeAccount.id, activeAccount.platform, captionsByAccountId, versions, masterCaption)
    : activeTab.kind === 'platform'
      ? (versions[activeTab.platform]?.isCustomised
          ? { caption: versions[activeTab.platform]!.caption, source: 'platform' as const }
          : { caption: masterCaption, source: 'master' as const })
      : { caption: masterCaption, source: 'master' as const }

  const currentCaption = resolved.caption
  const isCustomised = resolved.source !== 'master'

  const { limit: charLimit, fromPublisher } =
    activePlatform && activePlatform in PLATFORM_CHAR_LIMITS
      ? limitFor(activePlatform as PlatformKey, publisherLimits)
      : { limit: 2200, fromPublisher: false }

  /**
   * THE FAULT: the first keystroke in a platform's box deleted that platform's
   * hashtags. This carried the snapshot taken when the platform was ticked,
   * which on the usual order of work (pick platforms, write, then add tags) is
   * an empty array — and `resolvePublishCaption` trusts a customised version's
   * hashtags verbatim. The live master is the only honest answer while nothing
   * here can give a platform hashtags of its own.
   */
  const handleCaptionChange = (text: string) => {
    if (activeTab.kind === 'master') {
      onMasterChange(text, masterHashtags)
      return
    }
    if (activeAccount) {
      onCaptionsByAccountIdChange?.({ ...captionsByAccountId, [activeAccount.id]: text })
      return
    }
    if (activeTab.kind === 'platform') {
      onVersionsChange(customisePlatform(versions, activeTab.platform, text, masterHashtags))
    }
  }

  const handleReset = () => {
    if (activeAccount) {
      const next = { ...captionsByAccountId }
      delete next[activeAccount.id]
      onCaptionsByAccountIdChange?.(next)
      return
    }
    if (activeTab.kind === 'platform') {
      onVersionsChange(
        resetPlatformToMaster(versions, activeTab.platform, masterCaption, masterHashtags),
      )
    }
  }

  const tabButton = (
    key: string,
    label: string,
    selected: boolean,
    onSelect: () => void,
    marked: boolean,
    onRemove?: () => void,
  ) => (
    <span
      key={key}
      className={cn(
        'inline-flex items-center gap-1 rounded-[7px] border px-[9px] py-[4px] text-[11px] font-medium transition-colors',
      )}
      style={{
        borderColor: selected ? 'var(--brand)' : 'var(--line)',
        background: selected ? 'var(--brand-wash)' : 'var(--panel-2)',
        color: selected ? 'var(--brand-deep)' : 'var(--ink-2)',
      }}
    >
      <button type="button" onClick={onSelect} className="bg-transparent p-0">
        {label}
        {marked && ' *'}
      </button>
      {marked && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove the version for ${label}`}
          title={`Remove the version for ${label}`}
          className="bg-transparent p-0"
          style={{ color: 'var(--ink-3)' }}
        >
          <X className="h-[11px] w-[11px]" />
        </button>
      )}
    </span>
  )

  const showAccountTabs = accounts.length > 1

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-[6px]">
        {tabButton(
          'master',
          'All accounts',
          activeTab.kind === 'master',
          () => setTab({ kind: 'master' }),
          false,
        )}

        {showAccountTabs
          ? accounts.map((account) =>
              tabButton(
                account.id,
                account.name,
                activeTab.kind === 'account' && activeTab.accountId === account.id,
                () => setTab({ kind: 'account', accountId: account.id, platform: account.platform }),
                typeof captionsByAccountId[account.id] === 'string',
                () => {
                  if (!window.confirm(`Remove the separate words for ${account.name}? It goes back to the caption above.`)) return
                  const next = { ...captionsByAccountId }
                  delete next[account.id]
                  onCaptionsByAccountIdChange?.(next)
                },
              ),
            )
          : platforms.map((platform) =>
              tabButton(
                platform,
                platformLabel(platform),
                activeTab.kind === 'platform' && activeTab.platform === platform,
                () => setTab({ kind: 'platform', platform }),
                Boolean(versions[platform]?.isCustomised),
                () =>
                  onVersionsChange(
                    resetPlatformToMaster(versions, platform, masterCaption, masterHashtags),
                  ),
              ),
            )}
      </div>

      <div className="relative">
        <textarea
          value={currentCaption}
          onChange={(e) => handleCaptionChange(e.target.value)}
          rows={6}
          placeholder={
            activeTab.kind === 'master'
              ? 'Write your caption…'
              : `Different words for ${activeAccount?.name ?? platformLabel(activePlatform ?? '')}…`
          }
          className="w-full resize-none rounded-[8px] border px-[10px] py-[8px] text-[13px] outline-none"
          style={{ borderColor: 'var(--line)', background: 'var(--panel)', color: 'var(--ink)' }}
        />

        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            {isCustomised && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-[11px]"
                style={{ color: 'var(--ink-3)' }}
              >
                <RotateCcw className="h-[10px] w-[10px]" />
                Go back to the caption above
              </button>
            )}
            {activeTab.kind !== 'master' && !isCustomised && (
              <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                Using the caption above. Type here to give{' '}
                {activeAccount?.name ?? platformLabel(activePlatform ?? '')} its own words.
              </span>
            )}
            {activeAccount && resolved.source === 'platform' && (
              <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                Using the {platformLabel(activeAccount.platform)} version.
              </span>
            )}
          </div>
          {/* Right-aligned mono tabular numerals, per DESIGN.md — never a ring. */}
          <span
            className="shrink-0 text-right font-mono text-[11.5px] tabular-nums"
            style={{
              color:
                Array.from(currentCaption).length > charLimit
                  ? 'oklch(0.55 0.2 25)'
                  : Array.from(currentCaption).length > charLimit * 0.9
                    ? 'oklch(0.55 0.15 75)'
                    : 'var(--ink-3)',
            }}
            title={fromPublisher ? undefined : 'Our own conservative figure — not confirmed by the posting connection.'}
          >
            {(charLimit - Array.from(currentCaption).length).toLocaleString('en-AU')} /{' '}
            {charLimit.toLocaleString('en-AU')}
          </span>
        </div>

        {activePlatform && onPlatformOptionsChange && (
          <>
            <PlatformOptions
              platform={activePlatform}
              options={platformOptions?.[activePlatform] ?? {}}
              transport={transport}
              tiktokCreatorInfo={activePlatform === 'tiktok' ? tiktokCreatorInfo : null}
              onChange={(opts) =>
                onPlatformOptionsChange({
                  ...(platformOptions ?? {}),
                  [activePlatform]: opts,
                })
              }
            />
            <FirstComment
              platform={activePlatform}
              options={platformOptions?.[activePlatform] ?? {}}
              transport={transport}
              onChange={(opts) =>
                onPlatformOptionsChange({
                  ...(platformOptions ?? {}),
                  [activePlatform]: opts,
                })
              }
            />
          </>
        )}

        {activePlatform && LINK_PLATFORMS.has(activePlatform) && URL_PATTERN.test(currentCaption) && (
          <div className="mt-2">
            <UrlShortener
              onShorten={(shortUrl) => {
                handleCaptionChange(currentCaption.replace(URL_PATTERN, shortUrl))
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
