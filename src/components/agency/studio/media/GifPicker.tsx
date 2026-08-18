'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search } from 'lucide-react'

export interface GifSelection {
  url: string
  title: string
  id: string
  source: 'giphy'
  preview: string
  width: number
  height: number
  /** Travels with the file into the library — the terms require the credit. */
  attribution: string
}

interface GifResult {
  id: string
  title: string
  url: string
  preview: string
  width: number
  height: number
  attribution?: string
}

interface GifPickerProps {
  onSelect: (gif: GifSelection) => void
}

export function GifPicker({ onSelect }: GifPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ source: 'giphy', limit: '24' })
      if (q.trim()) params.set('q', q.trim())
      // Behind the sign-in: the search quota is ours, and an open proxy is a
      // stranger's loop away from a dark tab with no visible cause.
      const res = await fetch(`/api/media/stock?${params}`)
      // The body carries the owner-facing sentence on BOTH branches. Throwing
      // on !res.ok and printing a generic line here is how "this is switched
      // off" used to reach the screen as "No GIFs found" — a sentence about
      // his search terms rather than about our configuration.
      const data = await res.json().catch(() => null)
      const message = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null
      if (!res.ok || message) {
        setError(message ?? 'The GIF library could not be reached just now. Nothing has been changed.')
        setResults([])
      } else {
        setResults(Array.isArray(data) ? data : [])
      }
    } catch {
      setError('The GIF library could not be reached just now. Nothing has been changed. Try again in a moment.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load trending on mount
  useEffect(() => {
    fetchGifs('')
  }, [fetchGifs])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchGifs(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchGifs])

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)]"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-muted"
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
          No GIFs found
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {results.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() =>
                onSelect({
                  url: gif.url,
                  title: gif.title,
                  id: gif.id,
                  source: 'giphy',
                  preview: gif.preview,
                  width: gif.width,
                  height: gif.height,
                  attribution: gif.attribution ?? 'GIPHY',
                })
              }
              className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-[oklch(0.55_0.1_240)] hover:ring-1 hover:ring-[oklch(0.55_0.1_240)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gif.preview}
                alt={gif.title || 'GIF'}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              {gif.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-xs text-white">{gif.title}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Giphy attribution (required by TOS) */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <span className="text-[10px] text-muted-foreground">Powered by</span>
        <span className="text-[10px] font-semibold text-muted-foreground">
          GIPHY
        </span>
      </div>
    </div>
  )
}
