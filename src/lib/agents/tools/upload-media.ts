import { tool } from 'ai'
import { userSafeError } from '@/lib/errors/user-safe'
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

        // Check for duplicates — same file name for same brand
        const { data: existing } = await supabase
          .from('media_items')
          .select('id, file_url')
          .eq('brand_id', brandId)
          .eq('file_name', fullName)
          .limit(1)

        if (existing && existing.length > 0) {
          return {
            success: true,
            image_url: existing[0].file_url,
            media_item_id: existing[0].id,
            file_name: fullName,
            message: `This file already exists in the library. URL: ${existing[0].file_url}`,
            duplicate: true,
          }
        }

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

        /**
         * Read it now, so the next question can be answered.
         *
         * Uploading and understanding were separate steps, and only the
         * Director could take the second one. So a file sent from Claude or
         * Codex landed in the library as a filename and nothing else — ask
         * "what's in this video" and the honest answer was that nobody had
         * looked. The assistant then either guessed from the filename or
         * reported the upload as incomplete.
         *
         * Only the stages an answer needs run here: thumbnail, transcript,
         * description — about fourteen seconds on a 2:36 clip, inside any MCP
         * client's patience. `delivery` is a publish-time re-encode bounded at
         * 240s and is deliberately not among them; it is made when something
         * is actually being published.
         *
         * Never fatal. The file is already saved and the row already exists;
         * a failed read must not turn a successful upload into an error.
         */
        let analysed = false
        if (mediaItem?.id) {
          try {
            const { runMediaProcessingPipeline } = await import('@/lib/media/process-pipeline')
            await runMediaProcessingPipeline({
              supabase,
              mediaItemId: mediaItem.id,
              runStages: ['thumbnail', 'transcription', 'ai'],
            })
            analysed = true
          } catch (error) {
            console.error('[upload-media] analysis after upload failed:', error)
          }
        }

        return {
          success: true,
          image_url: publicUrl,
          media_item_id: mediaItem?.id ?? null,
          file_name: fullName,
          file_type: contentType,
          size_kb: sizeKb,
          analysed,
          message: `${mediaType} saved to library (${sizeKb}KB).${tagList} URL: ${publicUrl}\n\n`
            + (analysed
              ? 'It has been read: call query_media with mode="analysis" and this media_item_id for the transcript and description.'
              : 'It could not be read just now — the file is safe. Ask again shortly, or say what is in it.')
            + '\n\nUse this URL with publish_to_social to include it in posts.',
        }
      } catch (err) {
        return userSafeError('upload-media', err, 'That upload did not finish. Nothing was saved — try again.')
      }
    },
  })
}
