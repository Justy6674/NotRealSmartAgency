import { type Metadata } from 'next'
import { SITE_CONFIG } from './constants'

interface MetadataParams {
  title?: string
  description?: string
  path?: string
  noIndex?: boolean
}

export function constructMetadata({
  title,
  description = SITE_CONFIG.description,
  path = '/',
  noIndex = false,
}: MetadataParams = {}): Metadata {
  const fullTitle = title
    ? `${title} | ${SITE_CONFIG.name}`
    : `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`

  const url = `${SITE_CONFIG.url}${path}`

  return {
    title: fullTitle,
    description,
    icons: {
      icon: '/Favicon.png',
      apple: '/Favicon.png',
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_CONFIG.name,
      locale: 'en_AU',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: url,
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  }
}
