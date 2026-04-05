import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getHeyGenApiKey,
  fetchTalkingPhotos,
  uploadTalkingPhoto,
} from '@/lib/heygen/client'

export function createListTalkingPhotosTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'List all available talking photos in your HeyGen account. Talking photos are static images that can be animated to speak — great for personalised brand messaging without needing a full avatar video.',
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
        const photos = await fetchTalkingPhotos(apiKey)

        if (photos.length === 0) {
          return {
            success: true,
            photos: [],
            message:
              'No talking photos found in your HeyGen account. Upload a photo using the upload_talking_photo tool to get started.',
          }
        }

        return {
          success: true,
          photos,
          count: photos.length,
          message: `Found ${photos.length} talking photo(s) in your HeyGen account. You can use any of these IDs when creating talking-head videos.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to fetch talking photos from HeyGen',
        }
      }
    },
  })
}

export function createUploadTalkingPhotoTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Upload a photo to HeyGen as a "talking photo" — the photo will be animated to speak when used in videos. The image should be a clear, front-facing portrait with good lighting.',
    inputSchema: z.object({
      image_url: z
        .string()
        .url()
        .describe(
          'Public URL of the image to upload as a talking photo — must be a clear, front-facing portrait'
        ),
    }),
    execute: async ({ image_url }) => {
      const apiKey = await getHeyGenApiKey(supabase, userId)
      if (!apiKey) {
        return {
          success: false,
          error:
            'No HeyGen API key connected. Get one from app.heygen.com/settings/api, then tell me and I\'ll save it for you.',
        }
      }

      try {
        const result = await uploadTalkingPhoto(apiKey, image_url)

        if (!result) {
          return {
            success: false,
            error:
              'Failed to upload talking photo. Ensure the image URL is publicly accessible and shows a clear, front-facing portrait.',
          }
        }

        return {
          success: true,
          talking_photo_id: result.talking_photo_id,
          message: `Talking photo uploaded successfully. ID: ${result.talking_photo_id}. You can now use this ID when creating talking-head videos.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to upload talking photo to HeyGen',
        }
      }
    },
  })
}
