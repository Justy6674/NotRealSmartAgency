import type { SearchEntry, SearchResult } from './types'

/**
 * Weighted keyword search across all help articles.
 * Title matches score 3x, subtitle 2x, tags 1x.
 * Returns top 8 results sorted by relevance.
 */
export function searchArticles(
  query: string,
  entries: SearchEntry[],
): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)

  if (!terms.length) return []

  return entries
    .map((entry) => {
      const titleLower = entry.title.toLowerCase()
      const subtitleLower = entry.subtitle.toLowerCase()
      const tagsJoined = entry.tags.join(' ').toLowerCase()

      const score = terms.reduce((acc, term) => {
        let s = acc
        if (titleLower.includes(term)) s += 3
        if (subtitleLower.includes(term)) s += 2
        if (tagsJoined.includes(term)) s += 1
        return s
      }, 0)

      return { ...entry, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}
