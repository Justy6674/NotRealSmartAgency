import { tool } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod/v3'
import { importCanvaDesignToMedia } from '@/lib/canva/import-design-to-media'

/** Persist a Canva export before it can be offered as a reviewable slide. */
export function createImportCanvaDesignToMediaTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description: 'Export a completed Canva design and save it in the NRS media library. Use this for every finished carousel slide before claiming it is ready for review. A Canva edit URL is not a reviewable or postable media receipt.',
    inputSchema: z.object({
      design_id: z.string().describe('Completed Canva design ID returned by generate_design_structured.'),
      format: z.enum(['png', 'jpg']).default('png'),
      tags: z.array(z.string()).max(12).default([]),
    }),
    execute: async ({ design_id, format, tags }) => {
      const imported = await importCanvaDesignToMedia({
        supabase,
        userId,
        brandId,
        designId: design_id,
        format,
        tags,
      })
      return imported.ok
        ? {
            success: true,
            design_id,
            media_item_id: imported.media.id,
            file_url: imported.media.fileUrl,
            file_name: imported.media.fileName,
            message: `Saved Canva slide as media: ${imported.media.fileName}.`,
          }
        : { success: false, design_id, error: imported.error }
    },
  })
}
