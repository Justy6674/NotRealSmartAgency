'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useSocialIntelligence } from '@/hooks/useSocialAnalytics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  PLATFORM_BRAND_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'
import { AnalyticsOverview } from '@/components/agency/studio/analytics/AnalyticsOverview'
import {
  BestTimeCard,
  ContentDecayCard,
  FollowerHistoryCard,
  PostingFrequencyCard,
} from '@/components/agency/studio/analytics/BestTimeCard'
import { AnalyticsPeriodPicker } from '@/components/agency/studio/analytics/AnalyticsPeriodPicker'
import {
  AnalyticsAccountRow,
  type AnalyticsSelection,
} from '@/components/agency/studio/analytics/AnalyticsAccountRow'
import { AnalyticsSyncProgress } from '@/components/agency/studio/analytics/AnalyticsSyncProgress'
import { NativeInsightsCard } from '@/components/agency/studio/analytics/NativeInsightsCard'
import {
  useAnalyticsAccounts,
  useAnalyticsSync,
  spokenPeriod,
  type AnalyticsPeriod,
} from '@/components/agency/studio/analytics/analytics-desk'
import { FacebookReport } from '@/components/agency/studio/analytics/reports/FacebookReport'
import { InstagramReport } from '@/components/agency/studio/analytics/reports/InstagramReport'
import { LinkedInReport } from '@/components/agency/studio/analytics/reports/LinkedInReport'
import { TikTokReport } from '@/components/agency/studio/analytics/reports/TikTokReport'
import { YouTubeReport } from '@/components/agency/studio/analytics/reports/YouTubeReport'
import { PinterestReport } from '@/components/agency/studio/analytics/reports/PinterestReport'
import { ThreadsReport } from '@/components/agency/studio/analytics/reports/ThreadsReport'
import { BlueskyReport } from '@/components/agency/studio/analytics/reports/BlueskyReport'
import { MastodonReport } from '@/components/agency/studio/analytics/reports/MastodonReport'
import { SocialHangOffs } from '@/components/agency/social/SocialHangOffs'

/**
 * Results, for the Social department.
 *
 * ── The shape ──────────────────────────────────────────────────────────
 * Period first, then how current the figures are, then a row of the accounts
 * that actually exist — everything together, or one of them on its own — and
 * only then the numbers. That order is deliberate: every figure below is
 * meaningless without the two above it, and this screen used to show neither.
 *
 * The channel strip used to be ten fixed tabs written out by hand, all of them
 * always present. A business with one connected page saw nine dead tabs. The
 * strip is now built from the connected accounts, so an empty screen carries
 * the reason it is empty and the way to change it — which is the true state for
 * twelve of the fourteen businesses on this desk.
 *
 * X is not part of this product and appears nowhere on it.
 *
 * ── The four questions underneath ──────────────────────────────────────
 * When to post, how long a post keeps earning, how often to post, whether the
 * following is growing. A posting tool cannot answer any of them and they are
 * the reason to read this page at all, so they sit under the summary rather
 * than behind a tab. They are worked out over a longer window than the picker
 * above, and the page says so instead of implying they follow it.
 */

const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'

/** X is out of scope for this product. It is not a tab, a chart or a preview. */
const CHANNEL_TABS: PlatformKey[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
  'pinterest',
  'threads',
  'bluesky',
  'mastodon',
]

/** The publisher's platform words, mapped onto the channels this desk draws. */
function channelOf(platform: string): PlatformKey | null {
  const lower = platform.toLowerCase().replace(/[^a-z]/g, '')
  if (lower.startsWith('facebook')) return 'facebook'
  if (lower.startsWith('instagram')) return 'instagram'
  if (lower.startsWith('linkedin')) return 'linkedin'
  if (lower.startsWith('tiktok')) return 'tiktok'
  if (lower.startsWith('youtube')) return 'youtube'
  if (lower.startsWith('pinterest')) return 'pinterest'
  if (lower.startsWith('threads')) return 'threads'
  if (lower.startsWith('bluesky')) return 'bluesky'
  if (lower.startsWith('mastodon')) return 'mastodon'
  return null
}

