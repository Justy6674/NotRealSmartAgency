import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

const CANVA_BASE_URL = 'https://api.canva.com/rest/v1'

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number; title_suffix: string }> = {
  instagram_post: { width: 1080, height: 1080, title_suffix: 'Instagram Post' },
  instagram_story: { width: 1080, height: 1920, title_suffix: 'Instagram Story' },
  facebook_post: { width: 1200, height: 630, title_suffix: 'Facebook Post' },
  linkedin_post: { width: 1200, height: 627, title_suffix: 'LinkedIn Post' },
  twitter_post: { width: 1600, height: 900, title_suffix: 'X Post' },
  tiktok_video: { width: 1080, height: 1920, title_suffix: 'TikTok Video' },
  youtube_thumbnail: { width: 1280, height: 720, title_suffix: 'YouTube Thumbnail' },
  presentation: { width: 1920, height: 1080, title_suffix: 'Presentation' },
  a4_document: { width: 595, height: 842, title_suffix: 'A4 Document' },
}

async function getCanvaApiKey(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  // User-specific key first (power users connect their own)
  const { data } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', userId)
    .eq('provider', 'canva')
    .single()

  const userKey = (data?.cached_data?.api_key as string) ?? null
  if (userKey) return userKey

  // Fall back to platform-wide key (included in subscription)
  return process.env.CANVA_API_KEY ?? null
}

export function createDesignGraphicTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Create a graphic design using Canva. Use for social media posts, stories, presentations, thumbnails, and documents. Describe what you want and pick a format.',
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          'What to design, e.g. "Instagram post announcing our new telehealth feature with modern, clean aesthetic"'
        ),
      format: z
        .enum([
          'instagram_post',
          'instagram_story',
          'facebook_post',
          'linkedin_post',
          'twitter_post',
          'tiktok_video',
          'youtube_thumbnail',
          'presentation',
          'a4_document',
        ])
        .describe('Design format/size'),
      brand_name: z
        .string()
        .optional()
        .describe('Brand name to include in the design'),
    }),
    execute: async ({ prompt, format, brand_name }) => {
      const apiKey = await getCanvaApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No Canva API key connected. To create designs, connect your Canva account: go to canva.com/developers to get an API key, then tell me and I\'ll save it for you.',
        }
      }

      const dims = FORMAT_DIMENSIONS[format]
      const designTitle = brand_name
        ? `${brand_name} — ${dims.title_suffix}`
        : dims.title_suffix

      try {
        // Step 1: Create the design
        const createRes = await fetch(`${CANVA_BASE_URL}/designs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            design_type: {
              type: 'custom',
              width: dims.width,
              height: dims.height,
            },
            title: designTitle,
          }),
        })

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          return {
            success: false,
            error: `Canva API error (${createRes.status}): ${err.message || err.code || 'Unknown error'}. Check your API key is valid.`,
          }
        }

        const createData = await createRes.json()
        const designId = createData.design?.id
        const editUrl = createData.design?.urls?.edit_url

        // Step 2: Try to get thumbnail
        let thumbnailUrl: string | null = null
        if (designId) {
          try {
            const thumbRes = await fetch(
              `${CANVA_BASE_URL}/designs/${designId}`,
              {
                headers: { Authorization: `Bearer ${apiKey}` },
              }
            )
            if (thumbRes.ok) {
              const thumbData = await thumbRes.json()
              thumbnailUrl = thumbData.design?.thumbnail?.url ?? null
            }
          } catch {
            // Thumbnail fetch is best-effort
          }
        }

        // Fetch brand name if not provided
        let resolvedBrandName = brand_name
        if (!resolvedBrandName) {
          const { data: brand } = await supabase
            .from('brands')
            .select('name')
            .eq('id', brandId)
            .single()
          resolvedBrandName = brand?.name ?? undefined
        }

        return {
          success: true,
          design_id: designId,
          edit_url: editUrl,
          thumbnail_url: thumbnailUrl,
          format,
          dimensions: `${dims.width}x${dims.height}`,
          title: designTitle,
          message: `I've created a ${dims.title_suffix} design${resolvedBrandName ? ` for ${resolvedBrandName}` : ''} in Canva. You can open and edit it here: ${editUrl}\n\nDesign prompt: "${prompt}"\n\nOnce you're happy with it, tell me to export it and I'll download it as a PNG, JPG, or PDF.`,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to create Canva design',
        }
      }
    },
  })
}

export function createExportDesignTool(
  supabase: SupabaseClient,
  userId: string
) {
  return tool({
    description:
      'Export a Canva design as an image or PDF. Use after creating a design with design_graphic to download the finished file.',
    inputSchema: z.object({
      design_id: z.string().describe('Canva design ID to export'),
      format: z
        .enum(['png', 'jpg', 'pdf'])
        .default('png')
        .describe('Export format — png for social media, pdf for documents'),
    }),
    execute: async ({ design_id, format }) => {
      const apiKey = await getCanvaApiKey(supabase, userId)

      if (!apiKey) {
        return {
          success: false,
          error:
            'No Canva API key connected. To export designs, connect your Canva account first.',
        }
      }

      try {
        // Step 1: Start the export
        const exportRes = await fetch(`${CANVA_BASE_URL}/exports`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            design_id,
            format: { type: format },
          }),
        })

        if (!exportRes.ok) {
          const err = await exportRes.json().catch(() => ({}))
          return {
            success: false,
            error: `Canva export error (${exportRes.status}): ${err.message || err.code || 'Unknown error'}`,
          }
        }

        const exportData = await exportRes.json()
        const exportId = exportData.export?.id

        if (!exportId) {
          return { success: false, error: 'No export ID returned from Canva' }
        }

        // Step 2: Poll for completion (max 30 seconds)
        const maxAttempts = 15
        const pollInterval = 2000

        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))

          const statusRes = await fetch(
            `${CANVA_BASE_URL}/exports/${exportId}`,
            {
              headers: { Authorization: `Bearer ${apiKey}` },
            }
          )

          if (!statusRes.ok) continue

          const statusData = await statusRes.json()
          const status = statusData.export?.status

          if (status === 'completed') {
            const downloadUrl =
              statusData.export?.urls?.[0]?.url ??
              statusData.export?.download_url

            return {
              success: true,
              export_id: exportId,
              design_id,
              format,
              download_url: downloadUrl,
              message: downloadUrl
                ? `Your design has been exported as ${format.toUpperCase()}. Download it here: ${downloadUrl}`
                : `Export completed but no download URL was returned. Export ID: ${exportId}`,
            }
          }

          if (status === 'failed') {
            return {
              success: false,
              error: 'Canva export failed. The design may be empty or corrupted.',
            }
          }
        }

        return {
          success: false,
          error:
            'Export is still processing after 30 seconds. Try again in a moment — the export ID is ' +
            exportId,
        }
      } catch (err) {
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to export Canva design',
        }
      }
    },
  })
}
