import { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/constants'
import { ALL_ARTICLES, HELP_CATEGORIES } from '@/lib/help'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_CONFIG.url
  const publicPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/help`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]
  const helpPages: MetadataRoute.Sitemap = [
    ...HELP_CATEGORIES.map((category) => ({ url: `${baseUrl}/help/${category.slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...ALL_ARTICLES.map((article) => ({ url: `${baseUrl}/help/${article.categorySlug}/${article.slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 })),
  ]

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ...publicPages,
    ...helpPages,
  ]
}
