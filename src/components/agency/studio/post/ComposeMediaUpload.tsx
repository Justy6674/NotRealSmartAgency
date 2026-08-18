'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, Loader2, X } from 'lucide-react'
import {
  runLibraryUpload,
  UploadAbortError,
} from '@/lib/media/browser-upload'
import { formatUploadBytes } from '@/lib/media/format-upload-bytes'
import { validateIntakeFile } from '@/lib/media/intake-link'
import { cn } from '@/lib/utils'

interface ComposeUploadRow {
  id: string
  fileName: string
  fileSize: number
  percent: number
  status: 'uploading' | 'ready' | 'error' | 'stopped'
  error?: string
  mediaItemId?: string
  abort: () => void
}

interface ComposeMediaUploadProps {
  brandId: string
  accept: 'video' | 'image' | 'any'
  onUploaded: (mediaItemId: string) => void
  className?: string
}

function acceptAttribute(accept: ComposeMediaUploadProps['accept']): string {
  if (accept === 'video') return 'video/*'
  if (accept === 'image') return 'image/*'
  return 'video/*,audio/*,image/*'
}

/**
 * Inline upload for Create Post — drop or tap Upload without leaving the composer
 * or asking the Director to hunt the sidebar.
 */
export function ComposeMediaUpload({
  brandId,
  accept,
  onUploaded,
  className,
}: ComposeMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ComposeUploadRow[]>([])

  const patchRow = (id: string, patch: Partial<ComposeUploadRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID()
      const abortController = new AbortController()
      const validationError = validateIntakeFile({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })

      if (validationError) {
        setRows((prev) => [
          ...prev,
          {
            id,
            fileName: file.name,
            fileSize: file.size,
            percent: 0,
            status: 'error',
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
          id,
          fileName: file.name,
          fileSize: file.size,
          percent: 0,
          status: 'uploading',
          abort,
        },
      ])

      try {
        const result = await runLibraryUpload({
          brandId,
          file,
          clientUploadId: id,
          signal: abortController.signal,
          onProgress: (percent) => patchRow(id, { percent }),
        })
        patchRow(id, { status: 'ready', percent: 100, mediaItemId: result.mediaItemId })
        onUploaded(result.mediaItemId)
      } catch (err) {
        if (err instanceof UploadAbortError || abortController.signal.aborted) {
          patchRow(id, { status: 'stopped', percent: 0 })
          return
        }
        const message =
          err instanceof Error ? err.message : 'That upload did not finish. Try again.'
        patchRow(id, { status: 'error', error: message })
      }
    },
    [brandId, onUploaded],
  )

  const handleFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      void uploadFile(file)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-5 text-center transition-colors hover:border-primary/50"
      >
        <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Drop {accept === 'video' ? 'a video' : 'media'} here</p>
        <p className="mt-1 text-xs text-muted-foreground">or tap Upload below — stays on this screen</p>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttribute(accept)}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-lg border border-border bg-muted/20 p-2"
        >
          <div className="flex items-center gap-2">
            {row.status === 'uploading' && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium">{row.fileName}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatUploadBytes(row.fileSize)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full transition-all duration-200',
                      row.status === 'error' && 'bg-red-500',
                      row.status === 'stopped' && 'bg-muted-foreground/40',
                      row.status === 'ready' && 'bg-emerald-500',
                      row.status === 'uploading' && 'bg-primary',
                    )}
                    style={{
                      width: `${
                        row.status === 'ready' ? 100 : row.status === 'stopped' ? 0 : row.percent
                      }%`,
                    }}
                  />
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {row.status === 'uploading' && `${row.percent}%`}
                  {row.status === 'ready' && 'Added'}
                  {row.status === 'stopped' && 'Stopped'}
                  {row.status === 'error' && (row.error ?? 'Failed')}
                </span>
              </div>
            </div>
            {row.status === 'uploading' && (
              <button
                type="button"
                onClick={() => row.abort()}
                className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium"
              >
                Cancel
              </button>
            )}
            {(row.status === 'ready' || row.status === 'error' || row.status === 'stopped') && (
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
                className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
