// ---------------------------------------------------------------------------
// Help Centre — Type Definitions
// ---------------------------------------------------------------------------

export interface HelpSection {
  heading?: string
  body?: string
  tip?: string
  steps?: string[]
  warning?: string
}

export interface HelpArticle {
  slug: string
  categorySlug: string
  title: string
  subtitle: string
  body: HelpSection[]
  tags: string[]
  relatedSlugs: string[] // format: "categorySlug/articleSlug"
  lastUpdated: string    // ISO date
}

export interface HelpCategory {
  slug: string
  title: string
  description: string
  icon: string           // Lucide icon name
  colour: string         // oklch accent colour
}

export interface SearchEntry {
  title: string
  subtitle: string
  tags: string[]
  categorySlug: string
  categoryTitle: string
  slug: string
}

export interface SearchResult extends SearchEntry {
  score: number
}
