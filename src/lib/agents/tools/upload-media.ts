import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Upload an image or video to the brand's media library.
 * Accepts base64 data (from chat images) or a public URL.
 * Saves to Supabase Storage + creates a media_items record
 * with tags/label so it's findable and reusable.
 */
export function createUploadMediaTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Upload an image or video to the brand\'s media library. Use when the user shares an image in chat and wants to save it for future posts, or when you need to store media with tags. Accepts base64 image data OR a public URL. The media is saved permanently and can be used with publish_to_social via the returned image_url.',
    inputSchema: z.object({
      base64_data: z
        .string()
        .optional()
        .describe('Base64-encoded image/video data (from a chat attachment). Include the data URI prefix like "data:image/png;base64,..." or just the raw base64.'),
      source_url: z
        .string()
        .optional()
        .describe('Public URL to download the image/video from. Use this if the user provides a link instead of dropping a file.'),
      file_name: z
        .string()
        .optional()
        .describe('Descriptive file name (e.g. "telescribe-logo", "clinic-hero-shot"). Auto-generated if not provided.'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Tags for organising and finding this media later (e.g. ["logo", "brand", "hero"]). Plain words, no hashes.'),
      description: z
        .string()
        .optional()
        .describe('Brief description of the media for search and context.'),
    }),
    execute: async ({ base64_data, source_url, file_name, tags, description }) => {
      if (!base64_data && !source_url) {
        return 'Please provide either base64_data (from a chat image) or source_url (a public link to download from).'
      }

      try {
        let buffer: Buffer
        let contentType = 'image/png'
        let extension = 'png'

        if (base64_data) {
          // Parse data URI if present
          const dataUriMatch = base64_data.match(/^data:([^;]+);base64,(.+)$/)
          if (dataUriMatch) {
            contentType = dataUriMatch[1]
            buffer = Buffer.from(dataUriMatch[2], 'base64')
          } else {
            // Raw base64
            buffer = Buffer.from(base64_data, 'base64')
          }

          // Detect extension from content type
          const typeMap: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'video/mp4': 'mp4',
            'video/quicktime': 'mov',
            'video/webm': 'webm',
          }
          extension = typeMap[contentType] ?? 'png'
        } else if (source_url) {
          // Download from URL
          const res = await fetch(source_url)
          if (!res.ok) {
            return `Failed to download from ${source_url} (${res.status}). Make sure the URL is publicly accessible.`
          }
          const arrayBuffer = await res.arrayBuffer()
          buffer = Buffer.from(arrayBuffer)
          contentType = res.headers.get('content-type') ?? 'image/png'

          const typeMap: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
          }
          extension = typeMap[contentType.split(';')[0]] ?? 'png'
        } else {
          return 'No media data provided.'
        }

        // Build file name
        const safeName = (file_name ?? `upload-${Date.now()}`)
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, '-')
          .replace(/-+/g, '-')
        const fullName = `${safeName}.${extension}`
        const storagePath = `${userId}/${brandId}/${fullName}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          })

        if (uploadError) {
          return `Upload failed: ${uploadError.message}`
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)
        const publicUrl = urlData.publicUrl

        // Create media_items record
        const isVideo = contentType.startsWith('video/')
        const { data: mediaItem, error: mediaError } = await supabase
          .from('media_items')
          .insert({
            user_id: userId,
            brand_id: brandId,
            file_url: publicUrl,
            file_name: fullName,
            file_type: contentType,
            file_size_bytes: buffer.length,

            metadata: {
              tags: tags ?? [],
              description: description ?? '',
              uploaded_via: 'mcp_upload_media',
              source: source_url ? 'url' : 'base64',
            },
          })
          .select('id')
          .single()

        if (mediaError) {
          console.error('[upload-media] media_items insert failed:', mediaError.message)
        }

        const sizeKb = Math.round(buffer.length / 1024)
        const tagList = tags?.length ? ` Tags: ${tags.join(', ')}.` : ''
        const mediaType = isVideo ? 'Video' : 'Image'

        return {
          success: true,
          image_url: publicUrl,
          media_item_id: mediaItem?.id ?? null,
          file_name: fullName,
          file_type: contentType,
          size_kb: sizeKb,
          message: `${mediaType} saved to library (${sizeKb}KB).${tagList} URL: ${publicUrl}\n\nUse this URL with publish_to_social to include it in posts.`,
        }
      } catch (err) {
        return `Upload failed: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
