'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, ArrowRight, Check, FileVideo, Image as ImageIcon, LayoutDashboard, Loader2, Music, Palette, Upload } from 'lucide-react'
import { NrsDeskConversation } from '@/components/agency/NrsDeskConversation'
import { MediaTile } from '@/components/agency/media/MediaTile'
import { ReloadAppButton } from '@/components/agency/shell/ReloadAppButton'
import { useBrandTheme } from '@/components/agency/shell/brand-theme'
import { desktopInboxDisplayName } from '@/lib/media/desktop-inbox'
import { useAgencyStore } from '@/stores/agency-store'
import { FOCUS_RING_INSET, FOCUS_RING_INSET_ON_SOLID } from '@/lib/ui/focus'

const MAX_MEDIA_INTAKE_BYTES = 500 * 1024 * 1024
const MAX_FILES_PER_BATCH = 10

/**
 * Keyboard focus is drawn from `foreground`, not `ring`, and it now comes from
 * one shared module — see src/lib/ui/focus.ts for the measurement. This surface
 * uses the inset variants because its row lists sit inside `overflow-hidden`
 * containers, where an outset ring is clipped along the left and right edges
 * and the focused row reads as having no ring at all.
 */
const FOCUS_RING = FOCUS_RING_INSET
const FOCUS_RING_ON_SOLID = FOCUS_RING_INSET_ON_SOLID

