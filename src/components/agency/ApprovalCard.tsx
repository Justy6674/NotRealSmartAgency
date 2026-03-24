'use client'

import { useState } from 'react'
import { AgentAvatar } from './AgentAvatar'
import type { ApprovalQueueEntry, AgentType } from '@/types/database'

interface ApprovalCardProps {
  approval: ApprovalQueueEntry & {
    agent_registry?: { agent_type: AgentType; department: string } | null
    tasks?: { title: string } | null
  }
  onDecision: (id: string, status: 'approved' | 'rejected', note?: string) => void
}

export function ApprovalCard({ approval, onDecision }: ApprovalCardProps) {
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)

  const handleDecision = async (status: 'approved' | 'rejected') => {
    setActing(true)
    await onDecision(approval.id, status, note || undefined)
    setActing(false)
  }

  const payload = approval.payload as Record<string, unknown>
  const description = (payload.description as string) ?? approval.action_type

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {approval.agent_registry && (
          <AgentAvatar agentType={approval.agent_registry.agent_type} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {approval.action_type}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </p>
          {approval.tasks?.title && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Task: {approval.tasks.title}
            </p>
          )}
        </div>
      </div>

      {approval.status === 'pending' && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            placeholder="Optional note..."
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleDecision('approved')}
              disabled={acting}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleDecision('rejected')}
              disabled={acting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {approval.status !== 'pending' && (
        <div className="mt-2">
          <span className={`text-xs font-medium ${approval.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
            {approval.status}
          </span>
          {approval.decision_note && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{approval.decision_note}</p>
          )}
        </div>
      )}
    </div>
  )
}
