/**
 * Director tool: create_collage
 *
 * Combine several images from the media library into ONE image and file it back
 * in the library, ready to attach to a post.
 *
 * A carousel and a collage are not the same thing, and only the carousel
 * existed — so asking for a collage silently produced a swipeable carousel
 * instead of a single composed image.
 */

import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCollage, type CollageShape } from '@/lib/media/collage'

export function createCollageTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Combine 2-9 images from the media library into ONE single collage image and save it back to the library. Use this when the user asks for a collage, a grid, or several photos "in one image". This is NOT a carousel — a carousel is several images the viewer swipes through, which you make by attaching several media_item_ids to one post. Returns a new media_item_id you can then attach to a draft.',
    inputSchema: z.object({
      media_item_ids: z
        .array(z.string().uuid())
        .min(2)
        .max(9)
        .describe('Media library image IDs, in the order they should appear in the collage'),
      shape: z
        .enum(['portrait', 'square', 'story', 'landscape'])
        .default('portrait')
        .describe('portrait = 4:5 feed (default), square = 1:1, story = 9:16, landscape = 1.91:1'),
      background: z
        .string()
        .optional()
        .describe('Hex colour shown between the images, e.g. "#faf4ec". Use a brand colour.'),
      name: z.string().optional().describe('A descriptive name for the saved collage'),
    }),
    execute: async ({ media_item_ids, shape, background, name }) => {
      const { data: rows, error } = await supabase
        .from('media_items')
        .select('id, file_url, file_type')
        .in('id', media_item_ids)
        .eq('brand_id', brandId)

      if (error) return { success: false, error: `Could not read the media: ${error.message}` }

      // Keep the caller's order — the query returns rows in whatever order it likes.
      const ordered = media_item_ids
        .map((id) => rows?.find((row) => row.id === id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))

      if (ordered.length < 2) {
        return {
          success: false,
          error: 'Fewer than 2 of those media items exist for this brand. Check the IDs with query_media.',
        }
      }

      const notImages = ordered.filter((row) => !String(row.file_type).startsWith('image/'))
      if (notImages.length > 0) {
        return {
          success: false,
          error: `A collage is made from images, but ${notImages.length} of those are not images. Remove them, or use the video on its own.`,
        }
      }

      let collage: Buffer
      try {
        const images = await Promise.all(
          ordered.map(async (row) => {
            const res = await fetch(row.file_url as string)
            if (!res.ok) throw new Error(`could not download ${row.id}`)
            return Buffer.from(await res.arrayBuffer())
          }),
        )
        collage = await buildCollage({
          images,
          shape: shape as CollageShape,
          ...(background ? { background } : {}),
        })
      } catch (err) {
        return {
          success: false,
          error: `The collage could not be built: ${err instanceof Error ? err.message : String(err)}`,
        }
      }

      const fileName = `${(name ?? 'collage').replace(/[^a-zA-Z0-9._-]/g, '-')}-${Date.now()}.png`
      const storagePath = `${userId}/${brandId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(storagePath, collage, { contentType: 'image/png', upsert: false })

      if (uploadError) {
        return { success: false, error: `The collage could not be saved: ${uploadError.message}` }
      }

      const fileUrl = supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl

      const { data: created, error: rowError } = await supabase
        .from('media_items')
        .insert({
          user_id: userId,
          brand_id: brandId,
          file_url: fileUrl,
          file_name: fileName,
          file_type: 'image/png',
          file_size_bytes: collage.length,
          transcription_status: 'transcribed',
          metadata: {
            source: 'collage',
            built_from: media_item_ids,
            shape: shape ?? 'portrait',
          },
        })
        .select('id')
        .single()

      if (rowError || !created) {
        return { success: false, error: `The collage was saved but not filed: ${rowError?.message}` }
      }

      return {
        success: true,
        media_item_id: created.id,
        file_url: fileUrl,
        images_used: ordered.length,
        shape: shape ?? 'portrait',
        next_step:
          'Attach this single media_item_id to a draft with manage_posts create_draft. Do not also attach the source images — the collage already contains them.',
      }
    },
  })
}
