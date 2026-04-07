'use client'

import Link from 'next/link'
import { HELP_CATEGORIES } from '@/lib/help'
import type { HelpArticle } from '@/lib/help/types'

interface HelpSidebarProps {
  activeCategorySlug: string
  articles?: HelpArticle[]
  activeArticleSlug?: string
}

export function HelpSidebar({
  activeCategorySlug,
  articles,
  activeArticleSlug,
}: HelpSidebarProps) {
  return (
    <nav
      style={{
        width: '240px',
        flexShrink: 0,
        position: 'sticky',
        top: '80px',
        alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
      }}
    >
      <Link
        href="/help"
        style={{
          display: 'block',
          fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'oklch(0.5 0 0)',
          textDecoration: 'none',
          marginBottom: '1.25rem',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'oklch(0.75 0 0)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'oklch(0.5 0 0)')}
      >
        &larr; All categories
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {HELP_CATEGORIES.map((cat) => {
          const isActive = cat.slug === activeCategorySlug
          return (
            <Link
              key={cat.slug}
              href={`/help/${cat.slug}`}
              style={{
                display: 'block',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'oklch(0.9 0.005 240)' : 'oklch(0.55 0 0)',
                background: isActive
                  ? 'oklch(0.15 0.008 240)'
                  : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'oklch(0.12 0.005 240)'
                  e.currentTarget.style.color = 'oklch(0.75 0 0)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'oklch(0.55 0 0)'
                }
              }}
            >
              {cat.title}
            </Link>
          )
        })}
      </div>

      {articles && articles.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div
            style={{
              fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'oklch(0.4 0 0)',
              padding: '0 12px',
              marginBottom: '8px',
            }}
          >
            In this section
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {articles.map((article) => {
              const isActiveArticle = article.slug === activeArticleSlug
              return (
                <Link
                  key={article.slug}
                  href={`/help/${article.categorySlug}/${article.slug}`}
                  style={{
                    display: 'block',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: isActiveArticle
                      ? 'oklch(0.9 0 0)'
                      : 'oklch(0.5 0 0)',
                    fontWeight: isActiveArticle ? 500 : 400,
                    background: isActiveArticle
                      ? 'oklch(0.13 0.005 240)'
                      : 'transparent',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActiveArticle)
                      e.currentTarget.style.color = 'oklch(0.7 0 0)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActiveArticle)
                      e.currentTarget.style.color = 'oklch(0.5 0 0)'
                  }}
                >
                  {article.title}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
