import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncBrandToCanva, describeBrandSync } from '@/lib/canva/brand-sync'

/**
 * Push a project's brand into Canva from wherever the owner happens to be.
 *
 * Exposed to plugged-in clients as well as the Director, because he sets a
 * brand up when he thinks of it — often in Hermes, rarely sitting in the web
 * app. It only ever writes his own recorded brand into his own Canva account.
 */
export function createSyncBrandToCanvaTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      "Push a project's brand into Canva: uploads its real logo and makes a folder for its designs, then lists exactly what Canva cannot accept over its API — colours, fonts, voice and guidelines — so the owner enters those once by hand. Use when setting a project up in Canva or after its brand changes.",
    inputSchema: z.object({
      project_id: z.string().optional().describe('Another project. Leave empty for the current one.'),
    }),
    execute: async ({ project_id }) => {
      const result = await syncBrandToCanva(supabase, userId, project_id ?? brandId)
      return {
        synced: result.ok,
        logo_asset_id: result.logoAssetId ?? null,
        folder_id: result.folderId ?? null,
        report: describeBrandSync(result),
        ...(result.error ? { note: result.error } : {}),
      }
    },
  })
}
