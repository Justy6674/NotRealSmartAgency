import { tool } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import { experimental_generateImage as generateImage } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Image Remix Tool ────────────────────────────────────────────────────────
//
// Takes an existing media_item and generates a new image inspired by it,
// applying the user's natural-language instructions (background swap, crop
// for Stories, add brand colours, etc.). The new image is saved as a fresh
// media_item linked back to the original via metadata.remix_source_id.

export function createRemixImageTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Remix an existing image from the media library. Provide natural-language instructions like "change background to beach sunset", "add brand colours overlay", or "crop for Instagram story". Generates a new image inspired by the original and saves it to the media library.',
    inputSchema: z.object({
      media_item_id: z.string().describe('The media_item ID of the source image to remix'),
      instructions: z.string().describe('Natural-language remix instructions — what to change, add, or transform'),
      aspect_ratio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('1:1').describe('Aspect ratio for the remixed image'),
    }),
    execute: async ({ media_item_id, instructions, aspect_ratio }) => {
      try {
        // Fetch the source media item
        const { data: mediaItem, error: fetchErr } = await supabase
          .from('media_items')
          .select('id, file_url, file_name, file_type, ai_description, metadata, tags')
          .eq('id', media_item_id)
          .eq('user_id', userId)
          .single()

        if (fetchErr || !mediaItem) {
          return { success: false, error: `Could not find media item ${media_item_id}: ${fetchErr?.message ?? 'not found'}` }
        }

        // Ensure it's an image
        const fileType = mediaItem.file_type as string
        if (!fileType.startsWith('image/')) {
          return { success: false, error: `Media item is ${fileType} — remix only works with images.` }
        }

        // Build the generation prompt from original context + instructions
        const originalDescription = (mediaItem.ai_description as string) ?? 'a marketing image'
        const originalTags = (mediaItem.tags as string[]) ?? []

        const prompt = buildRemixPrompt(originalDescription, originalTags, instructions)

        // Generate new image via OpenAI
        const result = await generateImage({
          model: gateway.image('openai/gpt-image-1'),
          prompt,
          aspectRatio: aspect_ratio,
          providerOptions: {
            openai: { quality: 'medium' },
          },
        })

        if (!result.image) {
          return { success: false, error: 'Image generation returned no result.' }
        }

        const imageData = result.image as { uint8Array?: Uint8Array; base64?: string }

        let buffer: Buffer
        if (imageData.uint8Array) {
          buffer = Buffer.from(imageData.uint8Array)
        } else if (imageData.base64) {
          buffer = Buffer.from(imageData.base64, 'base64')
        } else {
          return { success: false, error: 'Image generated but no data available to save.' }
        }

        const sizeBytes = buffer.length

        // Upload to Supabase Storage
        const fileName = `remix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
        const storagePath = `${userId}/${brandId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(storagePath, buffer, {
            contentType: 'image/png',
            upsert: false,
          })

        if (uploadError) {
          return { success: false, error: `Storage upload failed: ${uploadError.message}` }
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(storagePath)

        const fileUrl = urlData.publicUrl

        // Create media_item record
        const { data: newItem, error: insertErr } = await supabase
          .from('media_items')
          .insert({
            user_id: userId,
            brand_id: brandId,
            file_url: fileUrl,
            file_name: fileName,
            file_type: 'image/png',
            file_size_bytes: sizeBytes,
            source_type: 'generated',
            ai_description: `Remixed from "${(mediaItem.file_name as string)}": ${instructions}`,
            tags: [...originalTags, 'remix'],
            metadata: {
              remix_source_id: media_item_id,
              remix_instructions: instructions,
              remix_aspect_ratio: aspect_ratio,
              original_description: originalDescription,
            },
          })
          .select('id')
          .single()

        if (insertErr) {
          return {
            success: true,
            file_url: fileUrl,
            error_note: `Image uploaded but media_item record failed: ${insertErr.message}`,
          }
        }

        return {
          success: true,
          media_item_id: newItem?.id,
          file_url: fileUrl,
          file_name: fileName,
          size_bytes: sizeBytes,
          source_media_item_id: media_item_id,
          message: `Image remixed successfully. New image saved to media library (${Math.round(sizeBytes / 1024)} KB). Instructions applied: "${instructions}".`,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { success: false, error: message }
      }
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRemixPrompt(
  originalDescription: string,
  tags: string[],
  instructions: string,
): string {
  const parts = [
    'Create a professional marketing image based on the following original image and remix instructions.',
    '',
    `ORIGINAL IMAGE: ${originalDescription}`,
  ]

  if (tags.length > 0) {
    parts.push(`TAGS: ${tags.join(', ')}`)
  }

  parts.push(
    '',
    `REMIX INSTRUCTIONS: ${instructions}`,
    '',
    'Keep the core subject matter and brand feel from the original, but apply the requested changes.',
    'Produce a clean, high-quality result suitable for social media marketing.',
  )

  return parts.join('\n')
}
