'use client'

import { useState } from 'react'
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
}

export function MultiPlatformPreview({
  platforms,
  masterCaption,
  masterHashtags,
  versions,
  mediaUrl,
  brandName,
  brandAvatarUrl,
}: MultiPlatformPreviewProps) {
  const [activePlatform, setActivePlatform] = useState<PostPlatform | 'all'>(
    platforms.length === 1 ? platforms[0] : 'all'
  )

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