interface InboxBrand {
  id: string
  name: string
  slug: string
  brand_colours?: Record<string, string>
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
  const className = 'h-3.5 w-3.5 shrink-0 text-muted-foreground'
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

/** The empty square / tick that tells the owner whether a file is going to the Director. */
function SelectionBox({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors duration-200 ${selected ? 'border-foreground bg-foreground text-background' : 'border-border'}`}
    >
      {selected && <Check className="h-3.5 w-3.5" />}
    </span>
  )
}

/**
 * Loading placeholders shaped like the rows they stand in for, so the panel
 * does not change height when the real files arrive. A spinner in the middle
 * of the content area would tell the owner nothing about what is coming.
 */
function MediaRowSkeleton() {
  return (
    <ul className="divide-y border-t" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3 px-4 py-3">
          <span className="h-5 w-5 shrink-0 animate-pulse rounded-sm bg-muted" />
          <span className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-muted" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-2/3 animate-pulse rounded-sm bg-muted" />
            <span className="block h-2.5 w-1/3 animate-pulse rounded-sm bg-muted" />
          </span>
        </li>
      ))}
    </ul>
  )
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
  const [mediaReloadToken, setMediaReloadToken] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setBrand = useAgencyStore((s) => s.setBrand)
  const themeVars = useBrandTheme(selectedBrand)

  useEffect(() => {
    if (selectedBrand) setBrand(selectedBrand.id)
  }, [selectedBrand, setBrand])

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
    }).catch(() => {
      // The raw message from the upload route describes the request, not
      // anything the owner can act on. Name the problem and the way out.
      if (!cancelled) setExistingMediaError('Your saved files could not be loaded just now. Anything you upload on this screen still works.')
    }).finally(() => {
      if (!cancelled) setExistingMediaLoading(false)
    })

    return () => { cancelled = true }
  }, [request, selectedBrand, mediaReloadToken])

  const updateUpload = (id: string, changes: Partial<UploadItem>) => {
    setUploads((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  const uploadFile = async (file: File) => {
    const id = crypto.randomUUID()
    setUploads((items) => [...items, { id, name: file.name, fileType: file.type, percent: 0, state: 'uploading', selected: false }])

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      updateUpload(id, { state: 'error', error: 'That is not a photo, video or audio file. Choose one of those and add it again.' })
      return
    }
    if (file.size === 0 || file.size > MAX_MEDIA_INTAKE_BYTES) {
      updateUpload(id, {
        state: 'error',
        error: file.size === 0
          ? 'That file is empty. Check it opens on your computer, then add it again.'
          : 'That file is over the 500 MB limit. Trim or compress it, then add it again.',
      })
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
        error: cause instanceof Error ? cause.message : 'The file did not finish uploading. Check your connection and add it again.',
      })
    }
  }

  const chooseFiles = async (files: File[]) => {
    if (files.length === 0) return
    // Files past the batch limit used to be dropped without a word.
    setError(files.length > MAX_FILES_PER_BATCH
      ? `Only the first ${MAX_FILES_PER_BATCH} files were added. Add the rest once these finish.`
      : null)
    for (const file of files.slice(0, MAX_FILES_PER_BATCH)) await uploadFile(file)
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
    setBrand(brand.id)
    setUploads([])
    setExistingMedia([])
    setSelectedExistingMediaIds([])
    setError(null)
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

  const handleDrop = (files: File[]) => {
    setDragging(false)
    if (busy) {
      setError('Those files were not added — the current batch is still uploading. Drop them again once it finishes.')
      return
    }
    void chooseFiles(files)
  }

  return (
    <main
      data-nrs-shell=""
      data-brand-id={selectedBrand?.id}
      data-testid="nrs-desk-shell"
      style={themeVars}
      className="flex min-h-[100dvh] flex-col bg-background text-foreground"
    >
      {/*
        The one piece of chrome that renders in every state. The way back into
        the app used to live inside the brand-selected branch only, so a person
        who had not picked a business yet — including anyone whose team access
        was missing — had no route out of this page at all.
      */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--brand-deep)', color: 'var(--brand-ink)' }}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">NRS Desk</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">Upload, ask, create and review in one place</p>
            </div>
          </div>

          <nav aria-label="Go to the main NRS workspace" className="flex shrink-0 items-center gap-2">
            <ReloadAppButton />
            <Link
              href="/agency/board"
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground active:bg-accent/70 ${FOCUS_RING}`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
              Today
            </Link>
            <Link
              href="/agency/studio"
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${FOCUS_RING_ON_SOLID}`}
              style={{ background: 'var(--brand-deep)', color: 'var(--brand-ink)' }}
            >
              <Palette className="h-3.5 w-3.5" aria-hidden="true" />
              Creative Studio
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {!selectedBrand && (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">What are we working on?</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose the business once. You can upload photos, video or audio and talk to the NRS Director on the same screen. Nothing publishes without review.
            </p>

            {brands.length === 0 ? (
              <div role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-foreground">This sign-in has no business assigned to it</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Ask your NRS admin to add you to a business under team access. Until then there is nothing here to upload into — Today and Creative Studio still open from the top of this page.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="mt-6 divide-y overflow-hidden rounded-lg border bg-card">
                {brands.map((brand) => (
                  <li key={brand.id}>
                    <button
                      type="button"
                      onClick={() => selectBrand(brand)}
                      className={`group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors duration-200 hover:bg-accent/50 active:bg-accent ${FOCUS_RING}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{desktopInboxDisplayName(brand)}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {brand.slug === 'endorseme' ? 'EndorseMe' : 'Upload media and brief the Director'}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selectedBrand && (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Working on</p>
                <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight">{desktopInboxDisplayName(selectedBrand)}</h1>
              </div>
              <div className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={resetSelection}
                  disabled={busy}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-200 enabled:hover:bg-accent enabled:hover:text-foreground enabled:active:bg-accent/70 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Change business
                </button>
                {busy && <p className="text-xs text-muted-foreground">Available once the uploads finish</p>}
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-5 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <p className="text-sm leading-6 text-foreground">{error}</p>
              </div>
            )}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(300px,0.72fr)_minmax(520px,1.5fr)]">
              <aside className="overflow-hidden rounded-lg border bg-card lg:sticky lg:top-6">
                <div className="p-4">
                  <h2 className="text-sm font-medium text-foreground">Add a file, or use one already here</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Upload something new, or pick a file the Director should look at. Nothing publishes from this screen.
                  </p>

