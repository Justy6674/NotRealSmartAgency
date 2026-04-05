import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, fetchBrandGlossary } from '@/lib/heygen/client'

export function createGetBrandGlossaryTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get the HeyGen brand glossary — custom pronunciation rules for brand names, product names, medical terms, and other words that AI voices might mispronounce. Essential for healthcare brands with clinical terminology.',
    inputSchema: z.object({}),
    execute: async () => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const entries = await fetchBrandGlossary(apiKey)

        if (entries.length === 0) {
          return {
            success: true,
            entries: [],
            message:
              'No glossary entries found. You can add pronunciation rules in your HeyGen account to ensure brand names and terms are spoken correctly.',
          }
        }

        return {
          success: true,
          entries,
          count: entries.length,
          message: `Found ${entries.length} glossary entr${entries.length === 1 ? 'y' : 'ies'} with custom pronunciation rules.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to fetch brand glossary from HeyGen',
        }
      }
    },
  })
}
