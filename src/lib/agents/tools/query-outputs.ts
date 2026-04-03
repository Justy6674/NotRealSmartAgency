import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Query Outputs tool — lets any agent search the output library to learn
 * from past work by ANY department. Enables cross-agent learning.
 */
export function createQueryOutputsTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Search the output library to find past work by any department for this brand. Use this to reference previous strategies, content, scripts, or reports before creating new ones. This helps you build on past work and maintain consistency.',
    inputSchema: z.object({
      query: z.string().describe('Search keywords to find relevant outputs (e.g. "video script", "SEO audit", "social media strategy")'),
      output_type: z
        .enum([
          'social_post', 'blog_article', 'ad_copy', 'email_sequence',
          'landing_page', 'seo_audit', 'strategy_doc', 'competitor_report',
          'compliance_check', 'brand_guide', 'analytics_report',
          'automation_workflow', 'video_script', 'video', 'other',
        ])
        .optional()
        .describe('Filter by output type'),
      limit: z.number().min(1).max(10).default(5).describe('Number of results to return (max 10)'),
    }),
    execute: async ({ query, output_type, limit }) => {
      let queryBuilder = supabase
        .from('outputs')
        .select('id, title, output_type, content, metadata, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })

      if (output_type) {
        queryBuilder = queryBuilder.eq('output_type', output_type)
      }

      // Search by title or content keyword match
      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      }

      const { data, error } = await queryBuilder.limit(limit)

      if (error) {
        return { found: false, error: error.message, outputs: [] }
      }

      if (!data || data.length === 0) {
        return { found: false, outputs: [], message: 'No matching outputs found. This may be a new area — create something fresh.' }
      }

      const outputs = data.map((o) => ({
        id: o.id,
        title: o.title,
        type: o.output_type,
        preview: o.content?.slice(0, 300) + (o.content?.length > 300 ? '...' : ''),
        created: new Date(o.created_at).toLocaleDateString('en-AU'),
        compliance: (o.metadata as Record<string, unknown>)?.compliance ?? null,
      }))

      return {
        found: true,
        count: outputs.length,
        outputs,
        hint: 'Reference these past outputs to maintain consistency. Build on previous work rather than starting from scratch.',
      }
    },
  })
}
