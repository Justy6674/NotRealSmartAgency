import type { HelpArticle, HelpCategory, SearchEntry } from './types'
import { HELP_CATEGORIES } from './categories'
import { gettingStartedArticles } from './articles/getting-started'
import { talkingToDirectorArticles } from './articles/talking-to-director'
import { creatingContentArticles } from './articles/creating-content'
import { publishingArticles } from './articles/publishing'
import { videoAndDesignArticles } from './articles/video-and-design'
import { yourBrandArticles } from './articles/your-brand'
import { teamAndSharingArticles } from './articles/team-and-sharing'
import { connectingDevicesArticles } from './articles/connecting-devices'
import { complianceArticles } from './articles/compliance'
import { understandingReportsArticles } from './articles/understanding-reports'
import { accountAndBillingArticles } from './articles/account-and-billing'
import { troubleshootingArticles } from './articles/troubleshooting'

// ---------------------------------------------------------------------------
// All articles, flat
// ---------------------------------------------------------------------------

export const ALL_ARTICLES: HelpArticle[] = [
  ...gettingStartedArticles,
  ...talkingToDirectorArticles,
  ...creatingContentArticles,
  ...publishingArticles,
  ...videoAndDesignArticles,
  ...yourBrandArticles,
  ...teamAndSharingArticles,
  ...connectingDevicesArticles,
  ...complianceArticles,
  ...understandingReportsArticles,
  ...accountAndBillingArticles,
  ...troubleshootingArticles,
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const categoryMap = new Map(HELP_CATEGORIES.map((c) => [c.slug, c]))
const articleMap = new Map(
  ALL_ARTICLES.map((a) => [`${a.categorySlug}/${a.slug}`, a]),
)

export function getCategory(slug: string): HelpCategory | undefined {
  return categoryMap.get(slug)
}

export function getArticlesByCategory(categorySlug: string): HelpArticle[] {
  return ALL_ARTICLES.filter((a) => a.categorySlug === categorySlug)
}

export function getArticle(
  categorySlug: string,
  articleSlug: string,
): HelpArticle | undefined {
  return articleMap.get(`${categorySlug}/${articleSlug}`)
}

export function getCategoriesWithCounts(): (HelpCategory & {
  articleCount: number
})[] {
  return HELP_CATEGORIES.map((cat) => ({
    ...cat,
    articleCount: getArticlesByCategory(cat.slug).length,
  }))
}

// ---------------------------------------------------------------------------
// Search index — lightweight entries for client-side search
// ---------------------------------------------------------------------------

export function buildSearchIndex(): SearchEntry[] {
  return ALL_ARTICLES.map((a) => ({
    title: a.title,
    subtitle: a.subtitle,
    tags: a.tags,
    categorySlug: a.categorySlug,
    categoryTitle: categoryMap.get(a.categorySlug)?.title ?? '',
    slug: a.slug,
  }))
}

export { HELP_CATEGORIES }
export type { HelpArticle, HelpCategory, SearchEntry }
