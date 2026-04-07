'use client'

import Link from 'next/link'
import type { HelpCategory } from '@/lib/help/types'

interface HelpCategoryCardProps {
  category: HelpCategory & { articleCount: number }
}

export function HelpCategoryCard({ category }: HelpCategoryCardProps) {
  return (
    <Link
      href={`/help/${category.slug}`}
      style={{
        display: 'block',
        padding: '2rem 1.75rem',
        background: 'oklch(0.1 0.005 240)',
        border: '1px solid oklch(0.2 0.01 240)',
        borderRadius: '10px',
        textDecoration: 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'oklch(0.3 0.015 240)'
        e.currentTarget.style.boxShadow =
          '0 0 20px oklch(0.5 0.01 240 / 0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'oklch(0.2 0.01 240)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        style={{
          fontSize: '1.4rem',
          marginBottom: '0.75rem',
          color: category.colour,
        }}
        aria-hidden="true"
      >
        {getCategoryEmoji(category.slug)}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
          fontSize: '1.1rem',
          fontWeight: 600,
          color: 'oklch(0.9 0.005 240)',
          marginBottom: '0.4rem',
        }}
      >
        {category.title}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
          fontSize: '0.88rem',
          color: 'oklch(0.55 0 0)',
          lineHeight: 1.5,
          marginBottom: '0.75rem',
        }}
      >
        {category.description}
      </p>
      <span
        style={{
          fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'oklch(0.45 0 0)',
          letterSpacing: '0.08em',
        }}
      >
        {category.articleCount} article{category.articleCount !== 1 ? 's' : ''}
      </span>
    </Link>
  )
}

/**
 * Map category slugs to simple text symbols (no emoji dependency).
 * Uses Unicode symbols that render consistently across platforms.
 */
function getCategoryEmoji(slug: string): string {
  const map: Record<string, string> = {
    'getting-started': '\u2192', // →
    'talking-to-director': '\u2261', // ≡
    'creating-content': '\u270E', // ✎
    publishing: '\u25B6', // ▶
    'video-and-design': '\u25A0', // ■
    'your-brand': '\u2666', // ♦
    'team-and-sharing': '\u2605', // ★
    'connecting-devices': '\u25CB', // ○
    compliance: '\u2713', // ✓
    'understanding-reports': '\u2588', // █
    'account-and-billing': '\u25CF', // ●
    troubleshooting: '\u2699', // ⚙
  }
  return map[slug] ?? '\u25A0'
}