                  <div
                    onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
                    onDragLeave={(event) => {
                      // Moving across a child fires dragleave on the wrapper.
                      // Without this the target flickers on every pixel of travel.
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                      setDragging(false)
                    }}
                    onDrop={(event) => { event.preventDefault(); handleDrop(Array.from(event.dataTransfer.files)) }}
                    className="mt-4"
                  >
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={busy}
                      className={`flex w-full flex-col items-center gap-1 rounded-md border border-dashed px-4 py-8 text-center transition-colors duration-200 ${FOCUS_RING} ${
                        dragging
                          ? 'border-foreground bg-accent'
                          : busy
                            ? 'cursor-not-allowed border-border bg-muted/40'
                            : 'border-border bg-background hover:border-foreground/40 hover:bg-accent/40 active:bg-accent/60'
                      }`}
                    >
                      <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-200 ${dragging ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                        {busy && !dragging
                          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          : <Upload className="h-4 w-4" aria-hidden="true" />}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {dragging ? 'Drop to add these files' : busy ? 'Finishing the current upload' : 'Choose or drop files'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dragging
                          ? 'They are saved to this business, not published'
                          : busy
                            ? 'You can add more as soon as this batch is done'
                            : `Photos, video or audio · up to 500 MB each · ${MAX_FILES_PER_BATCH} at a time`}
                      </span>
                    </button>
                  </div>

                  {/*
                    Deliberately a sibling of the button, not a child. Nested,
                    inputRef.click() dispatched a click that bubbled straight
                    back into the button's own onClick.
                  */}
                  <input
                    ref={inputRef}
                    className="sr-only"
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? [])
                      event.currentTarget.value = ''
                      void chooseFiles(files)
                    }}
                  />
                </div>

                {uploads.length > 0 && (
                  <div className="border-t">
                    <h3 className="px-4 pt-4 pb-3 text-sm font-medium text-foreground">Added just now</h3>
                    <ul className="divide-y border-t">
                      {uploads.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-pressed={item.state === 'ready' ? item.selected : undefined}
                            disabled={item.state !== 'ready'}
                            onClick={() => toggleUpload(item.id)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-200 enabled:hover:bg-accent/50 aria-pressed:bg-accent disabled:cursor-default ${FOCUS_RING}`}
                          >
                            {item.state === 'ready' ? (
                              <SelectionBox selected={item.selected} />
                            ) : (
                              <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center">
                                {item.state === 'error'
                                  ? <AlertCircle className="h-4 w-4 text-destructive" />
                                  : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                              </span>
                            )}

                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <MediaTypeIcon fileType={item.fileType} />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                              </span>

                              {item.state === 'uploading' && (
                                <>
                                  <span aria-hidden="true" className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
                                    <span className="block h-full rounded-full bg-foreground transition-all duration-200" style={{ width: `${item.percent}%` }} />
                                  </span>
                                  <span className="mt-1.5 block text-xs text-muted-foreground">Uploading {item.percent}%</span>
                                </>
                              )}
                              {item.state === 'filing' && <span className="mt-1 block text-xs text-muted-foreground">Saving safely in NRS…</span>}
                              {item.state === 'ready' && (
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {mediaLabel(item.fileType)} ready — {item.selected ? 'selected for the Director' : 'select to include it'}.
                                </span>
                              )}
                              {item.state === 'error' && <span className="mt-1 block text-xs text-destructive">{item.error}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t">
                  <div className="px-4 pt-4 pb-3">
                    <h3 className="text-sm font-medium text-foreground">Already in {desktopInboxDisplayName(selectedBrand)}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Choose a saved video, image or audio file instead of uploading it again.
                    </p>
                  </div>

                  {existingMediaLoading && (
                    <>
                      <span role="status" className="sr-only">Loading the files saved to this business</span>
                      <MediaRowSkeleton />
                    </>
                  )}

                  {!existingMediaLoading && existingMediaError && (
                    <div role="alert" className="border-t px-4 py-4">
                      <p className="text-xs leading-5 text-destructive">{existingMediaError}</p>
                      <button
                        type="button"
                        onClick={() => setMediaReloadToken((token) => token + 1)}
                        className={`mt-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200 hover:bg-accent active:bg-accent/70 ${FOCUS_RING}`}
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {!existingMediaLoading && !existingMediaError && existingMedia.length === 0 && (
                    <p className="border-t px-4 py-5 text-xs leading-5 text-muted-foreground">
                      Nothing saved here yet. Every file you add above stays in this list, so next time you select it rather than uploading it a second time.
                    </p>
                  )}

                  {!existingMediaLoading && !existingMediaError && existingMedia.length > 0 && (
                    <ul className="divide-y border-t" data-testid="nrs-desk-existing-media">
                      {existingMedia.map((item) => {
                        const selected = selectedExistingMediaIds.includes(item.id)
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleExistingMedia(item.id)}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-accent/50 aria-pressed:bg-accent ${FOCUS_RING}`}
                            >
                              <SelectionBox selected={selected} />
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                                <MediaTile
                                  fileType={item.file_type}
                                  fileUrl={item.file_url}
                                  thumbnailUrl={item.thumbnail_url}
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">{item.file_name}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {mediaLabel(item.file_type)} — {selected ? 'selected to analyse' : 'select to analyse'}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <p role="status" className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
                  {selectedMediaIds.length === 0
                    ? 'Nothing selected yet — the Director will answer about the business in general. Nothing publishes from this screen.'
                    : `${selectedMediaIds.length} file${selectedMediaIds.length === 1 ? '' : 's'} selected — the Director looks at ${selectedMediaIds.length === 1 ? 'it' : 'these'} first. Nothing publishes from this screen.`}
                </p>
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
