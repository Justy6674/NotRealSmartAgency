'use client'

import Link from 'next/link'
import { getArticle, getCategory } from '@/lib/help'

interface HelpRelatedArticlesProps {
  slugs: string[] // format: "categorySlug/articleSlug"
}

export function HelpRelatedArticles({ slugs }: HelpRelatedArticlesProps) {
  const related = slugs
    .map((s) => {
      const [catSlug, artSlug] = s.split('/')
      const article = getArticle(catSlug, artSlug)
      const category = getCategory(catSlug)
      return article && category ? { article, category } : null
    })
    .filter(Boolean) as { article: { slug: string; categorySlug: string; title: string; subtitle: string }; category: { title: string } }[]

  if (!related.length) return null

  return (
    <div
      style={{
        marginTop: '3rem',
        paddingTop: '2rem',
        borderTop: '1px solid oklch(0.15 0.005 240)',
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'oklch(0.5 0 0)',
          marginBottom: '1rem',
        }}
      >
        Related articles
      </h3>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {related.map(({ article, category }) => (
          <Link
            key={`${article.categorySlug}/${article.slug}`}
            href={`/help/${article.categorySlug}/${article.slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '6px',
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'oklch(0.12 0.005 240)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="oklch(0.4 0 0)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            <div>
              <div
                style={{
                  fontSize: '0.88rem',
                  color: 'oklch(0.8 0.005 240)',
                  fontWeight: 500,
                }}
              >
                {article.title}
              </div>
              <div
                style={{
                  fontFamily:
                    "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.65rem',
                  color: 'oklch(0.45 0 0)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {category.title}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
