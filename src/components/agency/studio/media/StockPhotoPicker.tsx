'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PhotoSource = 'pexels' | 'unsplash'

export interface StockPhotoSelection {
  url: string
  photographer: string
  photographerUrl: string | null
  id: number | string
  source: PhotoSource
  preview: string
  alt: string
  width: number
  height: number
  /** "Photo by X on Unsplash" — stored with the file, shown wherever it is. */
  attribution: string
}

interface PhotoResult {
  id: number | string
  url: string
  preview: string
  photographer: string
  photographer_url?: string | null
  alt: string
  width: number
  height: number
  download_url?: string
  attribution?: string
}

interface StockPhotoPickerProps {
  onSelect: (photo: StockPhotoSelection) => void
  /**
   * Which suppliers are actually switched on, from the server-side capability
   * check. The toggle used to be a hard-coded pair, so with one supplier live
   * and one not, half the toggle was a button that could only ever return a
   * sentence. Offer what works, and nothing else.
   */
  sources?: PhotoSource[]
}

export function StockPhotoPicker({ onSelect, sources = ['pexels', 'unsplash'] }: StockPhotoPickerProps) {
  const available: PhotoSource[] = sources.length > 0 ? sources : ['pexels']
  const [source, setSource] = useState<PhotoSource>(available[0])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PhotoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPhotos = useCallback(async (q: string, src: PhotoSource) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ source: src, limit: '24' })
      if (q.trim()) params.set('q', q.trim())
      // Behind the sign-in: the search quota is ours, and an open proxy is a
      // stranger's loop away from a dark tab with no visible cause.
      const res = await fetch(`/api/media/stock?${params}`)
      // Read the BODY on both branches: the route answers a switched-off
      // library with a real status code AND an owner-facing sentence, and
      // throwing here would replace that sentence with a generic one.
      const data = await res.json().catch(() => null)
      const message = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null
      if (!res.ok || message) {
        setError(message ?? 'The stock photo library could not be reached just now. Nothing has been changed.')
        setResults([])
      } else {
        setResults(Array.isArray(data) ? data : [])
      }
    } catch {
      setError('The stock photo library could not be reached just now. Nothing has been changed. Try again in a moment.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount and when source changes
  useEffect(() => {
    fetchPhotos(query, source)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPhotos(query, source)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, source, fetchPhotos])

  const handleSelect = (photo: PhotoResult) => {
    // The terms require a download to be registered when a picture is actually
    // taken, and that call carries our credential — so it is made on the server.
    // Fired from the browser it could not attach the header and 401'd every
    // time, invisibly, which looked exactly like compliance and was not.
    if (source === 'unsplash' && photo.download_url) {
      fetch('/api/media/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ download_url: photo.download_url }),
      }).catch(() => {})
    }

    onSelect({
      url: photo.url,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url ?? null,
      id: photo.id,
      source,
      preview: photo.preview,
      alt: photo.alt,
      width: photo.width,
      height: photo.height,
      attribution:
        photo.attribution
        ?? `Photo by ${photo.photographer} on ${source === 'unsplash' ? 'Unsplash' : 'Pexels'}`,
    })
  }

  return (
    <div className="space-y-4">
      {/* Source toggle — only when there is a genuine choice to make. */}
      {available.length > 1 ? (
      <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
        {available.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setSource(src)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colours',
              source === src
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {src}
          </button>
        ))}
      </div>
      ) : null}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${source === 'unsplash' ? 'Unsplash' : 'Pexels'} photos...`}
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)]"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="columns-2 gap-2 sm:columns-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="mb-2 aspect-[3/4] animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : error ? (
        <p
          className="rounded-lg border px-4 py-3 text-[12.5px] leading-relaxed"
          style={{
            borderColor: 'var(--warn, oklch(0.63 0.13 75))',
            background: 'var(--warn-wash, oklch(0.964 0.052 80))',
            color: 'var(--ink, oklch(0.20 0.014 240))',
          }}
        >
          {error}
        </p>
      ) : results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No photos found
        </p>
      ) : (
        <div className="columns-2 gap-2 sm:columns-3">
          {results.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => handleSelect(photo)}
              className="group relative mb-2 block w-full overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-[oklch(0.55_0.1_240)] hover:ring-1 hover:ring-[oklch(0.55_0.1_240)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.preview}
                alt={photo.alt || 'Stock photo'}
                className="w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-xs text-white">
                  {source === 'unsplash'
                    ? `Photo by ${photo.photographer} on Unsplash`
                    : photo.photographer}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Attribution (required by TOS) */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <span className="text-[10px] text-muted-foreground">
          Photos provided by
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {source === 'unsplash' ? 'Unsplash' : 'Pexels'}
        </span>
      </div>
    </div>
  )
}
