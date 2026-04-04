'use client'

import type { ChannelStrategy } from '@/types/database'

interface Props {
  strategy: ChannelStrategy | undefined
  brandName: string
}

const CHANNEL_COLOURS: Record<string, string> = {
  linkedin: 'bg-blue-600',
  youtube: 'bg-red-600',
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  facebook: 'bg-blue-500',
  tiktok: 'bg-zinc-900',
  twitter: 'bg-zinc-700',
  reddit: 'bg-orange-600',
  pinterest: 'bg-red-500',
  threads: 'bg-zinc-800',
}

const CHANNEL_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  twitter: 'X',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

export function MarketingDNABar({ strategy, brandName }: Props) {
  if (!strategy?.channels) return null

  const channels = Object.entries(strategy.channels)
    .filter(([, pct]) => pct > 0)
    .sort(([, a], [, b]) => b - a)

  if (channels.length === 0) return null

  return (
    <div className="mx-4 mb-2">
      <div className="mx-auto max-w-3xl">
        {/* Strategy bar label */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            {brandName} Marketing DNA
          </span>
          {strategy.growth_approach && (
            <span className="text-[10px] text-muted-foreground/40 capitalize">
              {strategy.growth_approach} strategy
              {strategy.aeo_priority && ' + AI search'}
            </span>
          )}
        </div>

        {/* Stacked bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
          {channels.map(([channel, pct]) => (
            <div
              key={channel}
              className={`${CHANNEL_COLOURS[channel] ?? 'bg-zinc-500'} transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${pct}%` }}
              title={`${CHANNEL_LABELS[channel] ?? channel} ${pct}%`}
            />
          ))}
        </div>

        {/* Channel labels below */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {channels.map(([channel, pct]) => (
            <div key={channel} className="flex items-center gap-1">
              <div className={`h-1.5 w-1.5 rounded-full ${CHANNEL_COLOURS[channel] ?? 'bg-zinc-500'}`} />
              <span className="text-[10px] text-muted-foreground/60">
                {CHANNEL_LABELS[channel] ?? channel} {pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
