'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartBar } from './ChartBar'
import { ChartLine } from './ChartLine'

/**
 * The four questions the numbers can answer that a posting tool cannot.
 *
 * When to post, how long a post keeps earning, how often to post, and whether
 * the audience is actually growing — each computed from this business's own
 * results, not from an industry article. They live together because they are
 * one idea: stop guessing at the schedule.
 *
 * ── The timezone trap ──────────────────────────────────────────────────
 * The hours upstream are UTC. Printing "09:00" beside an Australian clock
 * without converting moves every recommendation by ten hours — and the server
 * cannot do the conversion, because it does not know where the reader is.
 * The browser does, so it happens here, against a real Monday so the weekday
 * rolls correctly when the conversion crosses midnight.
 */

const BRAND = 'var(--brand, oklch(0.545 0.115 240))'
const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.08 240))'

/** A Monday, in UTC, used only as a reference point for the conversion. */
const REFERENCE_MONDAY = Date.UTC(2026, 0, 5)

export interface BestTimeSlotView {
  /** 0 = Monday on this endpoint. */
  dayOfWeek: number
  /** Hour of day in UTC. */
  hourUtc: number
  engagement: number
  postCount: number
}

/** The slot as the reader's own clock shows it. */
function localParts(slot: BestTimeSlotView): { day: string; dayLong: string; hour: string } {
  const at = new Date(REFERENCE_MONDAY + slot.dayOfWeek * 86_400_000 + slot.hourUtc * 3_600_000)
  return {
    day: at.toLocaleString('en-AU', { weekday: 'short' }),
    dayLong: at.toLocaleString('en-AU', { weekday: 'long' }),
    hour: at.toLocaleString('en-AU', { hour: 'numeric', hour12: true }),
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px] font-[600]" style={{ color: BRAND_DEEP }}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** One sentence, in place of a chart that has nothing to draw. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12.5px]" style={{ color: INK_3 }}>
      {children}
    </p>
  )
}

/* ── When to post ──────────────────────────────────────────────────────── */

export function BestTimeCard({
  slots,
  problem,
  loading,
  colour = BRAND,
}: {
  slots: BestTimeSlotView[]
  problem?: string | null
  loading?: boolean
  colour?: string
}) {
  const ranked = [...slots].sort((a, b) => b.engagement - a.engagement)
  const top = ranked.slice(0, 8)

  return (
    <Panel title="When your audience is actually about">
      {loading ? (
        <EmptyNote>Working out your best times…</EmptyNote>
      ) : problem ? (
        <EmptyNote>{problem}</EmptyNote>
      ) : top.length === 0 ? (
        <EmptyNote>
          Not enough published posts yet to see a pattern. A handful more and this fills in on its
          own.
        </EmptyNote>
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px]" style={{ color: INK_3 }}>
            Your strongest slot is{' '}
            <span className="font-[600]" style={{ color: BRAND_DEEP }}>
              {localParts(top[0]).dayLong} at {localParts(top[0]).hour}
            </span>{' '}
            — shown in your own time, from {top[0].postCount}{' '}
            {top[0].postCount === 1 ? 'post' : 'posts'}.
          </p>
          <ChartBar
            labels={top.map((slot) => `${localParts(slot).day} ${localParts(slot).hour}`)}
            data={top.map((slot) => slot.engagement)}
            colour={colour}
            height={200}
            yLabel="Average engagement"
          />
        </div>
      )}
    </Panel>
  )
}

/* ── How long a post keeps earning ─────────────────────────────────────── */

export interface DecayBucketView {
  order: number
  label: string
  averagePctOfFinal: number
  postCount: number
}

