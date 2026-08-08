import { tool } from 'ai'
import { userSafeError } from '@/lib/errors/user-safe'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Query Outputs tool — lets any agent search the output library to learn
 * from past work by ANY department. Enables cross-agent learning.
 *
 * Returns formatted markdown for direct display in chat.
 */
export function createQueryOutputsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Search the output library to find past work by any department for this brand. Use this to reference previous strategies, content, scripts, or reports. Also use this when the user asks to see their recent content or outputs.',
    inputSchema: z.object({
      type: z
        .enum([
          'social_post', 'blog_article', 'ad_copy', 'email_sequence',
          'video_script', 'strategy_doc', 'other',
        ])
        .optional()
        .describe('Filter by output type'),
      limit: z.number().min(1).max(20).default(5).describe('Number of results to return'),
      search: z
        .string()
        .optional()
        .describe('Search term to filter outputs by title or content'),
    }),
    execute: async ({ type, limit, search }) => {
      let query = supabase
        .from('outputs')
        .select('id, title, output_type, content, metadata, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })

      if (type) {
        query = query.eq('output_type', type)
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
      }

      const { data, error } = await query.limit(limit)

      if (error) {
        return userSafeError('query-outputs', error, 'Could not read your saved work just now. Try again in a moment.')
      }

      if (!data || data.length === 0) {
        const filterNote = type ? ` of type "${type.replace(/_/g, ' ')}"` : ''
        const searchNote = search ? ` matching "${search}"` : ''
        return `## Recent Content\n\nNo outputs found${filterNote}${searchNote}. Want me to create something?`
      }

      // Include the actual content, not just a bibliography. This tool exists
      // so an agent can BUILD ON past work — a title list can't do that. The
      // Director once found its own saved captions here and still had to ask
      // the user to paste them back, because content was fetched and dropped.
      //
      // Budget the text so a wide search can't blow the context window: the
      // fewer the results, the more of each one is worth carrying.
      const perOutputBudget = data.length <= 2 ? 6000 : data.length <= 5 ? 3000 : 1200

      const lines: string[] = [`## Recent Content (${data.length} result${data.length === 1 ? '' : 's'})\n`]

      data.forEach((output, idx) => {
        const title = output.title ?? 'Untitled'
        const typeLabel = (output.output_type as string).replace(/_/g, ' ')
        const date = new Date(output.created_at).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Australia/Sydney',
        })

        lines.push(`### ${idx + 1}. ${title}`)
        lines.push(`_${typeLabel} · ${date} · id: ${output.id}_`)
        lines.push('')

        const content = typeof output.content === 'string' ? output.content : ''
        if (!content.trim()) {
          lines.push('_(no content saved on this output)_')
        } else if (content.length <= perOutputBudget) {
          lines.push(content)
        } else {
          lines.push(content.slice(0, perOutputBudget))
          lines.push('')
          lines.push(
            `_… truncated (${content.length} chars total). Search with a narrower term, or a smaller limit, to get the full text._`,
          )
        }
        lines.push('')
      })

      lines.push('Want me to repurpose any of these, or create something new?')

      return lines.join('\n')
    },
  })
}
