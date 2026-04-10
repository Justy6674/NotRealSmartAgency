'use client'

import { useState, useEffect, useRef } from 'react'
import { PlatformMockupPreview } from '.'
import { cn } from '@/lib/utils'
import type { PostPlatform } from '@/types/database'
import type { PostVersions } from '@/lib/post-versions'
import { getVersionForPlatform } from '@/lib/post-versions'

interface MultiPlatformPreviewProps {
  platforms: PostPlatform[]
  masterCaption: string
  masterHashtags: string[]
  versions?: PostVersions
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

export function MultiPlatformPreview({
  platforms,
  masterCaption,
  masterHashtags,
  versions,
  mediaUrl,
  mediaUrls,
  brandName,
  brandAvatarUrl,
}: MultiPlatformPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<PostPlatform | 'all'>(
    platforms.length === 1 ? platforms[0] : platforms[0] ?? 'all',
  )

  // Keep `activePlatform` in sync with the platforms prop so the preview
  // follows the publish target selection.
  //
  // Rules:
  //   - If the current active platform is no longer in the list, reset it.
  //     → Go to the first remaining platform (single-platform view), or 'all'
  //       if there are ≥2 platforms still selected.
  //   - If platforms grew from N to N+1, jump to the newly-added platform so
  //     the user sees the thing they just clicked. This is the behaviour users
  //     of Meta Composer / Later / Buffer expect.
  //   - If platforms went from multi to empty, fall back to 'all' so the
  //     "Select platforms" empty state renders cleanly.
  //   - Don't override an explicit user click on the All/<platform> tabs —
  //     we only touch activePlatform when the `platforms` prop actually
  //     changes.
  const prevPlatformsRef = useRef<PostPlatform[]>(platforms)
  useEffect(() => {
    const prev = prevPlatformsRef.current
    const curr = platforms
    prevPlatformsRef.current = curr

    // Platform list unchanged — respect user's tab click
    if (prev.length === curr.length && prev.every((p, i) => p === curr[i])) return

    // Empty list — reset to 'all'
    if (curr.length === 0) {
      setActivePlatform('all')
      return
    }

    // Find newly-added platform (not in prev list)
    const added = curr.find((p) => !prev.includes(p))
    if (added) {
      setActivePlatform(added)
      return
    }

    // A platform was removed. If the current active was the one removed,
    // fall back to the first remaining (single) or 'all' (multi).
    const activeStillValid = activePlatform === 'all' || curr.includes(activePlatform as PostPlatform)
    if (!activeStillValid) {
      setActivePlatform(curr.length === 1 ? curr[0] : 'all')
    }
  // activePlatform is intentionally excluded from deps — we only react to prop changes,
  // not to our own state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platforms])

  const visiblePlatforms = activePlatform === 'all' ? platforms : [activePlatform as PostPlatform]

  return (
    <div className="space-y-3">
      {/* Platform tabs */}
      {platforms.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActivePlatform('all')}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
              activePlatform === 'all'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          {platforms.map(p => (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
                activePlatform === p
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {PLATFORM_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      )}

      {/* Phone frame previews */}
      <div className={cn(
        'flex gap-4 overflow-x-auto pb-2',
        visiblePlatforms.length === 1 && 'justify-center'
      )}>
        {visiblePlatforms.map(platform => {
          const version = versions
            ? getVersionForPlatform(versions, platform, masterCaption, masterHashtags)
            : { caption: masterCaption, hashtags: masterHashtags }

          return (
            <div key={platform} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div style={{ transform: 'scale(0.78)', transformOrigin: 'top center' }}>
                <PlatformMockupPreview
                  platform={platform}
                  caption={version.caption}
                  hashtags={version.hashtags}
                  mediaUrl={mediaUrl}
                  mediaUrls={mediaUrls}
                  brandName={brandName}
                  brandAvatarUrl={brandAvatarUrl}
                />
              </div>
              <span className="text-[9px] font-medium text-muted-foreground">
                {PLATFORM_LABELS[platform] ?? platform}
                {versions?.[platform]?.isCustomised && (
                  <span className="ml-1 text-[oklch(0.55_0.15_250)]">customised</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
