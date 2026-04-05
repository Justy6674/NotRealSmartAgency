'use client'

import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'
import type { SocialAccount } from '@/hooks/useStudioData'

const PLATFORM_CONFIG: Record<string, { colour: string; label: string }> = {
  instagram: { colour: 'bg-pink-500', label: 'Instagram' },
  facebook: { colour: 'bg-blue-500', label: 'Facebook' },
  linkedin: { colour: 'bg-sky-500', label: 'LinkedIn' },
  tiktok: { colour: 'bg-cyan-500', label: 'TikTok' },
  youtube: { colour: 'bg-red-500', label: 'YouTube' },
  twitter: { colour: 'bg-zinc-400', label: 'X' },
  x: { colour: 'bg-zinc-400', label: 'X' },
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

interface SocialConnectionsCardProps {
  brand: Brand
  accounts: SocialAccount[]
  lastPublishedByPlatform: Record<string, string>
}

export function SocialConnectionsCard({ brand, accounts, lastPublishedByPlatform }: SocialConnectionsCardProps) {
  const { setChatPanelOpen, setPendingReviewMessage } = useAgencyStore()

  // Get platforms from channel strategy
  const strategy = brand.channel_strategy as Record<string, unknown> | null
  const strategyChannels = strategy?.channels as Record<string, number> | null

  // Build platform list: strategy platforms + connected platforms
  const platformSet = new Set<string>()
  if (strategyChannels) {
    Object.keys(strategyChannels).forEach(p => platformSet.add(normalise(p)))
  }
  accounts.forEach(a => platformSet.add(normalise(a.platform)))

  // If nothing, show default platforms
  if (platformSet.size === 0) {
    ['instagram', 'facebook', 'linkedin', 'tiktok'].forEach(p => platformSet.add(p))
  }

  const platforms = Array.from(platformSet).map(platform => {
    const connected = accounts.some(a => normalise(a.platform) === platform)
    const account = accounts.find(a => normalise(a.platform) === platform)
    const config = PLATFORM_CONFIG[platform] ?? { colour: 'bg-zinc-500', label: platform }
    const lastPublished = lastPublishedByPlatform[platform] ?? lastPublishedByPlatform[platform === 'x' ? 'twitter' : platform]

    return { platform, connected, account, config, lastPublished }
  })

  const handleConnect = (platform: string) => {
    setChatPanelOpen(true)
    setPendingReviewMessage(`Help me connect ${platform} for ${brand.name}`)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Social Connections</h3>

      <div className="space-y-2">
        {platforms.map(({ platform, connected, account, config, lastPublished }) => (
          <div key={platform} className="flex items-center gap-3">
            {/* Status dot */}
            <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />

            {/* Platform name */}
            <span className="text-sm text-foreground flex-1 min-w-0">
              {config.label}
              {account && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {account.accountName}
                </span>
              )}
            </span>

            {/* Last published or connect button */}
            {connected ? (
              <span className="text-xs text-muted-foreground shrink-0">
                {lastPublished
                  ? `Last: ${new Date(lastPublished).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
                  : 'Connected'
                }
              </span>
            ) : (
              <button
                onClick={() => handleConnect(config.label)}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
              >
                Connect
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
