import { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/constants'

export default function robots(): MetadataRoute.Robots {
  return {
    host: SITE_CONFIG.url,
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/agency/', '/api/', '/telegram/'],
    },
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  }
}
