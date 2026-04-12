'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { createClient } from '@/lib/supabase/client'

interface PerformanceAlert {
  id: string
  entity_id: string
  details: {
    alert_type: string
    message: string
    severity: 'warning' | 'critical'
    platform?: string
    count?: number
  }
  created_at: string
}

const DISMISS_KEY = 'nrs-alerts-dismissed'

/**
 * AlertsBanner — renders proactive monitor alerts at the top of Studio.
 *
 * Fetches recent performance_alert entries from audit_log for the active
 * brand (last 48 hours). Red for critical, amber for warnings. Click the
 * banner text to open Director chat with the alert context. Dismiss
 * hides for the current session (localStorage).
 */
export function AlertsBanner() {
  const { activeBrandId } = useAgencyStore()
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check session-level dismiss
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY)
      if (stored === activeBrandId) setDismissed(true)
      else setDismissed(false)
    } catch {
      setDismissed(false)
    }
  }, [activeBrandId])

  const fetchAlerts = useCallback(async () => {
    if (!activeBrandId) {
      setAlerts([])
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const fortyEightHoursAgo = new Date(
        Date.now() - 48 * 60 * 60 * 1000
      ).toISOString()

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, entity_id, details, created_at')
        .eq('action', 'performance_alert')
        .eq('entity_type', 'brand')
        .eq('entity_id', activeBrandId)
        .gte('created_at', fortyEightHoursAgo)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Failed to fetch alerts:', error)
        setAlerts([])
        return
      }

      setAlerts((data ?? []) as unknown as PerformanceAlert[])
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  if (loading || dismissed || !alerts.length) return null

  const hasCritical = alerts.some(
    (a) => a.details?.severity === 'critical'
  )
  const latestMessage = alerts[0]?.details?.message ?? 'Issues detected'

  const handleClick = () => {
    // Navigate to Director chat with alert context
    const store = useAgencyStore.getState()
    const alertSummary = alerts
      .map((a) => `- ${a.details?.message}`)
      .join('\n')
    const message = `I have ${alerts.length} alert${alerts.length === 1 ? '' : 's'} that need attention:\n\n${alertSummary}\n\nPlease diagnose these issues and suggest what I should do.`

    // Set pending review message — the chat panel picks it up automatically
    store.setPendingReviewMessage(message)
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, activeBrandId ?? '')
    } catch {
      // sessionStorage unavailable
    }
  }

  return (
    <div
      role="alert"
      onClick={handleClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
        hasCritical
          ? 'border-[oklch(0.65_0.2_25/0.4)] bg-[oklch(0.65_0.2_25/0.08)] text-[oklch(0.65_0.2_25)]'
          : 'border-[oklch(0.75_0.15_75/0.4)] bg-[oklch(0.75_0.15_75/0.08)] text-[oklch(0.75_0.15_75)]'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold">
          {alerts.length} alert{alerts.length === 1 ? '' : 's'}
        </span>
        <span className="mx-2 text-xs opacity-60">|</span>
        <span className="text-xs">{latestMessage}</span>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity"
        title="Dismiss alerts for this session"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
