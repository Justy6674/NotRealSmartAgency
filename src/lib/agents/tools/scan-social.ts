import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok'

const PLATFORM_BASE_URLS: Record<Platform, string> = {
  instagram: 'https://www.instagram.com',
  facebook: 'https://www.facebook.com',
  linkedin: 'https://www.linkedin.com/company',
  twitter: 'https://twitter.com',
  tiktok: 'https://www.tiktok.com/@',
}

async function checkUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; NRSAgencyBot/1.0; +https://notrealsmart.com.au)',
      },
    })
    return response.status === 200 || response.status === 301 || response.status === 302
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export function createScanSocialTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Check a brand\'s social media presence across Instagram, Facebook, LinkedIn, Twitter/X, and TikTok. Use this when you need to understand where a brand currently shows up online, before making social media strategy recommendations. If the user has not provided specific URLs, guesses will be made from the brand name.',
    inputSchema: z.object({
      brand_name: z
        .string()
        .describe('The brand or business name, used to guess social handles if no URLs are provided'),
      urls: z
        .object({
          instagram: z.string().optional().describe('Full Instagram profile URL'),
          facebook: z.string().optional().describe('Full Facebook page URL'),
          linkedin: z.string().optional().describe('Full LinkedIn company page URL'),
          twitter: z.string().optional().describe('Full Twitter/X profile URL'),
          tiktok: z.string().optional().describe('Full TikTok profile URL'),
        })
        .optional()
        .describe('Known social media URLs for the brand. Any omitted platforms will be guessed from the brand name.'),
    }),
    execute: async ({ brand_name, urls }) => {
      // Normalise brand name to a slug-like handle (lowercase, no spaces)
      const handle = brand_name.toLowerCase().replace(/[^a-z0-9]/g, '')

      const platforms: Platform[] = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok']

      // Build the candidate URL for each platform
      const candidates: Record<Platform, string> = {
        instagram: urls?.instagram ?? `${PLATFORM_BASE_URLS.instagram}/${handle}`,
        facebook: urls?.facebook ?? `${PLATFORM_BASE_URLS.facebook}/${handle}`,
        linkedin: urls?.linkedin ?? `${PLATFORM_BASE_URLS.linkedin}/${handle}`,
        twitter: urls?.twitter ?? `${PLATFORM_BASE_URLS.twitter}/${handle}`,
        tiktok: urls?.tiktok ?? `${PLATFORM_BASE_URLS.tiktok}${handle}`,
      }

      // Check all platforms in parallel
      const checks = await Promise.allSettled(
        platforms.map(async (platform) => {
          const url = candidates[platform]
          const found = await checkUrl(url)
          return { platform, found, url }
        })
      )

      const presence = Object.fromEntries(
        checks.map((result) => {
          if (result.status === 'fulfilled') {
            const { platform, found, url } = result.value
            return [platform, { found, url: found ? url : null, checked_url: url }]
          }
          return [result.reason as string, { found: false, url: null, checked_url: null }]
        })
      ) as Record<Platform, { found: boolean; url: string | null; checked_url: string | null }>

      const results = {
        brand_name,
        handle_guessed: handle,
        presence,
        urls_provided: !!urls,
      }

      await supabase.from('project_scans').insert({
        brand_id: brandId,
        user_id: userId,
        scan_type: 'social',
        status: 'completed',
        results,
        error: null,
      })

      return results
    },
  })
}
