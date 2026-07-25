import Link from 'next/link'
import { SITE_CONFIG } from '@/lib/constants'
import { JsonLd } from '@/components/seo/JsonLd'

interface Crumb {
  label: string
  href?: string
}

interface HelpBreadcrumbsProps {
  crumbs: Crumb[]
}

export function HelpBreadcrumbs({ crumbs }: HelpBreadcrumbsProps) {
  const itemListElement = crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.label,
    ...(crumb.href ? { item: `${SITE_CONFIG.url}${crumb.href}` } : {}),
  }))
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement }} />
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.06em', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {i > 0 && <span style={{ color: 'oklch(0.3 0 0)' }} aria-hidden="true">/</span>}
              {crumb.href && !isLast ? <Link href={crumb.href} className="transition-colors hover:text-white" style={{ color: 'oklch(0.5 0 0)', textDecoration: 'none' }}>{crumb.label}</Link> : <span style={{ color: 'oklch(0.7 0 0)' }}>{crumb.label}</span>}
            </span>
          )
        })}
      </nav>
    </>
  )
}
