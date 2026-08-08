import { tool } from 'ai'
import { stampLogo } from '@/lib/media/brand-stamp'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import { experimental_generateImage as generateImage } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * gpt-image-1 offers three shapes, so the five ratios map onto the nearest.
 *
 * 4:3 and 3:4 have no exact match and take the square rather than a landscape
 * or portrait that is visibly wrong for the platform they were asked for.
 */
const SIZE_FOR_RATIO: Record<'1:1' | '16:9' | '9:16' | '4:3' | '3:4', `${number}x${number}`> = {
  '1:1': '1024x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
  '4:3': '1024x1024',
  '3:4': '1024x1024',
}

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
          // `size`, NOT `aspectRatio`. The Gateway answers this model with
          // "The feature \"aspectRatio\" is not supported. This model does not
          // support aspect ratio. Use `size` instead." — a warning that has
          // been in the logs since 24 March. The ratio was silently dropped
          // and OpenAI chose the shape itself, so 7 of the first 32 images
          // came out wrong: a 1:1 Instagram request returned 1536x1024
          // landscape, a 9:16 Stories request returned a square.
          size: SIZE_FOR_RATIO[aspectRatio],
          providerOptions: {
            // 'medium' is load-bearing on cost, not just quality: the same
            // image at 'high' is $0.167 instead of $0.042 — four times more.
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

          // Put the brand's real logo on it. The prompt tells the model not to
          // draw one — an invented logo on a live account is worse than none —
          // so the actual file is composited here instead. Every image made
          // before this went out unbranded.
          let branded = false
          const { data: brandRow } = await supabase
            .from('brands')
            .select('logo_url')
            .eq('id', brandId)
            .maybeSingle()

          if (brandRow?.logo_url) {
            try {
              const logoRes = await fetch(brandRow.logo_url as string)
              if (logoRes.ok) {
                const stamped = await stampLogo(buffer, Buffer.from(await logoRes.arrayBuffer()))
                if (stamped.length !== buffer.length) {
                  buffer = stamped
                  branded = true
                }
              }
            } catch {
              // An unreachable logo costs the branding, never the image.
            }
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
                branded,
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
