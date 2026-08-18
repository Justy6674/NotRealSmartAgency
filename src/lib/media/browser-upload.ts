'use client'

/**
 * Browser-side media library upload — signed URL flow, no getSession().
 *
 * THE FAULT: MediaUploader called supabase.auth.getSession() before every
 * upload. On a contended auth lock that promise never settles, so the UI
 * stuck on "Uploading…" at 0% with no cancel and no way forward except
 * reloading the whole app.
 */

export const AUTH_SESSION_TIMEOUT_MS = 8_000

export type UploadLogFn = (step: string, data?: Record<string, unknown>) => void

export class UploadAbortError extends Error {
  constructor() {
    super('Upload cancelled')
    this.name = 'UploadAbortError'
  }
}

export class UploadTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadTimeoutError'
  }
}

/** Race getSession with a timeout — used only where a session token is still required. */
export async function getSessionWithTimeout<T>(
  run: () => Promise<T>,
  timeoutMs = AUTH_SESSION_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new UploadTimeoutError(
            'Your session took too long to respond. Tap Reload once, then try the upload again.',
          ))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function libraryRequest(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch('/api/media/library-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const message = typeof data.error === 'string'
      ? data.error
      : 'That upload did not finish. Check your connection and try again.'
    throw new Error(message)
  }
  return data
}

/** PUT bytes to a signed Storage URL with progress + optional abort. */
export function putFileWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
  log?: UploadLogFn,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const onAbort = () => {
      xhr.abort()
      finish(() => reject(new UploadAbortError()))
    }

    if (signal?.aborted) {
      reject(new UploadAbortError())
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    let lastLogged = -1
    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      const percent = Math.round((event.loaded / event.total) * 100)
      onProgress(percent)
      if (percent - lastLogged >= 10 || percent === 100) {
        log?.('xhr:progress', { percent, loaded: event.loaded, total: event.total })
        lastLogged = percent
      }
    })

    xhr.addEventListener('load', () => {
      signal?.removeEventListener('abort', onAbort)
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(() => resolve())
      } else {
        finish(() => reject(new Error('The file did not finish uploading. Check your connection and try again.')))
      }
    })

    xhr.addEventListener('error', () => {
      signal?.removeEventListener('abort', onAbort)
      finish(() => reject(new Error('The file did not finish uploading. Check your connection and try again.')))
    })

    xhr.addEventListener('abort', () => {
      signal?.removeEventListener('abort', onAbort)
      finish(() => reject(new UploadAbortError()))
    })

    log?.('xhr:opening PUT', { fileSize: file.size, fileType: file.type })
    xhr.open('PUT', signedUrl, true)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.send(file)
  })
}

export interface RunLibraryUploadOptions {
  brandId: string
  file: File
  clientUploadId?: string
  signal?: AbortSignal
  onProgress?: (percent: number) => void
  log?: UploadLogFn
}

export interface RunLibraryUploadResult {
  mediaItemId: string
  alreadyFiled: boolean
}

/**
 * Upload one file into the brand library: start → PUT → complete.
 * Processing (thumbnail, transcript, tags) runs server-side after complete.
 */
export async function runLibraryUpload(options: RunLibraryUploadOptions): Promise<RunLibraryUploadResult> {
  const { brandId, file, clientUploadId, signal, onProgress, log } = options
  const uploadId = clientUploadId ?? crypto.randomUUID()

  log?.('library:start', { fileName: file.name, fileSize: file.size, fileType: file.type, brandId })
  const started = await libraryRequest({
    action: 'start',
    brand_id: brandId,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    client_upload_id: uploadId,
  }, signal)

  const signedUrl = typeof started.signed_url === 'string' ? started.signed_url : ''
  const storagePath = typeof started.storage_path === 'string' ? started.storage_path : ''
  if (!signedUrl || !storagePath) {
    throw new Error('NRS could not prepare this upload. Tap Reload once and try again.')
  }

  log?.('library:uploading', { storagePath })
  await putFileWithProgress(signedUrl, file, (percent) => onProgress?.(percent), signal, log)
  onProgress?.(100)

  log?.('library:completing', { storagePath })
  const completed = await libraryRequest({
    action: 'complete',
    brand_id: brandId,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_path: storagePath,
    client_upload_id: uploadId,
  }, signal)

  const mediaItemId = typeof completed.media_item_id === 'string' ? completed.media_item_id : ''
  if (!mediaItemId) {
    throw new Error('The file uploaded but NRS did not save it to your library. Try again.')
  }

  log?.('library:complete', { mediaItemId })
  return {
    mediaItemId,
    alreadyFiled: completed.already_filed === true,
  }
}
