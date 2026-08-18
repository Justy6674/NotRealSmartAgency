'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Images, Film, ImageIcon, Palette, Upload, Loader2, X, Archive, Trash2, Plus } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { runLibraryUpload, putFileWithProgress } from '@/lib/media/browser-upload'
import { MediaCard } from '@/components/agency/media/MediaCard'
import { AltTextDialog } from './AltTextDialog'
import { CanvaDesignPicker } from './CanvaDesignPicker'
import { GifPicker, type GifSelection } from './GifPicker'
import { StockPhotoPicker, type StockPhotoSelection } from './StockPhotoPicker'
import { UploadQueuePanel } from './UploadQueuePanel'
import { uploadQueue } from './uploadQueueStore'
import { platformsThatWillRefuse, tooLargeSentence } from './platform-limits'
import type { MediaItem, MediaItemWithUsage } from '@/types/database'

/**
 * The media library, in the shape of the publishing tool the owner asked for.
 *
 * Four doors along the top — what he has already uploaded, stock photos, GIFs,
 * and his designs — and behind each one the same square grid, so choosing a
 * file is the same action wherever the file came from. That shape is the
 * requirement, asked for over weeks and in those words; a cleverer arrangement
 * of the same features is not a substitute for it.
 *
 * ── The two things this screen now does that it did not ────────────────
 * 1. It says, at upload time, which accounts will refuse the file. The check
 *    runs twice: instantly against the sizes we hold, and then against the
 *    publisher's own validator once the file has a link (`/api/media/limits`).
 *    The second is the authority — it is the exact rule that will be applied on
 *    the day — and the first exists only because it can answer before the bytes
 *    have moved, while swapping the file still costs nothing.
 * 2. Big files no longer travel through this server. Anything past the direct
 *    ceiling asks for somewhere to put itself and goes there straight from the
 *    machine it is sitting on.
 *
 * Nothing here blocks an upload. A file Bluesky refuses is still a good file
 * for Facebook, so a refusal is a sentence on the card, not a locked door.
 */

type SourceTab = 'uploads' | 'stock' | 'gifs' | 'designs'
type TypeFilter = 'all' | 'image' | 'video'

/**
 * Above this, the file is handed straight to the publisher's own storage
 * instead of ours: our own signed upload is fine for ordinary files, and a
 * 400 MB clip has no business crossing a serverless function at all.
 */
const DIRECT_UPLOAD_FROM_BYTES = 25 * 1024 * 1024

interface WarningState {
  [mediaItemId: string]: string | null
}

