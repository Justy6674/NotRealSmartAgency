'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2 } from 'lucide-react'

export interface StockPhotoSelection {
  url: string
  photographer: string
  id: number
  source: 'pexels'
  preview: string
  alt: string
  width: number
  height: number
}

interface PhotoResult {
  id: number
  url: string
  preview: string
  photographer: string
  alt: string
  width: number
  height: number
}

interface StockPhotoPickerProps {
  onSelect: (photo: StockPhotoSelection) => void
}

export function StockPhotoPicker({ onSelect }: StockPhotoPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PhotoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPhotos = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ per_page: '20' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/pexels/search?${params}`)
      if (!res.ok) throw new Error('Failed to fetch photos')
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setResults([])
      } else {
        setResults(data)
      }
    } catch {
      setError('Could not load photos. Try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load curated on mount
  useEffect(() => {
    fetchPhotos('')
  }, [fetchPhotos])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPhotos(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchPhotos])

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stock photos..."
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
        <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
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
              onClick={() =>
                onSelect({
                  url: photo.url,
                  photographer: photo.photographer,
                  id: photo.id,
                  source: 'pexels',
                  preview: photo.preview,
                  alt: photo.alt,
                  width: photo.width,
                  height: photo.height,
                })
              }
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
                  {photo.photographer}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pexels attribution (required by TOS) */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <span className="text-[10px] text-muted-foreground">
          Photos provided by
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">
          Pexels
        </span>
      </div>
    </div>
  )
}
