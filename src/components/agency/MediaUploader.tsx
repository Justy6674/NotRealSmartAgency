'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Loader2, Check, X, AlertTriangle } from 'lucide-react'
import {
  runLibraryUpload,
  UploadAbortError,
  type UploadLogFn,
} from '@/lib/media/browser-upload'
import { formatUploadBytes } from '@/lib/media/format-upload-bytes'
import { validateIntakeFile } from '@/lib/media/intake-validation'
import {
  NRS_MEDIA_UPLOAD_FOCUS,
  type MediaUploadFocusDetail,
} from '@/lib/media/upload-focus'
import { uploadQueue } from '@/components/agency/studio/media/uploadQueueStore'

interface UploadRow {
  id: string
  fileName: string
  fileSize: number
  status: 'uploading' | 'ready' | 'error' | 'stopped'
  percent: number
  error?: string
  abort: () => void
}

interface MediaUploaderProps {
  brandId: string
  onUploadComplete: () => void
}

const BUILD_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'

function logBreadcrumb(traceId: string, step: string, data?: Record<string, unknown>) {
  console.log(`[NRS-UPLOAD ${BUILD_SHA}] ${step}`, data ?? '')
  try {
    fetch('/api/debug/upload-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trace_id: traceId,
        step,
        data: data ?? {},
        build_sha: BUILD_SHA,
        ts: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* never block the upload on a log */
  }
}

export function MediaUploader({ brandId, onUploadComplete }: MediaUploaderProps) {
  const [rows, setRows] = useState<UploadRow[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<MediaUploadFocusDetail>).detail
      dropRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      dropRef.current?.focus({ preventScroll: true })
      dropRef.current?.classList.add('ring-2', 'ring-primary/60')
      window.setTimeout(
        () => dropRef.current?.classList.remove('ring-2', 'ring-primary/60'),
        2400,
      )
      if (detail?.mode === 'picker') inputRef.current?.click()
    }
    window.addEventListener(NRS_MEDIA_UPLOAD_FOCUS, handler)
    return () => window.removeEventListener(NRS_MEDIA_UPLOAD_FOCUS, handler)
  }, [])

  const patchRow = (id: string, patch: Partial<UploadRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const dismissRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  const processFile = async (file: File) => {
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const queueId = crypto.randomUUID()
    const abortController = new AbortController()

    logBreadcrumb(traceId, 'processFile:entry', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      brandId,
    })

    const validationError = validateIntakeFile({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })
    if (validationError) {
      setRows((prev) => [
        ...prev,
        {
          id: queueId,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          percent: 0,
          error: validationError,
          abort: () => {},
        },
      ])
      return
    }

    const abort = () => abortController.abort()

    setRows((prev) => [
      ...prev,
      {
        id: queueId,
        fileName: file.name,
        fileSize: file.size,
        status: 'uploading',
        percent: 0,
        abort,
      },
    ])

    uploadQueue.add({
      id: queueId,
      fileName: file.name,
      fileSize: file.size,
      brandId,
      abort,
    })
    uploadQueue.update(queueId, { status: 'uploading' })

    const log: UploadLogFn = (step, data) => logBreadcrumb(traceId, step, data)

    try {
      await runLibraryUpload({
        brandId,
        file,
        clientUploadId: queueId,
        signal: abortController.signal,
        onProgress: (percent) => {
          patchRow(queueId, { percent })
          uploadQueue.update(queueId, { progress: percent })
        },
        log,
      })
      patchRow(queueId, { status: 'ready', percent: 100 })
      uploadQueue.update(queueId, { status: 'completed', progress: 100 })
      onUploadComplete()
    } catch (err) {
      if (err instanceof UploadAbortError || abortController.signal.aborted) {
        patchRow(queueId, { status: 'stopped', percent: 0 })
        uploadQueue.update(queueId, { status: 'aborted' })
        log('processFile:stopped')
        return
      }
      const message =
        err instanceof Error ? err.message : 'That upload did not finish. Try again.'
      patchRow(queueId, { status: 'error', error: message })
      uploadQueue.update(queueId, { status: 'failed', error: message })
      log('processFile:terminal error', { error: message })
    }
  }

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        void processFile(file)
      }
    },
    // brandId captured by processFile closure on each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brandId, onUploadComplete],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  return (
    <div className="space-y-4">
      <div
        ref={dropRef}
        tabIndex={-1}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors outline-none"
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">
          Videos, photos, or audio — AI describes and captions everything
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
              {row.status === 'uploading' && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(row.percent, 2)}%` }}
                />
              )}
              <div className="relative space-y-2 p-3">
                <div className="flex items-start gap-2">
                  {row.status === 'uploading' && (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                  {row.status === 'ready' && (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  {row.status === 'error' && (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  )}
                  {row.status === 'stopped' && (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{row.fileName}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatUploadBytes(row.fileSize)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all duration-200 ${
                            row.status === 'error'
                              ? 'bg-red-500'
                              : row.status === 'stopped'
                                ? 'bg-muted-foreground/40'
                                : row.status === 'ready'
                                  ? 'bg-emerald-500'
                                  : 'bg-primary'
                          }`}
                          style={{
                            width: `${
                              row.status === 'ready'
                                ? 100
                                : row.status === 'stopped'
                                  ? 0
                                  : row.percent
                            }%`,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {row.status === 'uploading' && `${row.percent}%`}
                        {row.status === 'ready' && 'Saved'}
                        {row.status === 'stopped' && 'Stopped'}
                        {row.status === 'error' && (row.error ?? 'Failed')}
                      </span>
                    </div>
                  </div>
                  {row.status === 'uploading' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        row.abort()
                      }}
                      className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                  )}
                  {(row.status === 'ready' || row.status === 'error' || row.status === 'stopped') && (
                    <button
                      type="button"
                      onClick={() => dismissRow(row.id)}
                      className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
