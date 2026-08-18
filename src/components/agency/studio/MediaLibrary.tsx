'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Tag, Images, Plus, Palette, Sparkles, Loader2, CheckSquare, Square, Trash2, ImageIcon, Film } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useComposeDeskStore } from '@/stores/compose-desk-store'
import { useStudioData } from '@/hooks/useStudioData'
import { sendToDirector } from '@/lib/chat-dispatch'
import { MediaUploader } from '@/components/agency/MediaUploader'
import { MediaLibraryFilters } from './MediaLibraryFilters'
import { MediaLibraryCard } from './MediaLibraryCard'
import { CollectionCard } from './CollectionCard'
import { CollectionView } from './CollectionView'
import { MediaDetailPanel } from './MediaDetailPanel'
import { CanvaImportModal } from './CanvaImportModal'
import { UploadQueuePanel } from './media/UploadQueuePanel'
import { GifPicker, type GifSelection } from './media/GifPicker'
import { StockPhotoPicker, type StockPhotoSelection } from './media/StockPhotoPicker'
import { CanvaDesignPicker } from './media/CanvaDesignPicker'
import type { MediaItemWithUsage, MediaCollection } from '@/types/database'

type TypeFilter = 'all' | 'image' | 'video' | 'audio'
type SortOption = 'newest' | 'oldest' | 'name' | 'most_used'
type ViewMode = 'library' | 'collection'
/**
 * The four source tabs Mixpost has, with one substitution.
 *
 * Mixpost's fourth is "New design", shown only when Adobe Express is
 * configured. Ours is `designs`, backed by the design tool this codebase
 * already integrates end to end — brand kits, templates, export and import all
 * exist and are exercised. Wiring a second design tool purely to match the
 * label would have split the brand kit across two services.
 */
type SourceTab = 'library' | 'gifs' | 'stock' | 'designs'

interface MediaLibraryProps {
  /**
   * false when a department shell has already supplied the scrolling, padded
   * pane. The Social chrome is the only scroller in its department; a screen
   * that pads and scrolls again gets two scrollbars and 52px down one side.
   */
  padded?: boolean
}

