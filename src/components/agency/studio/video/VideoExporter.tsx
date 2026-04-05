'use client'

import { useState } from 'react'
import { Download, CalendarPlus, Send } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

interface VideoExporterProps {
  brand: Brand | null
  videoTitle?: string
  outputId?: string
}

const PLATFORM_FORMATS = [
  { id: 'tiktok', label: 'TikTok / Reels', dimensions: '1080x1920', ratio: '9:16' },
  { id: 'youtube', label: 'YouTube', dimensions: '1920x1080', ratio: '16:9' },
  { id: 'instagram_feed', label: 'Instagram Feed', dimensions: '1080x1080', ratio: '1:1' },
  { id: 'linkedin', label: 'LinkedIn', dimensions: '1920x1080', ratio: '16:9' },
  { id: 'facebook', label: 'Facebook', dimensions: '1280x720', ratio: '16:9' },
]

type ExportAction = 'save' | 'schedule' | 'publish'

export function VideoExporter({ brand, videoTitle, outputId }: VideoExporterProps) {
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['tiktok'])
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [action, setAction] = useState<ExportAction>('save')

  const toggleFormat = (id: string) => {
    setSelectedFormats(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const handleExport = () => {
    if (!brand) return

    const platformNames = selectedFormats
      .map(id => PLATFORM_FORMATS.find(p => p.id === id)?.label)
      .filter(Boolean)
      .join(', ')

    let actionText = ''
    if (action === 'save') {
      actionText = 'Save to the output library.'
    } else if (action === 'schedule') {
      actionText = `Schedule for ${scheduleDate} at ${scheduleTime} AEST.`
    } else {
      actionText = 'Publish now via Mixpost.'
    }

    sendToDirector(
      `Export the video "${videoTitle ?? 'latest video'}" for ${brand.name} to these formats: ${platformNames}. ${actionText}${outputId ? `\n\nOutput ID: ${outputId}` : ''}`
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Export & Schedule</h3>

      {/* Platform format checkboxes */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Platform formats</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_FORMATS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleFormat(p.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                selectedFormats.includes(p.id)
                  ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10 text-[oklch(0.75_0.06_240)]'
                  : 'border-border text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30'
              }`}
            >
              {p.label}
              <span className="ml-1 text-[9px] opacity-60">{p.dimensions}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action selector */}
      <div className="flex gap-2">
        {(['save', 'schedule', 'publish'] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
              action === a
                ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10 text-[oklch(0.75_0.06_240)]'
                : 'border-border text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30'
            }`}
          >
            {a === 'save' && 'Save to Library'}
            {a === 'schedule' && 'Schedule'}
            {a === 'publish' && 'Publish Now'}
          </button>
        ))}
      </div>

      {/* Schedule date/time picker */}
      {action === 'schedule' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Date</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Time (AEST)</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={e => setScheduleTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        disabled={selectedFormats.length === 0 || !brand}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-4 py-2.5 text-sm font-medium text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors disabled:opacity-50"
      >
        {action === 'save' && <Download className="h-4 w-4" />}
        {action === 'schedule' && <CalendarPlus className="h-4 w-4" />}
        {action === 'publish' && <Send className="h-4 w-4" />}
        {action === 'save' && 'Save to Library'}
        {action === 'schedule' && 'Add to Calendar'}
        {action === 'publish' && 'Publish Now'}
      </button>
    </div>
  )
}
