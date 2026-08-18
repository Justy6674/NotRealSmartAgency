'use client'

import { useEffect, useMemo, useState } from 'react'
import { PlatformMockupPreview } from '.'
import { RETIRED_COMPOSER_PLATFORMS } from '@/lib/social/capabilities'

/**
 * The Preview half of the composer's right pane.
 *
 * Mixpost previews ONE account version at a time, chosen from a strip above the
 * phone — not every ticked network side by side. That difference is the whole
 * point of the pane: two Instagram accounts publishing different words are two
 * different previews, and a grid of shrunken phones can only ever show a
 * platform, never an account. So the switcher here is keyed on the account id.
 *
 * The words come from the caller, which resolves them through
 * `resolvePublishCaption` — this file deliberately holds no opinion about which
 * caption wins, because that opinion already exists in exactly one place.
 *
 * A retired network is not previewed and gets no tab. The list comes from
 * `RETIRED_COMPOSER_PLATFORMS` so retiring the next one stays a single edit.
 */

const NOT_PREVIEWED = new Set<string>(RETIRED_COMPOSER_PLATFORMS)

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  pinterest: 'Pinterest',
  threads: 'Threads',
  google_business: 'Google Business',
}

export interface PreviewAccount {
  id: string
  name: string
  platform: string
}

export interface ComposerPreviewPaneProps {
  /** Every ticked account, in the order the strip shows them. */
  accounts: PreviewAccount[]
  /** The exact words and tags this account is publishing. */
  captionFor: (accountId: string, platform: string) => { caption: string; hashtags: string[] }
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
}

export function ComposerPreviewPane({
  accounts,
  captionFor,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
}: ComposerPreviewPaneProps) {
  const previewable = useMemo(
    () => accounts.filter((account) => !NOT_PREVIEWED.has(account.platform)),
    [accounts],
  )

  const [activeId, setActiveId] = useState<string | null>(previewable[0]?.id ?? null)

  // Follow the tick list. Untick the account being previewed and the pane falls
  // back to the first one still ticked; tick a new one and the pane jumps to it,
  // because the click that ticked it is a request to see it.
  useEffect(() => {
    setActiveId((current) => {
      if (current && previewable.some((a) => a.id === current)) return current
      return previewable[0]?.id ?? null
    })
  }, [previewable])

  const active = previewable.find((a) => a.id === activeId) ?? previewable[0] ?? null

  if (accounts.length === 0) {
    return (
      <EmptyPreview
        title="Nothing ticked yet"
        body="Tick an account on the left and this is where you will see the post exactly as it lands."
      />
    )
  }

  if (!active) {
    return (
      <EmptyPreview
        title="No preview for this account"
        body="Tick an account on a network we draw and the post appears here."
      />
    )
  }

  const publish = captionFor(active.id, active.platform)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {previewable.length > 1 && (
        <div
          className="flex shrink-0 flex-wrap gap-[6px] border-b px-[15px] py-[10px]"
          style={{ borderColor: 'var(--line-soft, oklch(0.950 0.005 240))' }}
        >
          {previewable.map((account) => {
            const on = account.id === active.id
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setActiveId(account.id)}
                aria-pressed={on}
                className="max-w-[220px] truncate rounded-[8px] border px-[10px] py-[6px] text-[12.5px] transition-colors duration-150"
                style={{
                  borderColor: on ? 'var(--brand, oklch(0.52 0.09 55))' : 'var(--line, oklch(0.915 0.007 240))',
                  background: on ? 'var(--brand-wash, oklch(0.966 0.03 55))' : 'var(--panel, oklch(1 0 0))',
                  color: on ? 'var(--brand-deep, oklch(0.33 0.07 55))' : 'var(--ink-2, oklch(0.46 0.012 240))',
                  fontWeight: on ? 600 : 400,
                }}
              >
                {account.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-[15px] py-[16px]">
        <div className="flex flex-col items-center gap-[9px]">
          <PlatformMockupPreview
            platform={active.platform}
            caption={publish.caption}
            hashtags={publish.hashtags}
            mediaUrl={mediaUrl}
            mediaUrls={mediaUrls}
            brandName={brandName}
            brandAvatarUrl={brandAvatarUrl}
          />
          <p className="text-[12px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
            {active.name} · {PLATFORM_LABELS[active.platform] ?? active.platform}
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-[26px] py-[40px]">
      <div className="max-w-[320px] text-center">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
          {title}
        </p>
        <p className="mt-[6px] text-[12.5px] leading-[1.5]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          {body}
        </p>
      </div>
    </div>
  )
}
