import { tool } from 'ai'
import { z } from 'zod/v3'
import { gateway } from '@ai-sdk/gateway'
import { experimental_generateImage as generateImage } from 'ai'

export function createGenerateImageTool() {
  return tool({
    description:
      'Generate a marketing image using AI. Use for social media posts, blog headers, ad creatives, and brand assets. Describe what you want clearly — style, composition, colours, mood.',
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
          const sizeBytes = imageData.uint8Array?.length ?? imageData.base64?.length ?? 0

          return {
            generated: true,
            sizeBytes,
            prompt,
            aspectRatio,
            message: `Image generated (${aspectRatio}, ${Math.round(sizeBytes / 1024)}KB). The image has been created based on your description.`,
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
