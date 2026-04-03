/**
 * Parses message text for inline card markers and splits the text into
 * segments of plain markdown and structured card data.
 *
 * Agents emit cards by including a JSON code block with a `__card` field:
 *
 * ```json:card
 * { "__card": "post_preview", "platform": "instagram", ... }
 * ```
 *
 * This parser extracts those blocks and returns an array of segments.
 */

import type { PostPreviewCardProps } from './PostPreviewCard'
import type { AnalyticsSummaryCardProps } from './AnalyticsSummaryCard'
import type { CalendarWeekCardProps } from './CalendarWeekCard'

// ─── Segment Types ──────────────────────────────────────────────────────────

export interface BrandSavedCardData {
  action: 'created' | 'updated'
  brand_name: string
  fields: string[]
}

export type InlineSegment =
  | { type: 'markdown'; content: string }
  | { type: 'post_preview'; data: PostPreviewCardProps }
  | { type: 'analytics_summary'; data: AnalyticsSummaryCardProps }
  | { type: 'calendar_week'; data: CalendarWeekCardProps }
  | { type: 'brand_saved'; data: BrandSavedCardData }

// ─── Parser ─────────────────────────────────────────────────────────────────

// Match ```json:card ... ``` or ```card ... ``` blocks
const CARD_BLOCK_RE = /```(?:json:card|card)\s*\n([\s\S]*?)```/g

export function parseInlineCards(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(CARD_BLOCK_RE)) {
    const matchStart = match.index!
    const matchEnd = matchStart + match[0].length

    // Add any preceding markdown
    if (matchStart > lastIndex) {
      const md = text.slice(lastIndex, matchStart).trim()
      if (md) segments.push({ type: 'markdown', content: md })
    }

    // Try to parse the JSON block
    try {
      const json = JSON.parse(match[1])
      const cardType = json.__card ?? json._card ?? json.type

      switch (cardType) {
        case 'post_preview':
          segments.push({
            type: 'post_preview',
            data: {
              platform: json.platform ?? 'instagram',
              caption: json.caption ?? '',
              hashtags: json.hashtags,
              scheduledAt: json.scheduledAt ?? json.scheduled_at,
              status: json.status ?? 'draft',
              postId: json.postId ?? json.post_id ?? json.id,
            },
          })
          break

        case 'analytics_summary':
          segments.push({
            type: 'analytics_summary',
            data: {
              totalPosts: json.totalPosts ?? json.total_posts ?? 0,
              platformBreakdown: json.platformBreakdown ?? json.platform_breakdown ?? {},
              totalOutputs: json.totalOutputs ?? json.total_outputs ?? 0,
              aiSpendCents: json.aiSpendCents ?? json.ai_spend_cents ?? 0,
              period: json.period ?? 'Summary',
            },
          })
          break

        case 'calendar_week':
          segments.push({
            type: 'calendar_week',
            data: {
              posts: (json.posts ?? []).map((p: Record<string, unknown>) => ({
                day: (p.day as string) ?? '',
                platform: (p.platform as string) ?? '',
                caption: (p.caption as string) ?? '',
                status: (p.status as string) ?? 'draft',
                id: (p.id as string) ?? '',
              })),
              title: json.title as string | undefined,
            },
          })
          break

        case 'brand_saved':
          segments.push({
            type: 'brand_saved',
            data: {
              action: json.action ?? 'updated',
              brand_name: json.brand_name ?? '',
              fields: json.fields ?? [],
            },
          })
          break

        default:
          // Unknown card type — render as markdown code block
          segments.push({ type: 'markdown', content: match[0] })
      }
    } catch {
      // Invalid JSON — keep as markdown
      segments.push({ type: 'markdown', content: match[0] })
    }

    lastIndex = matchEnd
  }

  // Any trailing text
  if (lastIndex < text.length) {
    const md = text.slice(lastIndex).trim()
    if (md) segments.push({ type: 'markdown', content: md })
  }

  // If no cards were found, return null to signal "no inline cards"
  return segments
}

/**
 * Quick check: does this text contain any inline card markers?
 * Avoids running the full parser on every message.
 */
export function hasInlineCards(text: string): boolean {
  return text.includes('```json:card') || text.includes('```card')
}