/** Seconds as something a person says out loud. */
function spokenDuration(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} seconds`
  const minutes = seconds / 60
  if (minutes < 90) return `${Math.round(minutes)} minutes`
  const hours = minutes / 60
  if (hours < 36) return `${Math.round(hours)} hours`
  return `${Math.round(hours / 24)} days`
}

function ChannelReport({
  channel,
  brandId,
  brandName,
  period,
  accountId,
}: {
  channel: PlatformKey
  brandId: string
  brandName?: string
  period: AnalyticsPeriod
  accountId: string | null
}) {
  const shared = { brandId, brandName, period, accountId }
  switch (channel) {
    case 'facebook': return <FacebookReport {...shared} />
    case 'instagram': return <InstagramReport {...shared} />
    case 'linkedin': return <LinkedInReport {...shared} />
    case 'tiktok': return <TikTokReport {...shared} />
    case 'youtube': return <YouTubeReport {...shared} />
    case 'pinterest': return <PinterestReport {...shared} />
    case 'threads': return <ThreadsReport {...shared} />
    case 'bluesky': return <BlueskyReport {...shared} />
    case 'mastodon': return <MastodonReport {...shared} />
    default: return null
  }
}

export default function SocialAnalyticsPage() {
  const { activeBrandId } = useAgencyStore()
  const studio = useStudioData(activeBrandId)
  const [period, setPeriod] = useState<AnalyticsPeriod>('30_days')
  const [selection, setSelection] = useState<AnalyticsSelection>({ kind: 'summary' })
  const [tab, setTab] = useState<'overview' | PlatformKey>('overview')

  const accountsState = useAnalyticsAccounts(activeBrandId)
  const sync = useAnalyticsSync(activeBrandId, period)
  const intelligence = useSocialIntelligence(activeBrandId)

  const selectedAccount = useMemo(
    () =>
      selection.kind === 'account'
        ? accountsState.accounts.find((account) => account.id === selection.accountId) ?? null
        : null,
    [selection, accountsState.accounts],
  )

  // Only the channels this business actually has. An empty list means the row
  // above is already saying "nothing is connected", so no tabs are drawn at all
  // rather than nine that can never fill.
  const connectedChannels = useMemo(() => {
    const found = new Set<PlatformKey>()
    for (const account of accountsState.accounts) {
      const channel = channelOf(account.platform)
      if (channel) found.add(channel)
    }
    return CHANNEL_TABS.filter((channel) => found.has(channel))
  }, [accountsState.accounts])

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-[13px]" style={{ color: INK_3 }}>
          Choose a business from the sidebar to see its results.
        </p>
      </div>
    )
  }

  const brandName = studio.brand?.name ?? undefined

  return (
    <div className="space-y-4">
      <div className="space-y-[4px]">
        <h1
          style={{
            fontSize: '19px',
            fontWeight: 700,
            lineHeight: 1.3,
            color: BRAND_DEEP,
            fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
          }}
        >
          Performance
        </h1>
        <p className="text-[13px]" style={{ color: INK_3 }}>
          What your posting has actually done over {spokenPeriod(period)}. Open a channel to go
          deeper.
        </p>
        <SocialHangOffs />
      </div>

      <AnalyticsPeriodPicker
        value={period}
        onChange={setPeriod}
        note={sync.dataStaleness ? `Figures are ${sync.dataStaleness} old.` : null}
      />

      {accountsState.billingSuspended || sync.billingSuspended ? (
        <p
          className="rounded-[10px] px-[12px] py-[9px] text-[12.5px]"
          style={{
            border: '1px solid oklch(0.63 0.13 75)',
            background: 'oklch(0.964 0.052 80)',
            color: 'oklch(0.42 0.11 75)',
          }}
        >
          Results are paused across the whole site while we sort something out at our end. Nothing
          has been lost — the figures return on their own.
        </p>
      ) : null}

      {accountsState.accounts.length > 0 ? (
        <AnalyticsSyncProgress
          brandId={activeBrandId}
          sync={sync}
          accounts={accountsState.accounts}
        />
      ) : null}

      <AnalyticsAccountRow
        accounts={accountsState.accounts}
        selection={selection}
        onSelect={(next) => {
          setSelection(next)
          if (next.kind === 'summary') setTab('overview')
        }}
        loading={accountsState.loading}
        problem={accountsState.problem}
        linked={accountsState.linked}
      />

      {selection.kind === 'account' && selectedAccount ? (
        (() => {
          const channel = channelOf(selectedAccount.platform)
          if (!channel) {
            // A channel with no post-level report of its own — a business
            // listing, for instance. Its own figures are still worth showing,
            // and they are all there is to show.
            return (
              <NativeInsightsCard
                brandId={activeBrandId}
                accountId={selectedAccount.id}
                platform={selectedAccount.platform}
                period={period}
                channelLabel={selectedAccount.label}
              />
            )
          }
          return (
            <ChannelReport
              channel={channel}
              brandId={activeBrandId}
              {...(brandName ? { brandName } : {})}
              period={period}
              accountId={selectedAccount.id}
            />
          )
        })()
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'overview' | PlatformKey)}
          className="space-y-4"
        >
          {connectedChannels.length > 0 ? (
            <div className="overflow-x-auto">
              <TabsList variant="line" className="h-auto flex-wrap">
                <TabsTrigger value="overview">Everything</TabsTrigger>
                {connectedChannels.map((channel) => (
                  <TabsTrigger key={channel} value={channel} className="gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: PLATFORM_BRAND_COLOURS[channel] }}
                    />
                    {PLATFORM_LABELS[channel]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          ) : null}

          <TabsContent value="overview" className="space-y-4">
            <AnalyticsOverview
              brandId={activeBrandId}
              {...(brandName ? { brandName } : {})}
              period={period}
            />

            {intelligence.problem ? (
              <p className="text-[12.5px]" style={{ color: INK_3 }}>{intelligence.problem}</p>
            ) : null}

            <p className="text-[11.5px]" style={{ color: INK_3 }}>
              The four below are worked out over the last 90 days of your own results, whichever
              window is chosen above — a fortnight is not enough posting to draw a conclusion from.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <BestTimeCard slots={intelligence.bestTime} loading={intelligence.loading} />
              <ContentDecayCard buckets={intelligence.decay} loading={intelligence.loading} />
              <PostingFrequencyCard
                frequency={intelligence.frequency}
                loading={intelligence.loading}
              />
              <FollowerHistoryCard series={intelligence.followers} loading={intelligence.loading} />
            </div>

            {intelligence.responseTime ? (
              <p className="text-[12.5px]" style={{ color: INK_3 }}>
                You answer messages in about{' '}
                <span className="font-[600]" style={{ color: BRAND_DEEP }}>
                  {spokenDuration(intelligence.responseTime.medianSeconds)}
                </span>{' '}
                typically, and within{' '}
                {spokenDuration(intelligence.responseTime.p90Seconds)} nine times out of ten —
                measured across {intelligence.responseTime.sampleSize}{' '}
                {intelligence.responseTime.sampleSize === 1 ? 'conversation' : 'conversations'}.
              </p>
            ) : null}
          </TabsContent>

          {connectedChannels.map((channel) => (
            <TabsContent key={channel} value={channel}>
              <ChannelReport
                channel={channel}
                brandId={activeBrandId}
                {...(brandName ? { brandName } : {})}
                period={period}
                accountId={null}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
