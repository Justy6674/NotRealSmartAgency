import { tool } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import { experimental_generateImage as generateImage } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createGenerateImageTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Generate a marketing image using AI. Use for social media posts, blog headers, ad creatives, and brand assets. Describe what you want clearly — style, composition, colours, mood. The image is saved to the media library automatically.',
    inputSchema: z.object({
      prompt: z.string().describe('Detailed image description. Include: subject, style, colours, mood, composition. E.g., "Professional photo of a modern telehealth consultation, warm lighting, Australian clinic setting, clean and minimal"'),
      aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('1:1').describe('Aspect ratio — 1:1 for Instagram/social, 16:9 for blog/website, 9:16 for Stories/Reels'),
    }),
    execute: async ({ prompt, aspectRatio }) => {
      try {
        const result = await generateImage({
          model: gateway.image('openai/gpt-image-1'),
          prompt,
          aspectRatio,
          providerOptions: {
            openai: { quality: 'medium' },
          },
        })

        if (result.image) {
          const imageData = result.image as { uint8Array?: Uint8Array; base64?: string }

          // Convert to buffer for storage upload
          let buffer: Buffer
          if (imageData.uint8Array) {
            buffer = Buffer.from(imageData.uint8Array)
          } else if (imageData.base64) {
            buffer = Buffer.from(imageData.base64, 'base64')
          } else {
            return { generated: true, message: 'Image generated but could not be saved — no image data available.' }
          }

          const sizeBytes = buffer.length

          // Upload to Supabase Storage
          const fileName = `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
          const storagePath = `${userId}/${brandId}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(storagePath, buffer, {
              contentType: 'image/png',
              upsert: false,
            })

          if (uploadError) {
            console.error('[generate-image] Storage upload failed:', uploadError.message)
            return {
              generated: true,
              sizeBytes,
              prompt,
              aspectRatio,
              message: `Image generated (${aspectRatio}, ${Math.round(sizeBytes / 1024)}KB) but failed to save to storage: ${uploadError.message}`,
            }
          }

          // Get public URL
          const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)
          const publicUrl = urlData.publicUrl

          // Create media_items record
          const { data: mediaItem, error: mediaError } = await supabase
            .from('media_items')
            .insert({
              user_id: userId,
              brand_id: brandId,
              file_url: publicUrl,
              file_name: fileName,
              file_type: 'image/png',
              file_size_bytes: sizeBytes,

              metadata: {
                generated_by: 'generate_image',
                prompt,
                aspect_ratio: aspectRatio,
              },
            })
            .select('id')
            .single()

          if (mediaError) {
            console.error('[generate-image] media_items insert failed:', mediaError.message)
          }

          return {
            generated: true,
            sizeBytes,
            prompt,
            aspectRatio,
            image_url: publicUrl,
            media_item_id: mediaItem?.id ?? null,
            message: `Image generated (${aspectRatio}, ${Math.round(sizeBytes / 1024)}KB) and saved to your media library. URL: ${publicUrl}`,
          }
        }

        return { generated: false, error: 'No image returned from model' }
      } catch (err) {
        return {
          generated: false,
          error: err instanceof Error ? err.message : 'Image generation failed',
          prompt,
        }
      }
    },
  })
}
