import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createSaveOutputTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Save a completed marketing deliverable to the output library. Use this when you have produced a finished piece of content the user wants to keep.',
    inputSchema: z.object({
      title: z.string().describe('Short descriptive title for the output'),
      content: z.string().describe('The full content of the deliverable'),
      output_type: z.enum([
        'social_post',
        'blog_article',
        'ad_copy',
        'email_sequence',
        'landing_page',
        'seo_audit',
        'strategy_doc',
        'competitor_report',
        'compliance_check',
        'brand_guide',
        'other',
      ]),
      platform: z
        .string()
        .optional()
        .describe('Target platform (e.g. Instagram, Facebook, Google Ads)'),
    }),
    execute: async ({ title, content, output_type, platform }) => {
      const { data, error } = await supabase
        .from('outputs')
        .insert({
          user_id: userId,
          brand_id: brandId,
          conversation_id: conversationId,
          output_type,
          title,
          content,
          metadata: { platform: platform ?? null, word_count: content.split(/\s+/).filter(Boolean).length },
        })
        .select('id')
        .single()

      if (error) {
        return { saved: false, error: error.message }
      }

      return { saved: true, id: data.id, title }
    },
  })
}
