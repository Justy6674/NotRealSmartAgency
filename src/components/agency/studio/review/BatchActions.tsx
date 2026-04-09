'use client'

import { useState } from 'react'
import { Check, X, Calendar, MessageSquare, CheckCheck, Loader2 } from 'lucide-react'

interface BatchActionsProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onApproveAll: () => void
  onRejectAll: (reason: string) => void
  onScheduleAll: (date: string) => void
  onAskDirectorAll: () => void
  loading?: boolean
}

const REJECT_REASONS = [
  "Doesn't match brand voice",
  'Compliance issue',
  'Needs different hashtags',
  'Wrong platform or timing',
  'Content needs rewriting',
]

export function BatchActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onApproveAll,
  onRejectAll,
  onScheduleAll,
  onAskDirectorAll,
  loading,
}: BatchActionsProps) {
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')

  if (selectedCount === 0) return null

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-card/95 px-4 py-2.5 shadow-sm backdrop-blur-sm">
        <span className="text-xs font-medium text-foreground">
          {selectedCount} selected
        </span>

        <button
          onClick={selectedCount < totalCount ? onSelectAll : onClearSelection}
          className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
        >
          {selectedCount < totalCount ? 'Select all' : 'Clear'}
        </button>

        <div className="flex-1" />

        <button
          onClick={onAskDirectorAll}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Director Review
        </button>

        <button
          onClick={() => setShowScheduleModal(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Calendar className="h-3.5 w-3.5" />
          Schedule All
        </button>

        <button
          onClick={onApproveAll}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.72_0.15_145)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[oklch(0.65_0.15_145)] transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Approve All
        </button>

        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.65_0.2_25/0.3)] px-3 py-1.5 text-[11px] font-medium text-[oklch(0.65_0.2_25)] hover:bg-[oklch(0.65_0.2_25/0.1)] transition-colors disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Reject All
        </button>
      </div>

      {/* Reject reason modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground mb-3">Reject {selectedCount} drafts</h3>
            <div className="space-y-2 mb-3">
              {REJECT_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setRejectReason(r)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    rejectReason === r
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Or type a custom reason..."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason('') }}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onRejectAll(rejectReason); setShowRejectModal(false); setRejectReason('') }}
                disabled={!rejectReason.trim()}
                className="rounded-md bg-[oklch(0.65_0.2_25)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[oklch(0.58_0.2_25)] disabled:opacity-50 transition-colors"
              >
                Reject {selectedCount} drafts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule date modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground mb-3">Schedule {selectedCount} drafts</h3>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowScheduleModal(false); setScheduleDate('') }}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onScheduleAll(scheduleDate); setShowScheduleModal(false); setScheduleDate('') }}
                disabled={!scheduleDate}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Schedule All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
