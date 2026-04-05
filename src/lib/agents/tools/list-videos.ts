import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getHeyGenApiKey, fetchVideos, getVideoShareUrl } from '@/lib/heygen/client'

export function createListHeyGenVideosTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List all generated videos in your HeyGen account — shows video IDs, titles, statuses, thumbnail URLs, and video URLs. Useful for checking on past video generations or finding content to repurpose.',
    inputSchema: z.object({}),
    execute: async () => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const videos = await fetchVideos(apiKey)

        if (videos.length === 0) {
          return {
            success: true,
            videos: [],
            message:
              'No videos found in your HeyGen account. Create one using the create_video or generate_video_agent tools.',
          }
        }

        return {
          success: true,
          videos,
          count: videos.length,
          message: `Found ${videos.length} video(s) in your HeyGen account.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to fetch videos from HeyGen',
        }
      }
    },
  })
}

export function createGetVideoShareUrlTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Get a shareable public URL for a HeyGen video. Use this to share a generated video with clients, embed it on a website, or post it on social media.',
    inputSchema: z.object({
      video_id: z
        .string()
        .describe('The HeyGen video ID to get a shareable URL for'),
    }),
    execute: async ({ video_id }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const url = await getVideoShareUrl(apiKey, video_id)

        if (!url) {
          return {
            success: false,
            error:
              'Could not get shareable URL. The video may still be processing or the ID may be incorrect.',
          }
        }

        return {
          success: true,
          video_id,
          share_url: url,
          message: `Here's your shareable video link: ${url}`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to get video share URL from HeyGen',
        }
      }
    },
  })
}
