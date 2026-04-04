/**
 * Inspiration Library tools — add, search, and query cross-industry
 * marketing intelligence that agents use to produce distinctive work.
 */

import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createAddInspirationTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      'Add a marketing inspiration entry to the library. Use when the user mentions a brand, campaign, or marketing approach they admire — from ANY industry. Capture WHY it works and what transferable principle can be applied to their brands.',
    inputSchema: z.object({
      brand_name: z.string().describe('The brand being studied, e.g. "Mutimer", "Gymshark", "Notion"'),
      industry: z.string().describe('Their industry, e.g. "fashion", "fitness", "SaaS"'),
      platform: z.string().optional().describe('Platform observed on: tiktok, instagram, youtube, email, etc.'),
      format: z.string().optional().describe('Content format: short_film, carousel, founder_video, podcast, ad, etc.'),
      what_they_did: z.string().describe('Factual description of the marketing approach'),
      why_it_works: z.string().describe('The psychological or cultural mechanic driving effectiveness'),
      transferable_principle: z.string().describe('The abstracted rule that applies to ANY brand'),
      applicability_tags: z.array(z.string()).optional().describe('Which client types this applies to: healthcare, weight_loss, SaaS, fragrance, etc.'),
      source_url: z.string().optional().describe('URL to the example'),
    }),
    execute: async (input) => {
      const { data, error } = await supabase.from('inspiration_entries').insert({
        user_id: userId,
        ...input,
        applicability_tags: input.applicability_tags ?? [],
      }).select().single()

      if (error) return { saved: false, error: error.message }

      return {
        saved: true,
        id: data.id,
        summary: `Added inspiration: ${input.brand_name} (${input.industry}) — "${input.transferable_principle}"`,
      }
    },
  })
}

export function createSearchInspirationTool(supabase: SupabaseClient, userId: string) {
  return tool({
    description:
      'Search the inspiration library for cross-industry marketing principles. Use before creating campaigns, strategies, or content to find relevant patterns worth emulating. Search by industry, tags, brand name, or keywords.',
    inputSchema: z.object({
      query: z.string().optional().describe('Search text — matches brand_name, industry, what_they_did, transferable_principle'),
      tags: z.array(z.string()).optional().describe('Filter by applicability tags: healthcare, weight_loss, SaaS, fragrance, etc.'),
      industry: z.string().optional().describe('Filter by source industry'),
      limit: z.number().optional().describe('Max results (default 10)'),
    }),
    execute: async (input) => {
      let query = supabase
        .from('inspiration_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(input.limit ?? 10)

      if (input.industry) {
        query = query.ilike('industry', `%${input.industry}%`)
      }

      if (input.tags?.length) {
        query = query.overlaps('applicability_tags', input.tags)
      }

      if (input.query) {
        query = query.or(
          `brand_name.ilike.%${input.query}%,what_they_did.ilike.%${input.query}%,transferable_principle.ilike.%${input.query}%,why_it_works.ilike.%${input.query}%`
        )
      }

      const { data, error } = await query

      if (error) return { found: 0, error: error.message }

      return {
        found: data?.length ?? 0,
        entries: (data ?? []).map(e => ({
          brand: e.brand_name,
          industry: e.industry,
          platform: e.platform,
          what_they_did: e.what_they_did,
          why_it_works: e.why_it_works,
          transferable_principle: e.transferable_principle,
          tags: e.applicability_tags,
          source: e.source_url,
        })),
      }
    },
  })
}
