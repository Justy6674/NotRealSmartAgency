'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { searchArticles } from '@/lib/help/search'
import type { SearchEntry, SearchResult } from '@/lib/help/types'

interface HelpSearchProps {
  searchIndex: SearchEntry[]
  placeholder?: string
  autoFocus?: boolean
}

export function HelpSearch({
  searchIndex,
  placeholder = 'Search for help...',
  autoFocus = false,
}: HelpSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const found = searchArticles(value, searchIndex)
        setResults(found)
        setIsOpen(found.length > 0)
        setActiveIndex(-1)
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
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    },
    [results.length],
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
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
          style={{ position: 'absolute', left: '16px', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            width: '100%',
            padding: '14px 16px 14px 48px',
            fontSize: '1rem',
            fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
            background: 'oklch(0.1 0.005 240)',
            border: '1px solid oklch(0.2 0.01 240)',
            borderRadius: '10px',
            color: 'oklch(0.9 0 0)',
            outline: 'none',
            transition: 'border-color 0.2s ease',
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.borderColor = 'oklch(0.3 0.015 240)')
          }
          onMouseOut={(e) =>
            !document.activeElement?.isSameNode(e.currentTarget) &&
            (e.currentTarget.style.borderColor = 'oklch(0.2 0.01 240)')
          }
        />
        {query && (
          <span
            style={{
              position: 'absolute',
              right: '16px',
              fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              color: 'oklch(0.4 0 0)',
              letterSpacing: '0.05em',
            }}
          >
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '6px',
            background: 'oklch(0.1 0.005 240)',
            border: '1px solid oklch(0.2 0.01 240)',
            borderRadius: '10px',
            overflow: 'hidden',
            zIndex: 50,
            boxShadow: '0 8px 32px oklch(0 0 0 / 0.4)',
          }}
        >
          {results.map((result, i) => (
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
                    ? '1px solid oklch(0.15 0.005 240)'
                    : 'none',
                background:
                  i === activeIndex
                    ? 'oklch(0.15 0.01 240)'
                    : 'transparent',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'oklch(0.15 0.01 240)')
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
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'oklch(0.6 0.05 220)',
                  }}
                >
                  {result.categoryTitle}
                </span>
                <span style={{ color: 'oklch(0.3 0 0)' }}>·</span>
                <span>{result.subtitle}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
