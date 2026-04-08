'use client'

import { useState, useCallback } from 'react'
import { Check, X, MessageCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApprovalActionsProps {
  postId: string
  currentStatus: string
  onStatusChanged: () => void
}

export function ApprovalActions({ postId, currentStatus, onStatusChanged }: ApprovalActionsProps) {
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)

  const rawId = postId.replace(/^(post|output)-/, '')

  const handleApprove = useCallback(async () => {
    setSaving(true)
    try {
      await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rawId, status: 'scheduled' }),
      })
      onStatusChanged()
    } finally {
      setSaving(false)
    }
  }, [rawId, onStatusChanged])

  const handleReject = useCallback(async () => {
    setSaving(true)
    try {
      await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rawId,
          status: 'draft',
          metadata: { rejection_reason: rejectReason || 'Rejected without reason' },
        }),
      })
      setRejecting(false)
      setRejectReason('')
      onStatusChanged()
    } finally {
      setSaving(false)
    }
  }, [rawId, rejectReason, onStatusChanged])

  // Only show for draft/scheduled
  if (!['draft', 'scheduled'].includes(currentStatus)) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {currentStatus === 'draft' && (
          <button
            type="button"
            disabled={saving}
            onClick={handleApprove}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-green-500/15 text-green-400 hover:bg-green-500/25'
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve & Schedule
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() => setRejecting(!rejecting)}
          className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <X className="h-3 w-3" />
          Reject
        </button>
      </div>

      {rejecting && (
        <div className="space-y-1.5">
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)..."
            rows={2}
            autoFocus
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleReject}
              disabled={saving}
              className="rounded-md bg-red-500/20 px-2.5 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/30"
            >
              {saving ? 'Rejecting...' : 'Confirm Reject'}
            </button>
            <button
              type="button"
              onClick={() => { setRejecting(false); setRejectReason('') }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