export function MediaLibraryPane() {
  const router = useRouter()
  const { activeBrandId } = useAgencyStore()

  const [tab, setTab] = useState<SourceTab>('uploads')
  const [items, setItems] = useState<MediaItemWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<WarningState>({})
  const [altItem, setAltItem] = useState<MediaItem | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMedia = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    const params = new URLSearchParams({ brandId: activeBrandId, sort: 'newest' })
    if (search.trim()) params.set('search', search.trim())
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (showArchived) params.set('archived', 'true')
    try {
      const res = await fetch(`/api/media?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [activeBrandId, search, typeFilter, showArchived])

  useEffect(() => {
    const timer = setTimeout(fetchMedia, search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [fetchMedia, search])

  /**
   * Ask the publisher what it will refuse, for one landed file.
   *
   * Kept to files the local table already flagged plus everything freshly
   * uploaded, rather than the whole grid on every render: the answer for a file
   * is a property of the file and does not change, and a library of two hundred
   * should not become two hundred calls because somebody typed in the search
   * box.
   */
  const checkLimits = useCallback(async (mediaItemId: string) => {
    try {
      const res = await fetch('/api/media/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { message?: string | null }
      setWarnings((prior) => ({ ...prior, [mediaItemId]: data.message ?? null }))
    } catch {
      // Silence here is correct: the local answer is already on the card.
    }
  }, [])

  const uploadOne = useCallback(async (file: File) => {
    if (!activeBrandId) return
    const queued = uploadQueue.add({
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      brandId: activeBrandId,
    })

    // Said before a byte moves, from the sizes we hold. The publisher's own
    // answer replaces it a moment later, once the file has a link to check.
    const early = tooLargeSentence({
      fileType: file.type,
      refusedBy: platformsThatWillRefuse(file.size, { fileType: file.type }),
    })

    const onProgress = (percent: number) => uploadQueue.update(queued.id, { progress: percent })
    const viaOurStorage = async () =>
      (await runLibraryUpload({ brandId: activeBrandId, file, onProgress })).mediaItemId

    try {
      uploadQueue.update(queued.id, { status: 'uploading' })
      let mediaItemId: string
      if (file.size > DIRECT_UPLOAD_FROM_BYTES) {
        try {
          mediaItemId = await uploadDirect(activeBrandId, file, onProgress)
        } catch (error) {
          // A desk with no publisher configured still has to be able to upload
          // a long video. Our own signed upload goes straight to storage too —
          // it is only the publisher's copy that is unavailable — so falling
          // back is the whole fix, and telling him about it would be telling
          // him about our plumbing.
          if (!(error instanceof DirectUploadUnavailableError)) throw error
          mediaItemId = await viaOurStorage()
        }
      } else {
        mediaItemId = await viaOurStorage()
      }

      uploadQueue.update(queued.id, { status: 'completed', progress: 100 })
      if (early) setWarnings((prior) => ({ ...prior, [mediaItemId]: early }))
      void checkLimits(mediaItemId)
      await fetchMedia()
    } catch (error) {
      uploadQueue.update(queued.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'That upload did not finish.',
      })
    }
  }, [activeBrandId, checkLimits, fetchMedia])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    for (const file of list) await uploadOne(file)
  }, [uploadOne])

  const saveExternal = useCallback(async (payload: Record<string, unknown>) => {
    if (!activeBrandId) return
    setBusy('saving')
    setNotice(null)
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: activeBrandId, ...payload }),
      })
      if (!res.ok) {
        setNotice('That could not be saved to your library just now. Nothing has been changed.')
        return
      }
      setTab('uploads')
      await fetchMedia()
    } catch {
      setNotice('That could not be saved to your library just now. Nothing has been changed.')
    } finally {
      setBusy(null)
    }
  }, [activeBrandId, fetchMedia])

  const handleGif = (gif: GifSelection) =>
    saveExternal({
      file_url: gif.url,
      file_name: gif.title || 'GIF',
      file_type: 'image/gif',
      source: 'giphy',
      attribution: gif.attribution,
      metadata: { giphy_id: gif.id, preview: gif.preview, width: gif.width, height: gif.height },
    })

  const handlePhoto = (photo: StockPhotoSelection) =>
    saveExternal({
      file_url: photo.url,
      file_name: photo.alt || `Photo by ${photo.photographer}`,
      file_type: 'image/jpeg',
      source: photo.source,
      attribution: photo.attribution,
      // The description the supplier already wrote is a better starting point
      // than an empty box, and it is the field every platform reads.
      alt_text: photo.alt,
      metadata: {
        stock_id: photo.id,
        photographer: photo.photographer,
        photographer_url: photo.photographerUrl,
        preview: photo.preview,
        width: photo.width,
        height: photo.height,
      },
    })

  const toggleSelect = (id: string) => {
    setSelectedIds((prior) => {
      const next = new Set(prior)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkArchive = async () => {
    if (selectedIds.size === 0) return
    setBusy('bulk')
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], is_archived: !showArchived }),
    })
    setSelectedIds(new Set())
    setBusy(null)
    await fetchMedia()
  }

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return
    const count = selectedIds.size
    if (!confirm(`Delete ${count} ${count === 1 ? 'file' : 'files'}? This cannot be undone.`)) return
    setBusy('bulk')
    await fetch(`/api/media?ids=${[...selectedIds].join(',')}`, { method: 'DELETE' })
    setSelectedIds(new Set())
    setBusy(null)
    await fetchMedia()
  }

  const archiveOne = async (item: MediaItemWithUsage) => {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_archived: !item.is_archived }),
    })
    await fetchMedia()
  }

  const deleteOne = async (item: MediaItemWithUsage) => {
    if (!confirm(`Delete ${item.file_name}? This cannot be undone.`)) return
    await fetch(`/api/media?id=${item.id}`, { method: 'DELETE' })
    await fetchMedia()
  }

  /**
   * The only reason this screen exists: get the file onto a post.
   *
   * The owner ticked a video, the bar said "1 chosen", and the two things on
   * offer were Put away and Delete — a library in a publishing tool that could
   * file and destroy but not publish. So the way out is here, it is the first
   * thing on the bar, and it is also on each card's menu so the tick-then-bar
   * sequence never has to be discovered at all.
   *
   * Nothing is checked before leaving. A file some accounts will refuse is
   * still a good file for the others, and the composer already says which ones
   * will refuse it — deciding that here would make the library a second place
   * where publishing rules live, and the two would drift apart within a month.
   */
  const openComposerWith = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    // One id or several, comma-separated. A single tick is a list of one, so
    // the link the rest of the app already sends keeps working unchanged.
    router.push(`/agency/social/compose?media=${ids.join(',')}`)
    // Cleared on the way out, so coming back to the library is not a puzzle
    // about which files are still ticked from ten minutes ago.
    setSelectedIds(new Set())
  }, [router])

  const useInPost = (item: MediaItemWithUsage) => openComposerWith([item.id])

  const useSelectedInPost = () => openComposerWith([...selectedIds])

  /**
   * The warning shown on a card.
   *
   * The publisher's answer when we have one, the local table when we do not, so
   * a library loaded from scratch is not silent about a 40 MB file until
   * somebody re-uploads it.
   */
  const warningFor = (item: MediaItemWithUsage): string | null => {
    if (item.id in warnings) return warnings[item.id]
    return tooLargeSentence({
      fileType: item.file_type,
      refusedBy: platformsThatWillRefuse(item.file_size_bytes ?? 0, {
        fileType: item.file_type,
      }),
    })
  }

  const tabs: { id: SourceTab; label: string; icon: typeof Images }[] = useMemo(() => [
    { id: 'uploads', label: 'Uploads', icon: Images },
    { id: 'stock', label: 'Stock photos', icon: ImageIcon },
    { id: 'gifs', label: 'GIFs', icon: Film },
    { id: 'designs', label: 'Designs', icon: Palette },
  ], [])

  if (!activeBrandId) {
    return (
      <p className="p-6 text-[13px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
        Choose a business first and its files appear here.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-3" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
      {/* Four doors. Same grid behind each one. */}
      <div
        className="flex flex-wrap items-center gap-0.5 overflow-x-auto border-b"
        style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
        role="tablist"
        aria-label="Where the file comes from"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const on = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className="-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] transition-colors"
              style={{
                borderBottomColor: on ? 'var(--brand, oklch(0.52 0.09 55))' : 'transparent',
                color: on ? 'var(--brand-deep, oklch(0.33 0.07 55))' : 'var(--ink-2, oklch(0.46 0.012 240))',
                fontWeight: on ? 600 : 400,
              }}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          )
        })}
      </div>

      {notice && (
        <p
          className="rounded-[10px] border px-3 py-2 text-[12.5px]"
          style={{
            borderColor: 'var(--warn, oklch(0.63 0.13 75))',
            background: 'var(--warn-wash, oklch(0.964 0.052 80))',
          }}
        >
          {notice}
        </p>
      )}

      {tab === 'gifs' && <GifPicker onSelect={handleGif} />}
      {tab === 'stock' && <StockPhotoPicker onSelect={handlePhoto} />}
      {tab === 'designs' && <CanvaDesignPicker brandId={activeBrandId} onImported={fetchMedia} />}

      {tab === 'uploads' && (
        <>
          {/* Toolbar: search, what kind, and the put-away pile. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your files"
              className="h-9 min-w-0 flex-1 rounded-[8px] border px-3 text-[13px] focus:outline-none focus:ring-1"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
              }}
            />
            <div
              className="flex items-center gap-0.5 rounded-[8px] border p-0.5"
              style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
            >
              {([['all', 'All'], ['image', 'Pictures'], ['video', 'Videos']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTypeFilter(id)}
                  className="rounded-[6px] px-2.5 py-1 text-[12.5px]"
                  style={{
                    background: typeFilter === id ? 'var(--brand-wash, oklch(0.966 0.03 55))' : 'transparent',
                    color: typeFilter === id
                      ? 'var(--brand-deep, oklch(0.33 0.07 55))'
                      : 'var(--ink-2, oklch(0.46 0.012 240))',
                    fontWeight: typeFilter === id ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowArchived((value) => !value)}
              className="rounded-[8px] border px-2.5 py-1.5 text-[12.5px]"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: showArchived ? 'var(--brand-wash, oklch(0.966 0.03 55))' : 'var(--panel, oklch(1 0 0))',
                color: showArchived
                  ? 'var(--brand-deep, oklch(0.33 0.07 55))'
                  : 'var(--ink-2, oklch(0.46 0.012 240))',
              }}
            >
              {showArchived ? 'Showing put away' : 'Put away'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold"
              style={{
                background: 'var(--brand-deep, oklch(0.33 0.07 55))',
                color: 'var(--brand-ink, oklch(1 0 0))',
              }}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Add files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) void handleFiles(event.target.files)
                event.target.value = ''
              }}
            />
          </div>

          {/* Drop zone. Also the empty state, so an empty library is an
              invitation rather than a sentence saying there is nothing here. */}
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (event.dataTransfer.files?.length) void handleFiles(event.dataTransfer.files)
            }}
            className="rounded-[12px] border border-dashed px-4 py-5 text-center text-[12.5px]"
            style={{
              borderColor: dragging
                ? 'var(--brand, oklch(0.52 0.09 55))'
                : 'var(--line, oklch(0.915 0.007 240))',
              background: dragging
                ? 'var(--brand-wash, oklch(0.966 0.03 55))'
                : 'var(--panel-2, oklch(0.975 0.004 240))',
              color: 'var(--ink-3, oklch(0.615 0.011 240))',
            }}
          >
            Drop pictures or videos here, or tap Add files. Big videos go straight up from this device.
          </div>

          {selectedIds.size > 0 && (
            <div
              className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2"
              style={{
                borderColor: 'var(--brand, oklch(0.52 0.09 55))',
                background: 'var(--brand-wash, oklch(0.966 0.03 55))',
              }}
            >
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--brand-deep, oklch(0.33 0.07 55))' }}>
                {selectedIds.size} chosen
              </span>
              {/* First on the bar and the only filled button on it: choosing a
                  file is a step towards a post, not towards the archive. */}
              <button
                type="button"
                onClick={useSelectedInPost}
                className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold"
                style={{
                  background: 'var(--brand-deep, oklch(0.33 0.07 55))',
                  color: 'var(--brand-ink, oklch(1 0 0))',
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {selectedIds.size === 1 ? 'Use in a post' : `Use ${selectedIds.size} in a post`}
              </button>
              <button
                type="button"
                onClick={bulkArchive}
                disabled={busy === 'bulk'}
                className="flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[12px]"
                style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))', background: 'var(--panel, oklch(1 0 0))' }}
              >
                <Archive className="h-3.5 w-3.5" aria-hidden />
                {showArchived ? 'Put back' : 'Put away'}
              </button>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={busy === 'bulk'}
                className="flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[12px]"
                style={{
                  borderColor: 'var(--line, oklch(0.915 0.007 240))',
                  background: 'var(--panel, oklch(1 0 0))',
                  color: 'var(--st-fail, oklch(0.58 0.17 27))',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto flex items-center gap-1 text-[12px]"
                style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square animate-pulse rounded-[12px]"
                  style={{ background: 'var(--panel-2, oklch(0.975 0.004 240))' }}
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
              Nothing here yet. Add a picture or a video and it turns up in a moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  selecting={selectedIds.size > 0}
                  onToggleSelect={toggleSelect}
                  onOpen={useInPost}
                  onUseInPost={useInPost}
                  onAltText={(chosen) => setAltItem(chosen)}
                  onArchive={archiveOne}
                  onDelete={deleteOne}
                  warning={warningFor(item)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {busy === 'saving' && (
        <p className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Saving to your library…
        </p>
      )}

      <AltTextDialog
        item={altItem}
        open={altItem !== null}
        onOpenChange={(open) => {
          if (!open) setAltItem(null)
        }}
        onSaved={() => {
          setAltItem(null)
          void fetchMedia()
        }}
      />

      <UploadQueuePanel />
    </div>
  )
}

/** The publisher has nowhere to put it. Our own storage still does. */
class DirectUploadUnavailableError extends Error {
  constructor() {
    super('Large uploads are not switched on for this desk.')
    this.name = 'DirectUploadUnavailableError'
  }
}

/**
 * A big file, handed straight to the publisher's storage.
 *
 * Ask for somewhere to put it, PUT the bytes there from this device, then tell
 * NRS where it landed so the library row can be created and processed. The only
 * thing crossing our server is three short JSON messages.
 */
async function uploadDirect(
  brandId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  const presignRes = await fetch('/api/media/direct-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'presign',
      brand_id: brandId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    }),
  })
  const presign = (await presignRes.json().catch(() => ({}))) as Record<string, unknown>
  if (presignRes.status === 503) throw new DirectUploadUnavailableError()
  if (!presignRes.ok) {
    throw new Error(
      typeof presign.error === 'string'
        ? presign.error
        : 'That upload could not be started. Nothing has been changed.',
    )
  }

  const uploadUrl = typeof presign.upload_url === 'string' ? presign.upload_url : ''
  const publicUrl = typeof presign.public_url === 'string' ? presign.public_url : ''
  const key = typeof presign.key === 'string' ? presign.key : ''
  if (!uploadUrl || !publicUrl) {
    throw new Error('That upload could not be started. Nothing has been changed.')
  }

  await putFileWithProgress(uploadUrl, file, onProgress)
  onProgress(100)

  const completeRes = await fetch('/api/media/direct-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      brand_id: brandId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      public_url: publicUrl,
      key,
    }),
  })
  const completed = (await completeRes.json().catch(() => ({}))) as Record<string, unknown>
  if (!completeRes.ok || typeof completed.media_item_id !== 'string') {
    throw new Error(
      typeof completed.error === 'string'
        ? completed.error
        : 'The file uploaded but NRS did not save it to your library.',
    )
  }
  return completed.media_item_id
}
