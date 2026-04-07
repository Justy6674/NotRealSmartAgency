'use client'

import Link from 'next/link'
import type { HelpArticle } from '@/lib/help/types'

interface HelpArticleCardProps {
  article: HelpArticle
}

export function HelpArticleCard({ article }: HelpArticleCardProps) {
  return (
    <Link
      href={`/help/${article.categorySlug}/${article.slug}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 1.5rem',
        background: 'oklch(0.1 0.005 240)',
        border: '1px solid oklch(0.18 0.008 240)',
        borderRadius: '8px',
        textDecoration: 'none',
        transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'oklch(0.28 0.012 240)'
        e.currentTarget.style.background = 'oklch(0.12 0.006 240)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'oklch(0.18 0.008 240)'
        e.currentTarget.style.background = 'oklch(0.1 0.005 240)'
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 500,
            color: 'oklch(0.9 0.005 240)',
            marginBottom: '4px',
          }}
        >
          {article.title}
        </div>
        <div
          style={{
            fontSize: '0.85rem',
            color: 'oklch(0.5 0 0)',
            lineHeight: 1.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {article.subtitle}
        </div>
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="oklch(0.4 0 0)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginLeft: '16px' }}
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  )
}
