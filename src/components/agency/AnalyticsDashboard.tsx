'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Send,
  FileText,
  DollarSign,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { AGENT_LABELS, OUTPUT_LABELS } from '@/types/database'
import type { AgentType, OutputType } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d'

interface AnalyticsData {
  summary: {
    totalPosts: number
    totalDrafts: number
    failedPosts: number
    totalOutputs: number
    aiSpendCents: number
    agentInteractions: number
  }
  postsByPlatform: Record<string, number>
  postsByStatus: Record<string, number>
  postsByDay: Array<{ date: string; count: number }>
  outputsByType: Record<string, number>
  topOutputs: Array<{ id: string; title: string; type: string; created_at: string }>
  aiSpendByAgent: Record<string, number>
  aiInteractionsByAgent: Record<string, number>
}

// ─── Platform colours ─────────────────────────────────────────────────────────

const PLATFORM_COLOURS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-500',
  twitter: 'bg-zinc-500',
  tiktok: 'bg-cyan-500',
  youtube: 'bg-red-500',
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const { activeBrandId } = useAgencyStore()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30d')

  const fetchData = useCallback(async () => {
    if (!activeBrandId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ brandId: activeBrandId, period })
      const res = await fetch(`/api/analytics?${params}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch (err) {
      console.error('[analytics] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [activeBrandId, period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!activeBrandId) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Select a brand to view analytics.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading analytics...</div>
    )
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Failed to load analytics data.
      </div>
    )
  }

  const isEmpty =
    data.summary.totalPosts === 0 &&
    data.summary.totalOutputs === 0 &&
    data.summary.agentInteractions === 0

  if (isEmpty) {
    return (
      <div className="space-y-4">
        <PeriodSelector period={period} onChange={setPeriod} />
        <div className="py-12 text-center text-muted-foreground">
          No data yet. Start chatting with your agents to generate content and see results here.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <PeriodSelector period={period} onChange={setPeriod} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={Send}
          label="Posts Published"
          value={data.summary.totalPosts}
          sub={
            data.summary.totalDrafts > 0 || data.summary.failedPosts > 0
              ? `${data.summary.totalDrafts} draft${data.summary.totalDrafts !== 1 ? 's' : ''}${data.summary.failedPosts > 0 ? `, ${data.summary.failedPosts} failed` : ''}`
              : undefined
          }
        />
        <SummaryCard
          icon={FileText}
          label="Content Created"
          value={data.summary.totalOutputs}
        />
        <SummaryCard
          icon={DollarSign}
          label="AI Spend"
          value={`$${(data.summary.aiSpendCents / 100).toFixed(2)}`}
        />
        <SummaryCard
          icon={MessageSquare}
          label="Agent Interactions"
          value={data.summary.agentInteractions}
        />
      </div>

      {/* Posts by platform */}
      {Object.keys(data.postsByPlatform).length > 0 && (
        <Section title="Posts by Platform">
          <HorizontalBarChart
            data={data.postsByPlatform}
            colourMap={PLATFORM_COLOURS}
            labelMap={PLATFORM_LABELS}
          />
        </Section>
      )}

      {/* Posts by day */}
      {data.postsByDay.length > 0 && (
        <Section title="Post Volume">
          <DailyBarChart data={data.postsByDay} period={period} />
        </Section>
      )}

      {/* Content by type */}
      {Object.keys(data.outputsByType).length > 0 && (
        <Section title="Content by Type">
          <HorizontalBarChart
            data={data.outputsByType}
            labelMap={OUTPUT_LABELS as Record<string, string>}
          />
        </Section>
      )}

      {/* AI spend by agent */}
      {Object.keys(data.aiSpendByAgent).length > 0 && (
        <Section title="AI Spend by Agent">
          <AgentSpendTable
            spendByAgent={data.aiSpendByAgent}
            interactionsByAgent={data.aiInteractionsByAgent}
          />
        </Section>
      )}

      {/* Recent content */}
      {data.topOutputs.length > 0 && (
        <Section title="Recent Content">
          <ul className="space-y-2">
            {data.topOutputs.map((output) => (
              <li
                key={output.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {output.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(output.created_at).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {OUTPUT_LABELS[output.type as OutputType] ?? output.type}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PeriodSelector({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const options: Period[] = ['7d', '30d', '90d']
  const labels: Record<Period, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days' }

  return (
    <div className="flex gap-1">
      {options.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            period === p
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

function HorizontalBarChart({
  data,
  colourMap,
  labelMap,
}: {
  data: Record<string, number>
  colourMap?: Record<string, string>
  labelMap?: Record<string, string>
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a)
  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="space-y-2">
      {entries.map(([key, count]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-muted-foreground text-right">
            {labelMap?.[key] ?? key}
          </span>
          <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                colourMap?.[key] ?? 'bg-primary'
              )}
              style={{ width: `${Math.max((count / max) * 100, 4)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-xs font-medium text-foreground text-right">
            {count}
          </span>
        </div>
      ))}
    </div>
  )
}

function DailyBarChart({ data, period }: { data: Array<{ date: string; count: number }>; period: Period }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  const showEvery = period === '7d' ? 1 : 7

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-end gap-px" style={{ height: 120 }}>
        {data.map((day, i) => {
          const heightPct = max > 0 ? (day.count / max) * 100 : 0
          return (
            <div
              key={day.date}
              className="group relative flex-1 flex flex-col items-center justify-end"
              style={{ height: '100%' }}
            >
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block rounded bg-popover px-1.5 py-0.5 text-[10px] text-popover-foreground shadow whitespace-nowrap z-10">
                {day.count} post{day.count !== 1 ? 's' : ''} &middot;{' '}
                {new Date(day.date + 'T00:00:00').toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
              <div
                className={cn(
                  'w-full rounded-sm transition-all',
                  day.count > 0 ? 'bg-primary' : 'bg-muted'
                )}
                style={{ height: `${Math.max(heightPct, 2)}%`, minHeight: 2 }}
              />
            </div>
          )
        })}
      </div>
      {/* X-axis labels */}
      <div className="mt-1.5 flex">
        {data.map((day, i) => (
          <div key={day.date} className="flex-1 text-center">
            {i % showEvery === 0 ? (
              <span className="text-[9px] text-muted-foreground">
                {new Date(day.date + 'T00:00:00').toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentSpendTable({
  spendByAgent,
  interactionsByAgent,
}: {
  spendByAgent: Record<string, number>
  interactionsByAgent: Record<string, number>
}) {
  const entries = Object.entries(spendByAgent).sort(([, a], [, b]) => b - a)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Agent</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Spend</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Interactions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([agent, spend]) => (
            <tr key={agent} className="border-b border-border last:border-0">
              <td className="px-4 py-2 text-foreground">
                {AGENT_LABELS[agent as AgentType] ?? agent}
              </td>
              <td className="px-4 py-2 text-right text-foreground">
                ${(spend / 100).toFixed(2)}
              </td>
              <td className="px-4 py-2 text-right text-muted-foreground">
                {interactionsByAgent[agent] ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
