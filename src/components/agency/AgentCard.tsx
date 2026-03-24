'use client'

import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS } from '@/types/database'
import type { AgentRegistryEntry } from '@/types/database'

interface AgentCardProps {
  agent: AgentRegistryEntry
  onPause?: () => void
  onResume?: () => void
}

const STATUS_STYLES: Record<string, string> = {
  idle: 'bg-emerald-500/15 text-emerald-400',
  working: 'bg-blue-500/15 text-blue-400',
  paused: 'bg-amber-500/15 text-amber-400',
  terminated: 'bg-red-500/15 text-red-400',
}

export function AgentCard({ agent, onPause, onResume }: AgentCardProps) {
  const budgetPercent = agent.budget_monthly_cents > 0
    ? Math.min(100, Math.round((agent.spent_monthly_cents / agent.budget_monthly_cents) * 100))
    : 0

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="flex items-start gap-3">
        <AgentAvatar agentType={agent.agent_type} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {AGENT_LABELS[agent.agent_type]}
            </p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[agent.status] ?? STATUS_STYLES.idle}`}>
              {agent.status}
            </span>
          </div>
          {agent.department && (
            <p className="text-xs text-muted-foreground truncate">{agent.department}</p>
          )}
        </div>
      </div>

      {/* Budget bar */}
      {agent.budget_monthly_cents > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>${(agent.spent_monthly_cents / 100).toFixed(2)} spent</span>
            <span>${(agent.budget_monthly_cents / 100).toFixed(2)} limit</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {agent.status === 'idle' || agent.status === 'working' ? (
          <button
            onClick={onPause}
            className="text-[10px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Pause
          </button>
        ) : agent.status === 'paused' ? (
          <button
            onClick={onResume}
            className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Resume
          </button>
        ) : null}
      </div>
    </div>
  )
}
