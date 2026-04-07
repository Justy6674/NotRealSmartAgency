import { notFound } from 'next/navigation'
import { LandingNav } from '@/components/landing/LandingNav'
import { AgencyFooter } from '@/components/landing/AgencyFooter'
import { HelpSidebar } from '@/components/help/HelpSidebar'
import { HelpBreadcrumbs } from '@/components/help/HelpBreadcrumbs'
import { HelpArticleCard } from '@/components/help/HelpArticleCard'
import { HelpSearch } from '@/components/help/HelpSearch'
import {
  getCategory,
  getArticlesByCategory,
  buildSearchIndex,
  HELP_CATEGORIES,
} from '@/lib/help'

export function generateStaticParams() {
  return HELP_CATEGORIES.map((cat) => ({ category: cat.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: slug } = await params
  const cat = getCategory(slug)
  if (!cat) return {}
  return {
    title: `${cat.title} | Help Centre | NotRealSmart Agency`,
    description: cat.description,
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: slug } = await params
  const category = getCategory(slug)
  if (!category) notFound()

  const articles = getArticlesByCategory(slug)
  const searchIndex = buildSearchIndex()

  return (
    <>
      <LandingNav />

      <main
        style={{
          position: 'relative',
          minHeight: '100vh',
          background: 'oklch(0.06 0 0)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `repeating-linear-gradient(
              90deg,
              oklch(0.5 0 0 / 0.02) 0px,
              transparent 1px,
              transparent 3px,
              oklch(0.5 0 0 / 0.015) 4px,
              transparent 5px,
              transparent 8px
            )`,
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '6rem 1.5rem 5rem',
          }}
        >
          <HelpBreadcrumbs
            crumbs={[
              { label: 'Help', href: '/help' },
              { label: category.title },
            ]}
          />

          <div
            style={{
              display: 'flex',
              gap: '3rem',
            }}
          >
            {/* Sidebar — hidden on mobile */}
            <div className="hidden lg:block">
              <HelpSidebar activeCategorySlug={slug} articles={articles} />
            </div>

            {/* Main content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily:
                    "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: category.colour,
                  marginBottom: '0.5rem',
                }}
              >
                // {category.slug}
              </p>
              <h1
                style={{
                  fontFamily:
                    "var(--font-sans), 'IBM Plex Sans', sans-serif",
                  fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
                  fontWeight: 600,
                  color: 'oklch(0.9 0.005 240)',
                  marginBottom: '0.5rem',
                  textShadow: '0 0 18px oklch(0.6 0.01 240 / 0.35)',
                }}
              >
                {category.title}
              </h1>
              <p
                style={{
                  fontSize: '1rem',
                  color: 'oklch(0.55 0 0)',
                  marginBottom: '1.5rem',
                }}
              >
                {category.description}
              </p>

              <div style={{ marginBottom: '2rem', maxWidth: '480px' }}>
                <HelpSearch
                  searchIndex={searchIndex}
                  placeholder={`Search in ${category.title}...`}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {articles.map((article) => (
                  <HelpArticleCard key={article.slug} article={article} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <AgencyFooter />
    </>
  )
}
