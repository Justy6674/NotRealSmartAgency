'use client'

import { useCallback, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { desktopInboxDisplayName } from '@/lib/media/desktop-inbox'

const MAX_MEDIA_INTAKE_BYTES = 500 * 1024 * 1024

interface InboxBrand {
  id: string
  name: string
  slug: string
}

type UploadState = 'uploading' | 'filing' | 'ready' | 'error'

interface UploadItem {
  id: string
  name: string
  percent: number
  state: UploadState
  error?: string
}

function uploadWithProgress(signedUrl: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', signedUrl, true)
    request.setRequestHeader('content-type', file.type || 'application/octet-stream')
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(String(request.status)))
    request.onerror = () => reject(new Error('network'))
    request.onabort = () => reject(new Error('aborted'))
    request.send(file)
  })
}

export function DesktopMediaInbox({ brands }: { brands: InboxBrand[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedBrand, setSelectedBrand] = useState<InboxBrand | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const request = useCallback(async (body: Record<string, unknown>) => {
    if (!selectedBrand) throw new Error('Choose a brand before uploading.')
    const response = await fetch('/api/media/desktop-upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, brand_id: selectedBrand.id }),
    })
    const data = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'NRS could not complete that upload.')
    return data
  }, [selectedBrand])

  const updateUpload = (id: string, changes: Partial<UploadItem>) => {
    setUploads((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  const uploadFile = async (file: File) => {
    const id = crypto.randomUUID()
    setUploads((items) => [...items, { id, name: file.name, percent: 0, state: 'uploading' }])

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      updateUpload(id, { state: 'error', error: 'Choose an image, video, or audio file.' })
      return
    }
    if (file.size === 0 || file.size > MAX_MEDIA_INTAKE_BYTES) {
      updateUpload(id, { state: 'error', error: file.size === 0 ? 'That file is empty.' : 'The limit is 500 MB per file.' })
      return
    }

    try {
      const started = await request({ action: 'start', file_name: file.name, file_type: file.type, file_size: file.size })
      const signedUrl = typeof started.signed_url === 'string' ? started.signed_url : ''
      const storagePath = typeof started.storage_path === 'string' ? started.storage_path : ''
      if (!signedUrl || !storagePath) throw new Error('NRS could not prepare this upload.')

      await uploadWithProgress(signedUrl, file, (percent) => updateUpload(id, { percent }))
      updateUpload(id, { percent: 100, state: 'filing' })
      await request({ action: 'complete', file_name: file.name, file_type: file.type, file_size: file.size, storage_path: storagePath })
      updateUpload(id, { state: 'ready' })
    } catch (cause) {
      updateUpload(id, {
        state: 'error',
        error: cause instanceof Error ? cause.message : 'The file did not finish uploading. Check your connection and try again.',
      })
    }
  }

  const chooseFiles = async (files: File[]) => {
    setError(null)
    // Mobile Safari becomes unreliable when several 500 MB request bodies are
    // held in memory. Queue one at a time so the progress shown stays honest.
    for (const file of files.slice(0, 10)) await uploadFile(file)
  }

  const resetSelection = () => {
    setSelectedBrand(null)
    setUploads([])
    setError(null)
    setCopied(false)
  }

  const copyPrompt = async () => {
    if (!selectedBrand) return
    try {
      await navigator.clipboard.writeText(`Use the newest ${desktopInboxDisplayName(selectedBrand)} upload to make a polished social draft. Keep it in NRS review and do not publish.`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the NRS instruction. You can type it directly in Claude or ChatGPT.')
    }
  }

  const busy = uploads.some((item) => item.state === 'uploading' || item.state === 'filing')
  const completed = uploads.some((item) => item.state === 'ready')

  return (
    <main className="min-h-[100dvh] bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6">
      <section className="mx-auto w-full max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300 text-zinc-950"><Upload className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-lime-300">NOT REAL SMART</p>
            <p className="text-xs text-zinc-400">Shared desktop media inbox</p>
          </div>
        </div>

        {!selectedBrand && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Where should this media go?</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Choose the business first, then add photos, video or audio. Files go into that NRS library for review only. Nothing is posted from here.</p>

            {brands.length === 0 ? (
              <div role="alert" className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/50 p-5 text-sm text-red-100">
                Your NRS sign-in does not have upload access to these shared brands. Ask your NRS admin to check your team access.
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => setSelectedBrand(brand)}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-lime-300/70 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-lime-300"
                  >
                    <p className="font-medium text-zinc-100">{desktopInboxDisplayName(brand)}</p>
                    {brand.slug === 'endorseme' && <p className="mt-1 text-xs text-zinc-400">EndorseMe</p>}
                    <p className="mt-3 text-sm text-zinc-400">Add media</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selectedBrand && (
          <>
            <button type="button" onClick={resetSelection} disabled={busy} className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-lime-300 disabled:cursor-not-allowed disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" /> Choose a different business
            </button>
            <p className="text-sm font-medium text-lime-300">{desktopInboxDisplayName(selectedBrand)}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Add photos, video or audio</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Drag files from this computer or choose them below. Up to 500 MB per file. NRS will prepare the media, but it stays out of the social calendar until you ask for a draft.</p>

            {error && <div role="alert" className="mt-5 rounded-2xl border border-red-500/40 bg-red-950/50 p-5 text-sm text-red-100"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{error}</p></div></div>}

            <button
              type="button"
              className={`mt-6 w-full rounded-3xl border border-dashed p-8 text-left transition ${dragging ? 'border-lime-300 bg-lime-300/10' : 'border-zinc-700 bg-zinc-900 hover:border-lime-300/70'}`}
              onClick={() => !busy && inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void chooseFiles(Array.from(event.dataTransfer.files)) }}
              disabled={busy}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 rounded-2xl bg-zinc-800 p-3 text-lime-300"><Upload className="h-6 w-6" /></div>
                <span className="font-medium">Choose photos or video</span>
                <span className="mt-1 text-sm text-zinc-400">Up to 500 MB each · up to 10 at a time</span>
              </div>
              <input ref={inputRef} className="hidden" type="file" accept="image/*,video/*,audio/*" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ''; void chooseFiles(files) }} />
            </button>

            {uploads.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploads.map((item) => (
                  <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{item.name}</span>{item.state === 'ready' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-300" /> : item.state === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-red-300" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lime-300" />}</div>
                    {item.state === 'uploading' && <><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${item.percent}%` }} /></div><p className="mt-1 text-xs text-zinc-400">Uploading {item.percent}%</p></>}
                    {item.state === 'filing' && <p className="mt-1 text-xs text-zinc-400">Saving to NRS and starting review processing…</p>}
                    {item.state === 'ready' && <p className="mt-1 text-xs text-zinc-400">In NRS and being prepared for review.</p>}
                    {item.state === 'error' && <p className="mt-1 text-xs text-red-200">{item.error}</p>}
                  </div>
                ))}
              </div>
            )}

            {completed && !busy && (
              <div className="mt-6 rounded-2xl border border-lime-300/30 bg-lime-300/10 p-5">
                <p className="font-medium text-lime-200">Next: tell your NRS assistant what to make.</p>
                <p className="mt-1 text-sm leading-6 text-zinc-300">Copy this, then paste it into Claude or ChatGPT with NRS connected. The result stays a review draft until you approve it.</p>
                <Button className="mt-4 bg-lime-300 text-zinc-950 hover:bg-lime-200" onClick={copyPrompt}><Copy className="mr-2 h-4 w-4" /> {copied ? 'Copied' : 'Copy NRS draft instruction'}</Button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
