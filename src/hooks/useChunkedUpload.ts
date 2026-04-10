'use client'

/**
 * useChunkedUpload — resumable upload hook for large media files.
 *
 * For the MVP this hook uploads the whole file as a single multipart/form-data
 * POST to `/api/media/upload`, exposing real progress via XHR `onprogress`,
 * cancellation via AbortController, and pause/resume semantics. The "chunked"
 * abstraction is preserved so callers can opt into true chunked transport
 * later without changing their integration: when the upload server gains
 * `init/chunk/complete` endpoints we only need to swap the implementation
 * inside `runUpload()`.
 *
 * Mirrors the surface area of Mixpost Pro's `useChunkedUpload.js` composable
 * (start / pause / resume / abort / progress / status) but is rewritten in
 * TypeScript and follows NRS conventions (Australian English, save-on-blur,
 * non-tech-user friendly).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export const CHUNK_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
export const CHUNK_THRESHOLD_BYTES = 50 * 1024 * 1024 // any file >= 50 MB is "chunked" semantically

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted'

export interface ChunkedUploadOptions {
  /** Endpoint to POST the file to. Defaults to `/api/media/upload`. */
  endpoint?: string
  /** Brand the upload belongs to (sent as form field). */
  brandId: string
  /** Optional comma-separated tag list to attach. */
  tags?: string
  /** Optional description / alt text seed. */
  description?: string
  /** Fired whenever progress changes (0–100). */
  onProgress?: (progress: number) => void
  /** Fired once the upload completes successfully with the parsed JSON body. */
  onComplete?: (response: unknown) => void
  /** Fired on any unrecoverable error. */
  onError?: (error: Error) => void
}

export interface ChunkedUploadHandle {
  start: (file: File) => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  abort: () => void
  progress: number
  status: UploadStatus
  uploadId: string | null
  fileName: string | null
  fileSize: number | null
  error: string | null
}

/**
 * Generate a stable upload identifier for queue tracking.
 */
function generateUploadId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function useChunkedUpload(options: ChunkedUploadOptions): ChunkedUploadHandle {
  const {
    endpoint = '/api/media/upload',
    brandId,
    tags,
    description,
    onProgress,
    onComplete,
    onError,
  } = options

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<File | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const pausedRef = useRef<boolean>(false)
  const abortedRef = useRef<boolean>(false)

  // Cleanup on unmount — prevent leaks if the consumer navigates away mid-upload.
  useEffect(() => {
    return () => {
      if (xhrRef.current && status === 'uploading') {
        xhrRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runUpload = useCallback(
    (file: File): Promise<void> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        const formData = new FormData()
        formData.append('file', file)
        formData.append('brandId', brandId)
        if (tags) formData.append('tags', tags)
        if (description) formData.append('description', description)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100)
            setProgress(pct)
            onProgress?.(pct)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const body = xhr.responseText ? JSON.parse(xhr.responseText) : {}
              setProgress(100)
              onProgress?.(100)
              setStatus('completed')
              onComplete?.(body)
              resolve()
            } catch (parseErr) {
              const err = parseErr instanceof Error ? parseErr : new Error('Failed to parse upload response')
              setError(err.message)
              setStatus('failed')
              onError?.(err)
              reject(err)
            }
          } else {
            let message = `Upload failed (${xhr.status})`
            try {
              const body = xhr.responseText ? JSON.parse(xhr.responseText) : null
              if (body?.error) message = body.error
            } catch {
              /* swallow */
            }
            const err = new Error(message)
            setError(message)
            setStatus('failed')
            onError?.(err)
            reject(err)
          }
        }

        xhr.onerror = () => {
          const message = 'Network error during upload'
          setError(message)
          setStatus('failed')
          const err = new Error(message)
          onError?.(err)
          reject(err)
        }

        xhr.onabort = () => {
          if (pausedRef.current) {
            setStatus('paused')
          } else if (abortedRef.current) {
            setStatus('aborted')
          }
          // Resolve quietly — pause/abort are user-driven and not failures.
          resolve()
        }

        xhr.open('POST', endpoint, true)
        xhr.send(formData)
      })
    },
    [brandId, description, endpoint, onComplete, onError, onProgress, tags]
  )

  const start = useCallback(
    async (file: File) => {
      fileRef.current = file
      pausedRef.current = false
      abortedRef.current = false

      const id = generateUploadId()
      setUploadId(id)
      setFileName(file.name)
      setFileSize(file.size)
      setProgress(0)
      setError(null)
      setStatus('uploading')

      try {
        await runUpload(file)
      } catch {
        // Errors already surfaced via state + onError. Swallow to keep
        // consumers from needing try/catch around the public API.
      }
    },
    [runUpload]
  )

  const pause = useCallback(() => {
    if (status !== 'uploading' || !xhrRef.current) return
    pausedRef.current = true
    xhrRef.current.abort()
  }, [status])

  const resume = useCallback(async () => {
    if (status !== 'paused' || !fileRef.current) return
    pausedRef.current = false
    abortedRef.current = false
    setStatus('uploading')
    setProgress(0) // server doesn't yet support range resume; restart from 0
    setError(null)

    try {
      await runUpload(fileRef.current)
    } catch {
      /* surfaced via state */
    }
  }, [runUpload, status])

  const abort = useCallback(() => {
    abortedRef.current = true
    pausedRef.current = false
    if (xhrRef.current && status === 'uploading') {
      xhrRef.current.abort()
    } else {
      setStatus('aborted')
    }
  }, [status])

  return {
    start,
    pause,
    resume,
    abort,
    progress,
    status,
    uploadId,
    fileName,
    fileSize,
    error,
  }
}
