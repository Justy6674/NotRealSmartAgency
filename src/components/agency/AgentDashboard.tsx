'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AgentCard } from './AgentCard'
import type { AgentRegistryEntry } from '@/types/database'

export function AgentDashboard() {
  const [agents, setAgents] = useState<AgentRegistryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAgents = async () => {
    const res = await fetch('/api/agents')
    if (res.ok) {
      const data = await res.json()
      setAgents(data)
    }
    setLoading(false)
  }

  useEffect(() => { fetchAgents() }, [])

  const handleAction = async (agentId: string, action: 'pause' | 'resume') => {
    await fetch(`/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    fetchAgents()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading agents...</div>
  }

  const director = agents.find(a => a.role === 'director')
  const heads = agents.filter(a => a.role === 'head')

  return (
    <div className="space-y-6">
      {/* Director */}
      {director && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Director</h3>
          <AgentCard
            agent={director}
            onPause={() => handleAction(director.id, 'pause')}
            onResume={() => handleAction(director.id, 'resume')}
          />
        </div>
      )}

      {/* Department Heads */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Department Heads ({heads.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {heads.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onPause={() => handleAction(agent.id, 'pause')}
              onResume={() => handleAction(agent.id, 'resume')}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
