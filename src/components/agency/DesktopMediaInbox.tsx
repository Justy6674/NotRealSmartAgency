'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Check, CheckCircle2, FileVideo, Image as ImageIcon, Loader2, Music, Upload } from 'lucide-react'
import { NrsDeskConversation } from '@/components/agency/NrsDeskConversation'
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
  fileType: string
  percent: number
  state: UploadState
  error?: string
  mediaItemId?: string
  selected: boolean
}

interface ExistingMediaItem {
  id: string
  file_name: string
  file_type: string
  file_url: string
  thumbnail_url: string | null
}

function mediaLabel(fileType: string) {
  if (fileType.startsWith('video/')) return 'Video'
  if (fileType.startsWith('image/')) return 'Image'
  if (fileType.startsWith('audio/')) return 'Audio'
  return 'File'
}

function MediaTypeIcon({ fileType }: { fileType: string }) {
  const className = 'h-3.5 w-3.5 text-muted-foreground'
  if (fileType.startsWith('video/')) return <FileVideo className={className} aria-hidden="true" />
  if (fileType.startsWith('image/')) return <ImageIcon className={className} aria-hidden="true" />
  return <Music className={className} aria-hidden="true" />
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
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const initialBrandSlug = searchParams.get('brand')
  const initialConversationId = searchParams.get('conversation')
  const [selectedBrand, setSelectedBrand] = useState<InboxBrand | null>(() => (
    brands.find((brand) => brand.slug === initialBrandSlug) ?? null
  ))
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [existingMedia, setExistingMedia] = useState<ExistingMediaItem[]>([])
  const [selectedExistingMediaIds, setSelectedExistingMediaIds] = useState<string[]>([])
  const [existingMediaLoading, setExistingMediaLoading] = useState(false)
  const [existingMediaError, setExistingMediaError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(async (body: Record<string, unknown>) => {
    if (!selectedBrand) throw new Error('Choose a business before uploading.')
    const response = await fetch('/api/media/desktop-upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, brand_id: selectedBrand.id }),
    })
    const data = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'NRS could not complete that upload.')
    return data
  }, [selectedBrand])

  useEffect(() => {
    if (!selectedBrand) {
      setExistingMedia([])
      setSelectedExistingMediaIds([])
      setExistingMediaError(null)
      return
    }

    let cancelled = false
    setExistingMediaLoading(true)
    setExistingMediaError(null)
    setSelectedExistingMediaIds([])
    void request({ action: 'list' }).then((data) => {
      if (cancelled) return
      const media = Array.isArray(data.media) ? data.media.filter((item): item is ExistingMediaItem => (
        !!item
        && typeof item === 'object'
        && typeof (item as Record<string, unknown>).id === 'string'
        && typeof (item as Record<string, unknown>).file_name === 'string'
        && typeof (item as Record<string, unknown>).file_type === 'string'
        && typeof (item as Record<string, unknown>).file_url === 'string'
      )) : []
      setExistingMedia(media)
    }).catch((cause) => {
      if (!cancelled) setExistingMediaError(cause instanceof Error ? cause.message : 'NRS could not load the existing media library.')
    }).finally(() => {
      if (!cancelled) setExistingMediaLoading(false)
    })

    return () => { cancelled = true }
  }, [request, selectedBrand])

  const updateUpload = (id: string, changes: Partial<UploadItem>) => {
    setUploads((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  const uploadFile = async (file: File) => {
    const id = crypto.randomUUID()
    setUploads((items) => [...items, { id, name: file.name, fileType: file.type, percent: 0, state: 'uploading', selected: false }])

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      updateUpload(id, { state: 'error', error: 'Choose an image, video, or audio file.' })
      return
    }
    if (file.size === 0 || file.size > MAX_MEDIA_INTAKE_BYTES) {
      updateUpload(id, { state: 'error', error: file.size === 0 ? 'That file is empty.' : 'The limit is 500 MB per file.' })
      return
    }

    try {
      const started = await request({ action: 'start', client_upload_id: id, file_name: file.name, file_type: file.type, file_size: file.size })
      const signedUrl = typeof started.signed_url === 'string' ? started.signed_url : ''
      const storagePath = typeof started.storage_path === 'string' ? started.storage_path : ''
      if (!signedUrl || !storagePath) throw new Error('NRS could not prepare this upload.')

      await uploadWithProgress(signedUrl, file, (percent) => updateUpload(id, { percent }))
      updateUpload(id, { percent: 100, state: 'filing' })
      const completed = await request({ action: 'complete', client_upload_id: id, file_name: file.name, file_type: file.type, file_size: file.size, storage_path: storagePath })
      const mediaItemId = typeof completed.media_item_id === 'string' ? completed.media_item_id : ''
      if (!mediaItemId) throw new Error('NRS filed the upload without returning its media reference.')
      updateUpload(id, { state: 'ready', mediaItemId, selected: true })
    } catch (cause) {
      updateUpload(id, {
        state: 'error',
        selected: false,
        error: cause instanceof Error ? cause.message : 'The file did not finish uploading. Check your connection and try again.',
      })
    }
  }

  const chooseFiles = async (files: File[]) => {
    setError(null)
    for (const file of files.slice(0, 10)) await uploadFile(file)
  }

  const resetSelection = () => {
    setSelectedBrand(null)
    setUploads([])
    setExistingMedia([])
    setSelectedExistingMediaIds([])
    setError(null)
    window.history.replaceState(null, '', '/desktop-upload')
  }

  const selectBrand = (brand: InboxBrand) => {
    setSelectedBrand(brand)
    setUploads([])
    setExistingMedia([])
    setSelectedExistingMediaIds([])
    window.history.replaceState(null, '', `/desktop-upload?brand=${encodeURIComponent(brand.slug)}`)
  }

  const toggleUpload = (id: string) => {
    setUploads((items) => items.map((item) => item.id === id && item.state === 'ready'
      ? { ...item, selected: !item.selected }
      : item))
  }

  const toggleExistingMedia = (id: string) => {
    setSelectedExistingMediaIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id])
  }

  const busy = uploads.some((item) => item.state === 'uploading' || item.state === 'filing')
  const selectedUploads = uploads.filter((item) => item.state === 'ready' && item.selected && item.mediaItemId)
  const selectedExistingMedia = existingMedia.filter((item) => selectedExistingMediaIds.includes(item.id))
  const selectedMediaIds = [...selectedUploads.map((item) => item.mediaItemId as string), ...selectedExistingMedia.map((item) => item.id)]
  const selectedMediaNames = [...selectedUploads.map((item) => item.name), ...selectedExistingMedia.map((item) => item.file_name)]
  const selectedMediaTypes = [...selectedUploads.map((item) => item.fileType), ...selectedExistingMedia.map((item) => item.file_type)]

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-6 text-foreground sm:px-6 lg:py-8">
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Upload className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold tracking-wide">NRS Desk</p>
            <p className="text-xs text-muted-foreground">Upload, ask, create and review in one place</p>
          </div>
        </div>

        {!selectedBrand && (
          <div className="mx-auto max-w-3xl py-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What are we working on?</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Choose the business once. You can upload photos, video or audio and talk to the NRS Director on the same screen. Nothing publishes without review.</p>

            {brands.length === 0 ? (
              <div role="alert" className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
                Your NRS sign-in does not have access to these shared businesses. Ask your NRS admin to check your team access.
              </div>
            ) : (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => selectBrand(brand)}
                    className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/60 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <p className="font-medium">{desktopInboxDisplayName(brand)}</p>
                    {brand.slug === 'endorseme' && <p className="mt-1 text-xs text-muted-foreground">EndorseMe</p>}
                    <p className="mt-4 text-sm text-muted-foreground group-hover:text-foreground">Open NRS Desk →</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedBrand && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Working on</p>
                <h1 className="text-2xl font-semibold">{desktopInboxDisplayName(selectedBrand)}</h1>
              </div>
              <button type="button" onClick={resetSelection} disabled={busy} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowLeft className="h-4 w-4" /> Change business
              </button>
            </div>

            {error && <div role="alert" className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{error}</p></div></div>}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.5fr)]">
              <aside className="rounded-3xl border bg-card p-5 shadow-sm lg:sticky lg:top-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Media</p>
                  <h2 className="mt-1 text-lg font-semibold">Add a file or use one already here</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Upload something new, or select an existing file for the Director. Nothing publishes from this screen.</p>
                </div>

                <button
                  type="button"
                  className={`mt-5 w-full rounded-2xl border border-dashed p-6 text-left transition ${dragging ? 'border-primary bg-primary/5' : 'bg-background hover:border-primary/60 hover:bg-muted/30'}`}
                  onClick={() => !busy && inputRef.current?.click()}
                  onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void chooseFiles(Array.from(event.dataTransfer.files)) }}
                  disabled={busy}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3 rounded-xl bg-primary/10 p-3 text-primary"><Upload className="h-5 w-5" /></div>
                    <span className="text-sm font-medium">Choose or drop files</span>
                    <span className="mt-1 text-xs text-muted-foreground">Photos · video · audio</span>
                  </div>
                  <input ref={inputRef} className="hidden" type="file" accept="image/*,video/*,audio/*" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ''; void chooseFiles(files) }} />
                </button>

                {uploads.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {uploads.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={item.selected}
                        disabled={item.state !== 'ready'}
                        onClick={() => toggleUpload(item.id)}
                        className="w-full rounded-xl border bg-background px-3 py-3 text-left transition enabled:hover:border-primary/50 aria-pressed:border-primary/60 aria-pressed:bg-primary/5 disabled:cursor-default"
                      >
                        <div className="flex items-center gap-3 text-sm">
                          <MediaTypeIcon fileType={item.fileType} />
                          <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border">
                            {item.state === 'ready' && item.selected ? <Check className="h-3.5 w-3.5 text-primary" /> : item.state === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" /> : item.state === 'error' ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                        </div>
                        {item.state === 'uploading' && <><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.percent}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">Uploading {item.percent}%</p></>}
                        {item.state === 'filing' && <p className="mt-1 pl-8 text-xs text-muted-foreground">Saving safely in NRS…</p>}
                        {item.state === 'ready' && <p className="mt-1 pl-8 text-xs text-muted-foreground">{mediaLabel(item.fileType)} ready — {item.selected ? 'selected for the Director' : 'not selected'}.</p>}
                        {item.state === 'error' && <p className="mt-1 pl-8 text-xs text-destructive">{item.error}</p>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-5 border-t pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Already in {desktopInboxDisplayName(selectedBrand)}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose a saved video, image or audio file instead of uploading it again.</p>
                    </div>
                    {existingMediaLoading && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Loading saved media" />}
                  </div>

                  {existingMediaError && <p role="alert" className="mt-3 text-xs leading-5 text-destructive">{existingMediaError}</p>}
                  {!existingMediaLoading && !existingMediaError && existingMedia.length === 0 && <p className="mt-3 text-xs leading-5 text-muted-foreground">No saved files yet. Upload the first one above.</p>}

                  {existingMedia.length > 0 && (
                    <div className="mt-3 space-y-2" data-testid="nrs-desk-existing-media">
                      {existingMedia.map((item) => {
                        const selected = selectedExistingMediaIds.includes(item.id)
                        const previewUrl = item.file_type.startsWith('video/') ? item.thumbnail_url : item.file_url
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleExistingMedia(item.id)}
                            className="w-full rounded-xl border bg-background p-2 text-left transition hover:border-primary/50 aria-pressed:border-primary/60 aria-pressed:bg-primary/5"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                                {previewUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                                ) : <MediaTypeIcon fileType={item.file_type} />}
                              </div>
                              <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border">
                                {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{item.file_name}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">{mediaLabel(item.file_type)} already in NRS — {selected ? 'selected to analyse' : 'select to analyse'}</span>
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                  {selectedMediaIds.length} selected · Nothing publishes from this screen
                </div>
              </aside>

              <NrsDeskConversation
                key={selectedBrand.id}
                brand={selectedBrand}
                selectedMediaIds={selectedMediaIds}
                selectedMediaNames={selectedMediaNames}
                selectedMediaTypes={selectedMediaTypes}
                hasSelectedMedia={selectedMediaIds.length > 0}
                initialConversationId={selectedBrand.slug === initialBrandSlug ? initialConversationId : null}
              />
            </div>
          </>
        )}
      </section>
    </main>
  )
}