export function MediaLibrary({ padded = true }: MediaLibraryProps = {}) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const { activeBrandId, setPendingMediaId } = useAgencyStore()
  const studioData = useStudioData(activeBrandId)
  const isHealthBrand = !!(studioData.brand?.compliance_flags?.ahpra || studioData.brand?.compliance_flags?.tga)

  const [items, setItems] = useState<MediaItemWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sort, setSort] = useState<SortOption>('newest')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [bulkTagInput, setBulkTagInput] = useState(false)
  const [bulkTagValue, setBulkTagValue] = useState('')
  const [bulkRemoveTagInput, setBulkRemoveTagInput] = useState(false)
  const [bulkRemoveTagValue, setBulkRemoveTagValue] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Collections
  const [collections, setCollections] = useState<(MediaCollection & { media_collection_items?: unknown[] })[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('library')
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [showCollections, setShowCollections] = useState(true)
  const [detailItem, setDetailItem] = useState<MediaItemWithUsage | null>(null)
  const [showCanvaImport, setShowCanvaImport] = useState(false)
  const [retagging, setRetagging] = useState(false)
  const [retagResult, setRetagResult] = useState<string | null>(null)
  const [sourceTab, setSourceTab] = useState<SourceTab>('library')
  const [missingAltOnly, setMissingAltOnly] = useState(false)

  /**
   * Pictures with nothing saved for a screen reader to say.
   *
   * Counted in the browser rather than asked for, because the description lives
   * in the `metadata` blob and there is no column to filter on. The collection
   * is one brand's library, so the cost is a pass over a list already in hand.
   * Videos are not counted: the field is for stills.
   */
  const missingAltIds = items
    .filter((item) => {
      if (!item.file_type?.startsWith('image/')) return false
      const raw = (item.metadata as { alt_text?: unknown } | null)?.alt_text
      return !(typeof raw === 'string' && raw.trim())
    })
    .map((item) => item.id)
  const missingAltSet = new Set(missingAltIds)
  const visibleItems = missingAltOnly ? items.filter((i) => missingAltSet.has(i.id)) : items

  const [savingExternal, setSavingExternal] = useState(false)

  const handleGifSelect = async (gif: GifSelection) => {
    if (!activeBrandId || savingExternal) return
    setSavingExternal(true)
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          file_url: gif.url,
          file_name: gif.title || 'GIF',
          file_type: 'image/gif',
          source: 'giphy',
          metadata: { giphy_id: gif.id, preview: gif.preview, width: gif.width, height: gif.height },
        }),
      })
      if (res.ok) {
        setSourceTab('library')
        fetchMedia()
      } else {
        const err = await res.json().catch(() => ({ error: 'Save failed' }))
        alert(`Error: ${err.error}`)
      }
    } catch {
      alert('Network error saving GIF.')
    } finally {
      setSavingExternal(false)
    }
  }

  const handleStockPhotoSelect = async (photo: StockPhotoSelection) => {
    if (!activeBrandId || savingExternal) return
    setSavingExternal(true)
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          file_url: photo.url,
          file_name: photo.alt || `Photo by ${photo.photographer}`,
          file_type: 'image/jpeg',
          source: 'pexels',
          metadata: { pexels_id: photo.id, photographer: photo.photographer, preview: photo.preview, width: photo.width, height: photo.height },
        }),
      })
      if (res.ok) {
        setSourceTab('library')
        fetchMedia()
      } else {
        const err = await res.json().catch(() => ({ error: 'Save failed' }))
        alert(`Error: ${err.error}`)
      }
    } catch {
      alert('Network error saving photo.')
    } finally {
      setSavingExternal(false)
    }
  }

  const handleSmartRetag = async () => {
    if (!activeBrandId || retagging) return
    setRetagging(true)
    setRetagResult(null)
    try {
      const res = await fetch(`/api/media/retag?brandId=${activeBrandId}`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setRetagResult(data.message)
        fetchMedia()
        fetchTags()
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed' }))
        setRetagResult(`Error: ${err.error}`)
      }
    } catch {
      setRetagResult('Network error')
    } finally {
      setRetagging(false)
    }
  }

  const fetchMedia = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    const params = new URLSearchParams({ brandId: activeBrandId })
    if (search) params.set('search', search)
    if (selectedTags.length) params.set('tags', selectedTags.join(','))
    if (showArchived) params.set('archived', 'true')
    if (typeFilter !== 'all') params.set('type', typeFilter)
    params.set('sort', sort)

    try {
      const res = await fetch(`/api/media?${params}`)
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [activeBrandId, search, selectedTags, showArchived, typeFilter, sort])

  const fetchTags = useCallback(async () => {
    if (!activeBrandId) return
    const res = await fetch(
      `/api/media?action=tags&brandId=${activeBrandId}`
    )
    if (res.ok) {
      const data = await res.json()
      setAvailableTags(data.tags ?? [])
    }
  }, [activeBrandId])

  const fetchCollections = useCallback(async () => {
    if (!activeBrandId) return
    const res = await fetch(`/api/collections?brandId=${activeBrandId}`)
    if (res.ok) setCollections(await res.json())
  }, [activeBrandId])

  useEffect(() => { fetchMedia() }, [fetchMedia])
  useEffect(() => { fetchTags() }, [fetchTags])
  useEffect(() => { fetchCollections() }, [fetchCollections])

  useEffect(() => {
    if (!activeBrandId) {
      useComposeDeskStore.getState().setSnapshot(null)
      return
    }
    useComposeDeskStore.getState().setSnapshot({
      screen: 'media_library',
      brandId: activeBrandId,
      mediaItemIds: [],
      mediaLabels: [],
      mediaTypes: [],
      platforms: [],
      updatedAt: Date.now(),
    })
    return () => useComposeDeskStore.getState().setSnapshot(null)
  }, [activeBrandId])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTagAdd = async (id: string, tag: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tags: [...(item.tags ?? []), tag] }),
    })
    fetchMedia()
    fetchTags()
  }

  const handleTagRemove = async (id: string, tag: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        tags: (item.tags ?? []).filter((t) => t !== tag),
      }),
    })
    fetchMedia()
  }

  const handleArchive = async (id: string) => {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_archived: true }),
    })
    fetchMedia()
  }

  const handleUnarchive = async (id: string) => {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_archived: false }),
    })
    fetchMedia()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/media?id=${id}`, { method: 'DELETE' })
    fetchMedia()
  }

  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [regeneratingThumbId, setRegeneratingThumbId] = useState<string | null>(null)

  const handleRegenerateThumb = async (id: string) => {
    setRegeneratingThumbId(id)
    try {
      const res = await fetch('/api/media/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId: id, runStages: ['thumbnail'] }),
      })
      if (res.ok) fetchMedia()
    } finally {
      setRegeneratingThumbId(null)
    }
  }

  const handleGenerate = async (id: string, contentType?: string) => {
    setGeneratingId(id)
    try {
      const params = new URLSearchParams()
      if (contentType) params.set('content_type', contentType)
      const res = await fetch(`/api/media/${id}/generate?${params}`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Generated ${data.scheduledPosts?.length ?? 0} platform captions! Go to the Review tab to edit and schedule them.`)
      } else {
        const contentTypeHeader = res.headers.get('content-type') ?? ''
        if (contentTypeHeader.includes('application/json')) {
          const err = await res.json()
          alert(`Error: ${err.error}`)
        } else {
          alert(`Error: Server returned ${res.status}. Try again in a moment.`)
        }
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setGeneratingId(null)
    }
  }

  const handleRepurpose = (id: string) => {
    sendToDirector(
      `Repurpose media item ${id} into clips, quotes, blog, newsletter, and social posts`
    )
  }

  const handleBulkTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        tags_add: [trimmed],
      }),
    })
    setSelectedIds(new Set())
    setBulkTagInput(false)
    setBulkTagValue('')
    fetchMedia()
    fetchTags()
  }

  const handleBulkArchive = async () => {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        is_archived: true,
      }),
    })
    setSelectedIds(new Set())
    fetchMedia()
  }

  const handleBulkRemoveTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        tags_remove: [trimmed],
      }),
    })
    setBulkRemoveTagInput(false)
    setBulkRemoveTagValue('')
    fetchMedia()
    fetchTags()
  }

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    if (count === 0) return
    if (!confirm(`Delete ${count} item${count === 1 ? '' : 's'} from your library? This cannot be undone.`)) {
      return
    }
    setBulkDeleting(true)
    try {
      // Delete sequentially via the existing single-item endpoint to keep
      // storage cleanup deterministic. Bulk DELETE is not yet supported.
      const ids = Array.from(selectedIds)
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/media?id=${id}`, { method: 'DELETE' }).catch(() => null)
        )
      )
      setSelectedIds(new Set())
      fetchMedia()
    } finally {
      setBulkDeleting(false)
    }
  }

  /**
   * Select-all follows what is ON SCREEN, not what is in the library.
   * With a filter applied, selecting rows the owner cannot see and then
   * pressing Delete is the worst possible reading of one click.
   */
  const handleSelectAll = () => {
    if (selectedIds.size === visibleItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleItems.map((i) => i.id)))
    }
  }

  const toggleSelectMode = () => {
    setSelectMode((prev) => {
      const next = !prev
      if (!next) setSelectedIds(new Set())
      return next
    })
  }

  const handleCreateCollection = async (type: 'carousel' | 'campaign' | 'album') => {
    if (selectedIds.size === 0) return
    const name = prompt(`Name this ${type}:`)
    if (!name?.trim()) return

    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId: activeBrandId,
        name: name.trim(),
        collectionType: type,
        mediaItemIds: Array.from(selectedIds),
      }),
    })

    if (res.ok) {
      setSelectedIds(new Set())
      fetchCollections()
    }
  }

  const handleArchiveCollection = async (id: string) => {
    await fetch('/api/collections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_archived: true }),
    })
    fetchCollections()
  }

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Delete this collection? Media items will not be deleted.')) return
    await fetch(`/api/collections?id=${id}`, { method: 'DELETE' })
    fetchCollections()
  }

  const handleCreatePost = (id: string) => {
    if (pathname.includes('/agency/social')) {
      router.push(`/agency/social/compose?media=${id}`)
      return
    }
    setPendingMediaId(id)
    router.push(`/agency/studio/create?media=${id}`)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">
          Select a brand first to manage media.
        </p>
      </div>
    )
  }

  // Collection detail view
  if (viewMode === 'collection' && activeCollectionId) {
    const activeCollection = collections.find(c => c.id === activeCollectionId)
    if (activeCollection) {
      return (
        <div className="overflow-y-auto p-6">
          <CollectionView
            collectionId={activeCollectionId}
            collection={activeCollection}
            onBack={() => { setViewMode('library'); setActiveCollectionId(null) }}
            onUpdated={fetchCollections}
          />
        </div>
      )
    }
  }

  const sourceTabs: { id: SourceTab; label: string; icon: typeof Images }[] = [
    { id: 'library', label: 'Library', icon: Images },
    { id: 'gifs', label: 'GIFs', icon: Film },
    { id: 'stock', label: 'Stock photos', icon: ImageIcon },
    { id: 'designs', label: 'Designs', icon: Palette },
  ]

  return (
    <div
      className={padded ? 'space-y-3 overflow-y-auto px-[26px] py-[18px]' : 'space-y-3'}
      style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
    >
      {/* Source tabs + saving indicator — mockup .filters in .toolrow */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-0" style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}>
        <div className="flex flex-wrap items-center gap-0.5">
          {sourceTabs.map(({ id, label, icon: Icon }) => {
            const active = sourceTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSourceTab(id)}
                className="-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold transition-colors"
                style={{
                  borderBottomColor: active ? 'var(--brand, oklch(0.545 0.115 240))' : 'transparent',
                  color: active
                    ? 'var(--brand-deep, oklch(0.33 0.08 240))'
                    : 'var(--ink-2, oklch(0.46 0.012 240))',
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
        {savingExternal ? (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[12px]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving to library…
          </span>
        ) : null}
      </div>

      {/* GIF Picker */}
      {sourceTab === 'gifs' && (
        <GifPicker onSelect={handleGifSelect} />
      )}

      {/* Stock Photo Picker */}
      {sourceTab === 'stock' && (
        <StockPhotoPicker onSelect={handleStockPhotoSelect} />
      )}

      {/* Designs — the fourth tab. Importing writes an ordinary library row,
          so `fetchMedia` is all that is needed to make it appear on Library. */}
      {sourceTab === 'designs' && (
        <CanvaDesignPicker brandId={activeBrandId} onImported={fetchMedia} />
      )}

      {/* Library view */}
      {sourceTab === 'library' && (
        <>
      <MediaLibraryFilters
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        selectedTags={selectedTags}
        onSelectedTagsChange={setSelectedTags}
        availableTags={availableTags}
        sort={sort}
        onSortChange={setSort}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        missingAltOnly={missingAltOnly}
        onMissingAltOnlyChange={setMissingAltOnly}
        missingAltCount={missingAltIds.length}
      />

      <MediaUploader brandId={activeBrandId} onUploadComplete={fetchMedia} compact />

      {/* Secondary actions — quiet, same paper family */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleSelectMode}
          aria-pressed={selectMode}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-[7px] text-[12.5px] font-semibold transition-colors hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]"
          style={{
            borderColor: selectMode
              ? 'var(--brand-deep, oklch(0.33 0.08 240))'
              : 'var(--line, oklch(0.915 0.007 240))',
            background: selectMode
              ? 'var(--brand-wash, oklch(0.966 0.026 240))'
              : 'var(--panel, oklch(1 0 0))',
            color: selectMode
              ? 'var(--brand-deep, oklch(0.33 0.08 240))'
              : 'var(--ink, oklch(0.20 0.014 240))',
          }}
        >
          {selectMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {selectMode ? 'Selecting' : 'Select'}
        </button>

        {selectMode && visibleItems.length > 0 ? (
          <button
            type="button"
            onClick={handleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-[7px] text-[12.5px] font-semibold transition-colors hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-2, oklch(0.46 0.012 240))',
            }}
          >
            {selectedIds.size === visibleItems.length ? 'Clear all' : 'Select all'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setShowCanvaImport(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-[7px] text-[12.5px] font-semibold transition-colors hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          <Palette className="h-3.5 w-3.5" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }} />
          Import from Canva
        </button>

        <button
          type="button"
          onClick={handleSmartRetag}
          disabled={retagging}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-[7px] text-[12.5px] font-semibold transition-colors hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))] disabled:opacity-50"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          {retagging ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }} />
          )}
          {retagging ? 'Smart tagging…' : 'Smart retag all'}
        </button>

        {retagResult ? (
          <span className="text-[12px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
            {retagResult}
          </span>
        ) : null}

        {selectMode && selectedIds.size > 0 ? (
          <span
            className="ml-auto text-[12px] tabular-nums"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            {selectedIds.size} selected
          </span>
        ) : null}
      </div>

      {/* Collections section */}
      {collections.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCollections(!showCollections)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Images className="h-3.5 w-3.5" />
            Collections ({collections.length})
            <span className="text-[10px]">{showCollections ? '▼' : '▶'}</span>
          </button>
          {showCollections && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {collections.map(c => (
                <CollectionCard
                  key={c.id}
                  collection={c as Parameters<typeof CollectionCard>[0]['collection']}
                  onClick={id => { setActiveCollectionId(id); setViewMode('collection') }}
                  onArchive={handleArchiveCollection}
                  onDelete={handleDeleteCollection}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[oklch(0.55_0.1_240)]/30 bg-[oklch(0.55_0.1_240)]/5 px-4 py-2">
          <span className="text-sm text-foreground">
            {selectedIds.size} selected
          </span>

          {/* Create collection from selection */}
          <button
            onClick={() => handleCreateCollection('carousel')}
            className="inline-flex items-center gap-1 rounded-md bg-[oklch(0.55_0.1_240)] px-2.5 py-1 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)]"
          >
            <Plus className="h-3 w-3" />
            Carousel
          </button>
          <button
            onClick={() => handleCreateCollection('campaign')}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
          >
            <Plus className="h-3 w-3" />
            Campaign
          </button>

          {/* Add to existing collection */}
          {collections.length > 0 && (
            <select
              onChange={async (e) => {
                const collectionId = e.target.value
                if (!collectionId) return
                await fetch(`/api/collections/${collectionId}/items`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mediaItemIds: Array.from(selectedIds) }),
                })
                setSelectedIds(new Set())
                fetchCollections()
                e.target.value = ''
              }}
              defaultValue=""
              className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium border-none outline-none cursor-pointer"
            >
              <option value="" disabled>+ Add to collection...</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({(c.media_collection_items as unknown[])?.length ?? 0} items)
                </option>
              ))}
            </select>
          )}

          {bulkTagInput ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={bulkTagValue}
                onChange={(e) => setBulkTagValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBulkTag(bulkTagValue)
                  if (e.key === 'Escape') {
                    setBulkTagInput(false)
                    setBulkTagValue('')
                  }
                }}
                placeholder="Tag name..."
                autoFocus
                className="h-7 w-28 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => handleBulkTag(bulkTagValue)}
                className="rounded-md bg-[oklch(0.55_0.1_240)] px-2 py-1 text-xs text-white hover:bg-[oklch(0.50_0.1_240)]"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setBulkTagInput(true)}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
            >
              <Tag className="h-3 w-3" />
              Tag
            </button>
          )}

          {bulkRemoveTagInput ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={bulkRemoveTagValue}
                onChange={(e) => setBulkRemoveTagValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBulkRemoveTag(bulkRemoveTagValue)
                  if (e.key === 'Escape') {
                    setBulkRemoveTagInput(false)
                    setBulkRemoveTagValue('')
                  }
                }}
                placeholder="Tag to remove..."
                autoFocus
                className="h-7 w-32 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => handleBulkRemoveTag(bulkRemoveTagValue)}
                className="rounded-md bg-amber-500 px-2 py-1 text-xs text-white hover:bg-amber-600"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => setBulkRemoveTagInput(true)}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
            >
              <Tag className="h-3 w-3" />
              Remove tag
            </button>
          )}

          <button
            onClick={handleBulkArchive}
            className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
          >
            Archive
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-[13px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          Loading media…
        </p>
      ) : visibleItems.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          {missingAltOnly
            ? 'Every picture here already has a description. Nothing left to write.'
            : 'No media found. Upload some files above.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((item) => (
            <MediaLibraryCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onClick={(item) => setDetailItem(item)}
              onSelect={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  next.has(id) ? next.delete(id) : next.add(id)
                  return next
                })
              }}
              onTagAdd={handleTagAdd}
              onTagRemove={handleTagRemove}
              onTagClick={(tag) => setSelectedTags([tag])}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
              onGenerate={handleGenerate}
              generating={generatingId === item.id}
              onRepurpose={handleRepurpose}
              onCreatePost={handleCreatePost}
              onRegenerateThumb={handleRegenerateThumb}
              regeneratingThumb={regeneratingThumbId === item.id}
              availableTags={availableTags}
            />
          ))}
        </div>
      )}

      </>
      )}

      {/* Canva Import Modal */}
      {showCanvaImport && (
        <CanvaImportModal
          onClose={() => setShowCanvaImport(false)}
          onImported={() => { fetchMedia(); setShowCanvaImport(false) }}
        />
      )}

      {/* Media Detail Panel */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30">
          <div className="h-full w-full max-w-md">
            <MediaDetailPanel
              item={detailItem}
              onClose={() => setDetailItem(null)}
              onTagAdd={(id, tag) => { handleTagAdd(id, tag); setDetailItem(prev => prev ? { ...prev, tags: [...(prev.tags ?? []), tag] } : null) }}
              onTagRemove={(id, tag) => { handleTagRemove(id, tag); setDetailItem(prev => prev ? { ...prev, tags: (prev.tags ?? []).filter(t => t !== tag) } : null) }}
              onGenerate={handleGenerate}
              onRepurpose={handleRepurpose}
              availableTags={availableTags}
              onItemUpdated={(updated) => {
                setDetailItem(updated)
                setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
              }}
              onRefresh={fetchMedia}
            />
          </div>
        </div>
      )}

      {/* Persistent upload progress tray (visible across the studio) */}
      <UploadQueuePanel />
    </div>
  )
}
