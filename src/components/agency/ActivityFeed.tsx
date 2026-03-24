'use client'

import { useEffect, useState } from 'react'
import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS, ACTIVE_AGENT_TYPES } from '@/types/database'
import type { AgentType, AuditLogEntry } from '@/types/database'

type AuditEntryWithAgent = AuditLogEntry & {
  agent_registry?: { agent_type: AgentType; department: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  chat_completed: 'Completed a chat',
  delegation_completed: 'Delegation completed',
  task_created: 'Created a task',
  task_completed: 'Completed a task',
  approval_requested: 'Requested approval',
  approval_granted: 'Approval granted',
  approval_rejected: 'Approval rejected',
  output_saved: 'Saved output',
  scan_completed: 'Scan completed',
  heartbeat_completed: 'Heartbeat ran',
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function ActivityFeed() {
  const [entries, setEntries] = useState<AuditEntryWithAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AgentType | 'all'>('all')

  const fetchActivity = () => {
    const params = new URLSearchParams({ limit: '50' })
    fetch(`/api/audit?${params}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEntries(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchActivity() }, [])

  const filtered = filter === 'all'
    ? entries
    : entries.filter(e => e.agent_registry?.agent_type === filter)

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <FilterTab value="all" label="All" active={filter} onSelect={() => setFilter('all')} />
        {ACTIVE_AGENT_TYPES.map(at => (
          <FilterTab
            key={at}
            value={at}
            label={AGENT_LABELS[at]}
            active={filter}
            onSelect={() => setFilter(at)}
          />
        ))}
      </div>

      {/* Refresh button */}
      <button
        onClick={fetchActivity}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Refresh
      </button>

      {/* Timeline */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading activity...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No activity {filter !== 'all' ? `for ${AGENT_LABELS[filter]}` : 'yet'}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(entry => (
            <ActivityEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterTab({ value, label, active, onSelect }: {
  value: string
  label: string
  active: string
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active === value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}

function ActivityEntry({ entry }: { entry: AuditEntryWithAgent }) {
  const agentType = entry.agent_registry?.agent_type ?? 'overall'
  const actionLabel = ACTION_LABELS[entry.action] ?? entry.action
  const detail = entry.detail as Record<string, unknown> | null

  // Build description from detail
  let description = actionLabel
  if (detail) {
    if (detail.agentType && entry.action === 'chat_completed') {
      description = `Chat with ${AGENT_LABELS[detail.agentType as AgentType] ?? detail.agentType}`
    }
    if (detail.task && entry.action === 'delegation_completed') {
      description = `Delegation: ${String(detail.task).slice(0, 80)}`
    }
    if (detail.brand) {
      description += ` (${detail.brand})`
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-border/80">
      <AgentAvatar agentType={agentType} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-medium text-foreground truncate">
            {AGENT_LABELS[agentType]}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatTimeAgo(entry.created_at)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {description}
        </p>
        {entry.cost_cents > 0 && (
          <span className="inline-flex mt-1 rounded-full bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-400">
            ${(entry.cost_cents / 100).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}
