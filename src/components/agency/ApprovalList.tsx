'use client'

import { useEffect, useState } from 'react'
import { ApprovalCard } from './ApprovalCard'
import type { ApprovalQueueEntry, AgentType } from '@/types/database'

type ApprovalWithRelations = ApprovalQueueEntry & {
  agent_registry?: { agent_type: AgentType; department: string } | null
  tasks?: { title: string } | null
}

export function ApprovalList() {
  const [approvals, setApprovals] = useState<ApprovalWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApprovals = async () => {
    const res = await fetch('/api/approvals?status=pending')
    if (res.ok) setApprovals(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchApprovals() }, [])

  const handleDecision = async (id: string, status: 'approved' | 'rejected', note?: string) => {
    await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, decision_note: note }),
    })
    fetchApprovals()
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading approvals...</div>
  }

  if (approvals.length === 0) {
    return <div className="py-12 text-center text-muted-foreground">No pending approvals. All clear.</div>
  }

  return (
    <div className="space-y-3">
      {approvals.map(approval => (
        <ApprovalCard key={approval.id} approval={approval} onDecision={handleDecision} />
      ))}
    </div>
  )
}
