import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LandingNav } from '@/components/landing/LandingNav'
import { AgencyFooter } from '@/components/landing/AgencyFooter'
import { HelpSidebar } from '@/components/help/HelpSidebar'
import { HelpBreadcrumbs } from '@/components/help/HelpBreadcrumbs'
import { HelpArticleBody } from '@/components/help/HelpArticleBody'
import { HelpRelatedArticles } from '@/components/help/HelpRelatedArticles'
import {
  getCategory,
  getArticle,
  getArticlesByCategory,
  ALL_ARTICLES,
  HELP_CATEGORIES,
} from '@/lib/help'

export function generateStaticParams() {
  return ALL_ARTICLES.map((a) => ({
    category: a.categorySlug,
    slug: a.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category, slug } = await params
  const article = getArticle(category, slug)
  if (!article) return {}
  const cat = getCategory(category)
  return {
    title: `${article.title} | ${cat?.title ?? 'Help'} | NotRealSmart Agency`,
    description: article.subtitle,
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category: catSlug, slug } = await params
  const category = getCategory(catSlug)
  const article = getArticle(catSlug, slug)
  if (!category || !article) notFound()

  const categoryArticles = getArticlesByCategory(catSlug)

  // Find prev/next articles in this category
  const currentIndex = categoryArticles.findIndex((a) => a.slug === slug)
  const prevArticle =
    currentIndex > 0 ? categoryArticles[currentIndex - 1] : null
  const nextArticle =
    currentIndex < categoryArticles.length - 1
      ? categoryArticles[currentIndex + 1]
      : null

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
              { label: category.title, href: `/help/${category.slug}` },
              { label: article.title },
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
              <HelpSidebar
                activeCategorySlug={catSlug}
                articles={categoryArticles}
                activeArticleSlug={slug}
              />
            </div>

            {/* Article content */}
            <article style={{ flex: 1, minWidth: 0 }}>
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
                {article.title}
              </h1>
              <p
                style={{
                  fontSize: '1.05rem',
                  color: 'oklch(0.55 0 0)',
                  marginBottom: '0.5rem',
                  lineHeight: 1.6,
                }}
              >
                {article.subtitle}
              </p>
              <p
                style={{
                  fontFamily:
                    "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.65rem',
                  color: 'oklch(0.35 0 0)',
                  letterSpacing: '0.06em',
                  marginBottom: '2.5rem',
                }}
              >
                Last updated {article.lastUpdated}
              </p>

              <HelpArticleBody sections={article.body} />

              <HelpRelatedArticles slugs={article.relatedSlugs} />

              {/* Prev / Next navigation */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  marginTop: '3rem',
                  paddingTop: '2rem',
                  borderTop: '1px solid oklch(0.15 0.005 240)',
                  flexWrap: 'wrap',
                }}
              >
                {prevArticle ? (
                  <Link
                    href={`/help/${prevArticle.categorySlug}/${prevArticle.slug}`}
                    className="text-sm no-underline transition-colors hover:text-white"
                    style={{ color: 'oklch(0.6 0.05 220)' }}
                  >
                    &larr; {prevArticle.title}
                  </Link>
                ) : (
                  <span />
                )}
                {nextArticle ? (
                  <Link
                    href={`/help/${nextArticle.categorySlug}/${nextArticle.slug}`}
                    className="text-sm no-underline text-right transition-colors hover:text-white"
                    style={{ color: 'oklch(0.6 0.05 220)' }}
                  >
                    {nextArticle.title} &rarr;
                  </Link>
                ) : (
                  <span />
                )}
              </div>

              {/* CTA */}
              <div
                style={{
                  marginTop: '3rem',
                  padding: '1.5rem',
                  background: 'oklch(0.1 0.005 240)',
                  border: '1px solid oklch(0.18 0.008 240)',
                  borderRadius: '10px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontSize: '0.95rem',
                    color: 'oklch(0.65 0 0)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Still need help?
                </p>
                <Link
                  href="/agency/chat"
                  className="inline-block no-underline transition-opacity hover:opacity-90"
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    color: 'oklch(0.95 0 0)',
                    background:
                      'linear-gradient(135deg, oklch(0.7 0.005 250), oklch(0.45 0.008 240))',
                  }}
                >
                  Talk to your Director
                </Link>
              </div>
            </article>
          </div>
        </div>
      </main>

      <AgencyFooter />
    </>
  )
}