export function ContentDecayCard({
  buckets,
  problem,
  loading,
  colour = BRAND,
}: {
  buckets: DecayBucketView[]
  problem?: string | null
  loading?: boolean
  colour?: string
}) {
  const ordered = [...buckets].sort((a, b) => a.order - b.order)

  return (
    <Panel title="How long a post keeps earning">
      {loading ? (
        <EmptyNote>Reading how your posts age…</EmptyNote>
      ) : problem ? (
        <EmptyNote>{problem}</EmptyNote>
      ) : ordered.length === 0 ? (
        <EmptyNote>
          Nothing to measure yet — this needs a few posts that have been up long enough to settle.
        </EmptyNote>
      ) : (
        <div className="space-y-3">
          <p className="text-[12.5px]" style={{ color: INK_3 }}>
            Share of a post&apos;s final engagement earned by each point after it goes up. Where the
            line flattens is where reposting stops costing you anything.
          </p>
          <ChartLine
            labels={ordered.map((bucket) => bucket.label)}
            data={ordered.map((bucket) => Math.round(bucket.averagePctOfFinal))}
            colour={colour}
            height={200}
            yLabel="% of final engagement"
          />
        </div>
      )}
    </Panel>
  )
}

/* ── How often to post ─────────────────────────────────────────────────── */

export interface PostingFrequencyView {
  platform: string
  postsPerWeek: number
  averageEngagementRate: number
  averageEngagement: number
  weeksCounted: number
}

const CHANNEL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  twitter: 'X',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
}

function channelLabel(platform: string): string {
  const key = platform.toLowerCase().replace(/_(page|group|business)$/, '')
  return CHANNEL_LABELS[key] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
}

export function PostingFrequencyCard({
  frequency,
  problem,
  loading,
}: {
  frequency: PostingFrequencyView[]
  problem?: string | null
  loading?: boolean
}) {
  return (
    <Panel title="How often you post, and what it earns">
      {loading ? (
        <EmptyNote>Counting your last few weeks…</EmptyNote>
      ) : problem ? (
        <EmptyNote>{problem}</EmptyNote>
      ) : frequency.length === 0 ? (
        <EmptyNote>Nothing published yet on a connected channel, so there is nothing to count.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {frequency.map((row) => (
            <div
              key={row.platform}
              className="flex items-center justify-between gap-3 rounded-[5px] border px-3 py-[7px]"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-[12.5px] font-[500]" style={{ color: BRAND_DEEP }}>
                {channelLabel(row.platform)}
              </span>
              <span className="text-[12px] tabular-nums" style={{ color: INK_3 }}>
                {row.postsPerWeek.toFixed(1)} a week
                {row.weeksCounted > 0 ? ` over ${row.weeksCounted} weeks` : ''} ·{' '}
                {Math.round(row.averageEngagement).toLocaleString()} average engagement
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

/* ── Whether the audience is growing ───────────────────────────────────── */

export interface FollowerSeriesView {
  accountLabel: string
  points: { date: string; followers: number }[]
}

export function FollowerHistoryCard({
  series,
  problem,
  loading,
  colour = BRAND,
}: {
  series: FollowerSeriesView[]
  problem?: string | null
  loading?: boolean
  colour?: string
}) {
  const withData = series.filter((entry) => entry.points.length > 1)

  return (
    <Panel title="Whether your following is growing">
      {loading ? (
        <EmptyNote>Reading your follower history…</EmptyNote>
      ) : problem ? (
        <EmptyNote>{problem}</EmptyNote>
      ) : withData.length === 0 ? (
        <EmptyNote>
          Follower history starts building from the day a channel is connected, so there is nothing
          to draw yet.
        </EmptyNote>
      ) : (
        <div className="space-y-4">
          {withData.map((entry) => {
            const first = entry.points[0].followers
            const last = entry.points[entry.points.length - 1].followers
            const change = last - first
            return (
              <div key={entry.accountLabel} className="space-y-1">
                <p className="text-[12.5px]" style={{ color: INK_3 }}>
                  <span className="font-[600]" style={{ color: BRAND_DEEP }}>
                    {entry.accountLabel}
                  </span>{' '}
                  — {last.toLocaleString()} followers, {change >= 0 ? '+' : ''}
                  {change.toLocaleString()} over this period.
                </p>
                <ChartLine
                  labels={entry.points.map((point) => point.date.slice(5))}
                  data={entry.points.map((point) => point.followers)}
                  colour={colour}
                  height={160}
                />
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
