import { tool } from 'ai'
import { z } from 'zod/v3'
import { fetchMixpostMedia } from '@/lib/mixpost/client'

export function createBrowseMixpostMediaTool() {
  return tool({
    description:
      'Browse the media library in Mixpost — images, videos, and audio files uploaded for social publishing.',
    inputSchema: z.object({
      page: z.number().optional().default(1),
    }),
    execute: async ({ page }) => {
      const media = await fetchMixpostMedia(page)
      if (!media) return { success: false, error: 'Cannot reach Mixpost.' }
      if (media.length === 0) {
        return { success: true, message: 'No media found in Mixpost library.' }
      }

      const summary = media
        .map((m) => `- ${m.name} (${m.type}, ${m.mime_type})`)
        .join('\n')
      return {
        success: true,
        media,
        count: media.length,
        message: `${media.length} media items in Mixpost:\n${summary}`,
      }
    },
  })
}
