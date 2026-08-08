import { tool } from 'ai'
import { userSafeError } from '@/lib/errors/user-safe'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runComplianceFilter } from '../compliance-filter'
import { complianceGateForSave } from '../save-gate'

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
      let regulated = false
      try {
        const { data: brand } = await supabase
          .from('brands')
          .select('compliance_flags, brand_dna_constraints')
          .eq('id', brandId)
          .single()

        regulated = Boolean(brand?.compliance_flags?.ahpra || brand?.compliance_flags?.tga)

        if (brand?.compliance_flags || brand?.brand_dna_constraints) {
          complianceResult = await runComplianceFilter(content, brand.compliance_flags ?? { ahpra: false, tga: false, tga_categories: [] }, brand.brand_dna_constraints)
        }
      } catch {
        // Non-blocking for an unregulated project — see the gate below, which
        // is what decides for a regulated one.
      }

      // The library is not just storage: `query_outputs` lets every department
      // read it back as an example of prior work, so content that failed a
      // regulatory review would come back later as a model to copy. For a
      // regulated project the review must have both run and passed before
      // anything is written down.
      if (regulated) {
        const gate = complianceGateForSave(complianceResult)
        if (!gate.allowed) return { saved: false, error: gate.reason }
      }

      // Only attach the conversation if it has actually been written down.
      //
      // `outputs.conversation_id` is a foreign key, and a brand-new chat has no
      // row in `conversations` yet — the id exists client-side before it is
      // persisted. Passing it produced a 23503 foreign key violation, so every
      // save from a fresh chat was rejected. The agent reported success anyway
      // and the work was gone: the exact case that started this investigation.
      //
      // The conversation link is a nicety; the content is the point. Losing the
      // link is a footnote, losing a finished carousel is the user's afternoon.
      let linkedConversationId: string | null = conversationId ?? null
      if (linkedConversationId) {
        const { data: conversationRow } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', linkedConversationId)
          .maybeSingle()
        if (!conversationRow) linkedConversationId = null
      }

      const { data, error } = await supabase
        .from('outputs')
        .insert({
          user_id: userId,
          brand_id: brandId,
          conversation_id: linkedConversationId,
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
        // Say it plainly enough that the agent repeats it rather than glossing
        // over it — a save that failed must not be reported as a save.
        console.error('[save_output] insert failed:', error.code, error.message)
        return {
          saved: false,
          error: `${userSafeError('save-output', error, 'NOT SAVED.')} Tell the user their content was not stored and offer to try again. Do not claim it was saved.`,
        }
      }

      return {
        saved: true,
        id: data.id,
        title,
        ...(complianceResult
          ? {
              ...(complianceResult.warnings.length ? { compliance_warnings: complianceResult.warnings } : {}),
              ...(complianceResult.flags.length ? { compliance_flags: complianceResult.flags } : {}),
              ...(complianceResult.regulatoryCitations.length ? { regulatory_citations: complianceResult.regulatoryCitations } : {}),
              ...(complianceResult.regulatoryCorpusVersion ? { regulatory_corpus_version: complianceResult.regulatoryCorpusVersion } : {}),
            }
          : {}),
      }
    },
  })
}
