import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, fetchAssets } from '@/lib/heygen/client'

export function createListHeyGenAssetsTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List all uploaded assets in your HeyGen account — images, logos, backgrounds, and other media files that can be used in video generation.',
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
        const assets = await fetchAssets(apiKey)

        if (assets.length === 0) {
          return {
            success: true,
            assets: [],
            message:
              'No assets found in your HeyGen account. You can upload images, logos, and backgrounds through HeyGen to use in videos.',
          }
        }

        return {
          success: true,
          assets,
          count: assets.length,
          message: `Found ${assets.length} asset(s) in your HeyGen account.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to fetch assets from HeyGen',
        }
      }
    },
  })
}
