'use client'

import { useMemo, useState } from 'react'
import {
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Loader2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadQueue, useUploadQueue, type UploadQueueItem } from './uploadQueueStore'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusLabel(item: UploadQueueItem): string {
  switch (item.status) {
    case 'queued':
      return 'Waiting...'
    case 'uploading':
      return `Uploading ${item.progress}%`
    case 'paused':
      return 'Paused'
    case 'completed':
      return 'Uploaded'
    case 'failed':
      return item.error ?? 'Upload failed'
    case 'aborted':
      return 'Stopped'
  }
}

function StatusIcon({ item }: { item: UploadQueueItem }) {
  const className = 'h-4 w-4 shrink-0'
  switch (item.status) {
    case 'completed':
      return <CheckCircle2 className={cn(className, 'text-emerald-400')} />
    case 'failed':
      return <AlertCircle className={cn(className, 'text-red-400')} />
    case 'aborted':
      return <XCircle className={cn(className, 'text-muted-foreground')} />
    case 'paused':
      return <Pause className={cn(className, 'text-amber-400')} />
    case 'uploading':
      return <Loader2 className={cn(className, 'animate-spin text-[oklch(0.65_0.12_240)]')} />
    default:
      return <Loader2 className={cn(className, 'text-muted-foreground')} />
  }
}

export function UploadQueuePanel() {
  const items = useUploadQueue()
  const [collapsed, setCollapsed] = useState(false)
  const [hidden, setHidden] = useState(false)

  const summary = useMemo(() => {
    const total = items.length
    const completed = items.filter((i) => i.status === 'completed').length
    const failed = items.filter((i) => i.status === 'failed').length
    const active = items.filter((i) => i.status === 'uploading' || i.status === 'queued').length
    return { total, completed, failed, active }
  }, [items])

  if (items.length === 0 || hidden) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl ring-1 ring-foreground/5"
      role="region"
      aria-label="Upload queue"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {summary.active > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin text-[oklch(0.65_0.12_240)]" />
          ) : summary.failed > 0 ? (
            <AlertCircle className="h-4 w-4 text-red-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          <span className="truncate text-xs font-semibold text-foreground">
            {summary.active > 0
              ? `Uploading ${summary.active} of ${summary.total}`
              : `${summary.completed} uploaded${summary.failed ? ` · ${summary.failed} failed` : ''}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? 'Expand upload panel' : 'Collapse upload panel'}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (summary.active > 0) {
                if (!confirm('Uploads in progress will be cancelled. Continue?')) return
                for (const item of items) {
                  if (item.status === 'uploading' || item.status === 'queued') item.abort?.()
                }
              }
              uploadQueue.clearAll()
              setHidden(true)
              // Re-show automatically once new uploads arrive.
              setTimeout(() => setHidden(false), 50)
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss upload panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="max-h-[320px] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
            >
              <StatusIcon item={item} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{item.fileName}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatBytes(item.fileSize)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full transition-all duration-200',
                        item.status === 'failed'
                          ? 'bg-red-500'
                          : item.status === 'aborted'
                            ? 'bg-muted-foreground'
                            : item.status === 'paused'
                              ? 'bg-amber-400'
                              : 'bg-[oklch(0.65_0.12_240)]'
                      )}
                      style={{ width: `${item.status === 'completed' ? 100 : item.progress}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {statusLabel(item)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-0.5">
                {item.status === 'uploading' && item.pause && (
                  <button
                    type="button"
                    onClick={() => item.pause?.()}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Pause upload"
                  >
                    <Pause className="h-3 w-3" />
                  </button>
                )}
                {item.status === 'paused' && item.resume && (
                  <button
                    type="button"
                    onClick={() => item.resume?.()}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Resume upload"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                )}
                {(item.status === 'uploading' || item.status === 'paused' || item.status === 'queued') && (
                  <button
                    type="button"
                    onClick={() => item.abort?.()}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Cancel upload"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {(item.status === 'completed' || item.status === 'failed' || item.status === 'aborted') && (
                  <button
                    type="button"
                    onClick={() => uploadQueue.remove(item.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Remove from list"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {!collapsed && summary.completed > 0 && (
        <div className="flex justify-end border-t border-border bg-muted/30 px-3 py-1.5">
          <button
            type="button"
            onClick={() => uploadQueue.clearCompleted()}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Clear completed
          </button>
        </div>
      )}
    </div>
  )
}
