'use client'

import { useEffect, useState } from 'react'
import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS } from '@/types/database'
import type { AgentRegistryEntry } from '@/types/database'

export function CostDashboard() {
  const [agents, setAgents] = useState<AgentRegistryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => { setAgents(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading costs...</div>
  }

  const totalSpent = agents.reduce((sum, a) => sum + a.spent_monthly_cents, 0)
  const totalBudget = agents.reduce((sum, a) => sum + a.budget_monthly_cents, 0)

  const sorted = [...agents]
    .filter(a => a.budget_monthly_cents > 0)
    .sort((a, b) => b.spent_monthly_cents - a.spent_monthly_cents)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Spent</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            ${(totalSpent / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Budget</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            ${(totalBudget / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Per-agent breakdown */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Per Agent
        </h3>
        <div className="space-y-2">
          {sorted.map(agent => {
            const percent = agent.budget_monthly_cents > 0
              ? Math.round((agent.spent_monthly_cents / agent.budget_monthly_cents) * 100)
              : 0

            return (
              <div key={agent.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <AgentAvatar agentType={agent.agent_type} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground truncate">
                      {AGENT_LABELS[agent.agent_type]}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      ${(agent.spent_monthly_cents / 100).toFixed(2)} / ${(agent.budget_monthly_cents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${percent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
