'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { searchArticles } from '@/lib/help/search'
import { buildSearchIndex } from '@/lib/help'
import type { SearchEntry, SearchResult } from '@/lib/help/types'

export function HelpSearchOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searchIndex, setSearchIndex] = useState<SearchEntry[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lazy-load search index on first open
  useEffect(() => {
    if (isOpen && !searchIndex) {
      setSearchIndex(buildSearchIndex())
    }
  }, [isOpen, searchIndex])

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
      setActiveIndex(-1)
    }
  }, [isOpen])

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (searchIndex) {
          const found = searchArticles(value, searchIndex)
          setResults(found)
          setActiveIndex(-1)
        }
      }, 150)
    },
    [searchIndex],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault()
        const r = results[activeIndex]
        window.location.href = `/help/${r.categorySlug}/${r.slug}`
        setIsOpen(false)
      }
    },
    [results, activeIndex],
  )

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'oklch(0 0 0 / 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false)
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          margin: '0 1rem',
          background: 'oklch(0.09 0.005 240)',
          border: '1px solid oklch(0.2 0.01 240)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 16px 64px oklch(0 0 0 / 0.5)',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid oklch(0.15 0.005 240)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="oklch(0.5 0 0)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search help articles..."
            style={{
              flex: 1,
              padding: '16px 12px',
              fontSize: '1rem',
              fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
              background: 'transparent',
              border: 'none',
              color: 'oklch(0.9 0 0)',
              outline: 'none',
            }}
          />
          <kbd
            style={{
              fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              padding: '3px 6px',
              borderRadius: '4px',
              background: 'oklch(0.15 0.005 240)',
              border: '1px solid oklch(0.2 0.01 240)',
              color: 'oklch(0.5 0 0)',
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        {query && (
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {results.length > 0 ? (
              results.map((result, i) => (
                <Link
                  key={`${result.categorySlug}/${result.slug}`}
                  href={`/help/${result.categorySlug}/${result.slug}`}
                  onClick={() => setIsOpen(false)}
                  style={{
                    display: 'block',
                    padding: '12px 16px',
                    textDecoration: 'none',
                    borderBottom:
                      i < results.length - 1
                        ? '1px solid oklch(0.12 0.003 240)'
                        : 'none',
                    background:
                      i === activeIndex
                        ? 'oklch(0.14 0.008 240)'
                        : 'transparent',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      'oklch(0.14 0.008 240)')
                  }
                  onMouseLeave={(e) =>
                    i !== activeIndex &&
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      color: 'oklch(0.9 0 0)',
                      marginBottom: '2px',
                    }}
                  >
                    {result.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.78rem',
                      color: 'oklch(0.5 0 0)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily:
                          "var(--font-mono), 'IBM Plex Mono', monospace",
                        fontSize: '0.62rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'oklch(0.55 0.05 220)',
                      }}
                    >
                      {result.categoryTitle}
                    </span>
                    <span style={{ color: 'oklch(0.3 0 0)' }}>·</span>
                    <span>{result.subtitle}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  fontSize: '0.88rem',
                  color: 'oklch(0.45 0 0)',
                }}
              >
                No articles found. Try different words.
              </div>
            )}
          </div>
        )}

        {/* Footer hint */}
        {!query && (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              fontSize: '0.82rem',
              color: 'oklch(0.4 0 0)',
            }}
          >
            Type to search across all help articles
          </div>
        )}

        {/* Browse all link */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid oklch(0.12 0.003 240)',
            textAlign: 'center',
          }}
        >
          <Link
            href="/help"
            onClick={() => setIsOpen(false)}
            style={{
              fontSize: '0.78rem',
              color: 'oklch(0.55 0.05 220)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'oklch(0.75 0.05 220)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'oklch(0.55 0.05 220)')
            }
          >
            Browse all help articles &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
