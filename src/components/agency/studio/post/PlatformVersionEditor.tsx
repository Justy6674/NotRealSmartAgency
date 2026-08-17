'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'
import type { PostPlatform } from '@/types/database'
import type { PostVersions } from '@/lib/post-versions'
import { customisePlatform, resetPlatformToMaster, PLATFORM_CHAR_LIMITS } from '@/lib/post-versions'
import { PlatformOptions } from './PlatformOptions'
import { UrlShortener } from './UrlShortener'

interface PlatformVersionEditorProps {
  platforms: PostPlatform[]
  masterCaption: string
  masterHashtags: string[]
  versions: PostVersions
  onMasterChange: (caption: string, hashtags: string[]) => void
  onVersionsChange: (versions: PostVersions) => void
  /** Per-platform metadata options keyed by platform name */
  platformOptions?: Record<string, Record<string, unknown>>
  /** Called when platform-specific metadata changes */
  onPlatformOptionsChange?: (platformOptions: Record<string, Record<string, unknown>>) => void
}

const LINK_PLATFORMS = new Set(['facebook', 'linkedin', 'twitter'])
const URL_PATTERN = /https?:\/\/[^\s]+/

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

export function PlatformVersionEditor({
  platforms,
  masterCaption,
  masterHashtags,
  versions,
  onMasterChange,
  onVersionsChange,
  platformOptions,
  onPlatformOptionsChange,
}: PlatformVersionEditorProps) {
  const [activeTab, setActiveTab] = useState<'master' | PostPlatform>('master')

  const isCustomised = activeTab !== 'master' && versions[activeTab as PostPlatform]?.isCustomised

  const currentCaption = activeTab === 'master'
    ? masterCaption
    : (versions[activeTab as PostPlatform]?.isCustomised
        ? versions[activeTab as PostPlatform]!.caption
        : masterCaption)

  const charLimit = activeTab === 'master' ? 2200 : PLATFORM_CHAR_LIMITS[activeTab] ?? 2200

  /**
   * THE FAULT: the first keystroke in a platform's box deleted that platform's
   * hashtags. This carried `currentVersion?.hashtags ?? masterHashtags` — the
   * snapshot taken by createVersionsFromMaster when the platform was ticked,
   * which on the usual order of work (pick platforms, write, then add tags) is
   * an empty array. resolvePublishCaption trusts a customised version's
   * hashtags verbatim and never tops them up from the master (post-versions.ts,
   * rule 3), so that stale array is what published: the caption the owner had
   * just rewritten, with every hashtag silently gone, and a preview that agreed
   * with the row rather than with him.
   *
   * The live master is the only honest answer while nothing in this editor can
   * give a platform hashtags of its own — the stored array is never a decision,
   * only a leftover. If a per-platform hashtag field is ever added, its value
   * is what belongs here instead, and rule 3 becomes load-bearing rather than
   * merely true.
   */
  const handleCaptionChange = (text: string) => {
    if (activeTab === 'master') {
      onMasterChange(text, masterHashtags)
    } else {
      const platform = activeTab as PostPlatform
      onVersionsChange(customisePlatform(versions, platform, text, masterHashtags))
    }
  }

  const handleResetToMaster = () => {
    if (activeTab === 'master') return
    onVersionsChange(
      resetPlatformToMaster(versions, activeTab as PostPlatform, masterCaption, masterHashtags)
    )
  }

  return (
    <div className="space-y-2">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('master')}
          className={cn(
            'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
            activeTab === 'master'
              ? 'bg-[oklch(0.55_0.1_240)] text-white'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          All Platforms
        </button>
        {platforms.map(p => {
          const v = versions[p]
          return (
            <button
              key={p}
              onClick={() => setActiveTab(p)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                activeTab === p
                  ? 'bg-[oklch(0.55_0.1_240)] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
                v?.isCustomised && activeTab !== p && 'ring-1 ring-[oklch(0.55_0.15_250)]'
              )}
            >
              {PLATFORM_LABELS[p] ?? p}
              {v?.isCustomised && ' *'}
            </button>
          )
        })}
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          value={currentCaption}
          onChange={e => handleCaptionChange(e.target.value)}
          rows={6}
          placeholder={activeTab === 'master' ? 'Write your caption...' : `Customise for ${PLATFORM_LABELS[activeTab] ?? activeTab}...`}
          className={cn(
            'w-full resize-none rounded-md border bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary',
          )}
        />

        {/* Char count + reset */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            {isCustomised && (
              <button
                onClick={handleResetToMaster}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset to master
              </button>
            )}
            {activeTab !== 'master' && !isCustomised && (
              <span className="text-[10px] text-muted-foreground/60">
                Using master caption. Edit to customise for {PLATFORM_LABELS[activeTab] ?? activeTab}.
              </span>
            )}
          </div>
          <span className={cn(
            'text-[10px] tabular-nums',
            currentCaption.length > charLimit * 0.9 ? 'text-red-400 font-medium' :
            currentCaption.length > charLimit * 0.8 ? 'text-amber-400' :
            'text-muted-foreground/60'
          )}>
            {currentCaption.length} / {charLimit.toLocaleString()}
          </span>
        </div>

        {/* Per-platform metadata fields */}
        {activeTab !== 'master' && onPlatformOptionsChange && (
          <PlatformOptions
            platform={activeTab}
            options={platformOptions?.[activeTab] ?? {}}
            onChange={(opts) =>
              onPlatformOptionsChange({
                ...(platformOptions ?? {}),
                [activeTab]: opts,
              })
            }
          />
        )}

        {/* URL Shortener — shown for link-friendly platforms when caption contains a URL */}
        {LINK_PLATFORMS.has(activeTab === 'master' ? '' : activeTab) && URL_PATTERN.test(currentCaption) && (
          <div className="mt-2">
            <UrlShortener
              onShorten={(shortUrl) => {
                // Replace the first URL in the caption with the shortened version
                const updated = currentCaption.replace(URL_PATTERN, shortUrl)
                handleCaptionChange(updated)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
