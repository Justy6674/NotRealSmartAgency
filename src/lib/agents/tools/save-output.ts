import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runComplianceFilter } from '../compliance-filter'

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
        'video_script',
        'video',
        'other',
      ]),
      platform: z
        .string()
        .optional()
        .describe('Target platform (e.g. Instagram, Facebook, Google Ads)'),
    }),
    execute: async ({ title, content, output_type, platform }) => {
      // Run compliance filter if brand has AHPRA/TGA flags
      let complianceResult = null
      try {
        const { data: brand } = await supabase
          .from('brands')
          .select('compliance_flags')
          .eq('id', brandId)
          .single()

        if (brand?.compliance_flags) {
          complianceResult = await runComplianceFilter(content, brand.compliance_flags)
        }
      } catch {
        // Non-blocking — save proceeds even if compliance check fails
      }

      const { data, error } = await supabase
        .from('outputs')
        .insert({
          user_id: userId,
          brand_id: brandId,
          conversation_id: conversationId,
          output_type,
          title,
          content,
          metadata: {
            platform: platform ?? null,
            word_count: content.split(/\s+/).filter(Boolean).length,
            compliance: complianceResult,
          },
        })
        .select('id')
        .single()

      if (error) {
        return { saved: false, error: error.message }
      }

      return {
        saved: true,
        id: data.id,
        title,
        ...(complianceResult && !complianceResult.isValid
          ? { compliance_warnings: complianceResult.warnings, compliance_flags: complianceResult.flags }
          : {}),
      }
    },
  })
}
