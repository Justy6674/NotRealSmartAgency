import { tool } from 'ai'
import { z } from 'zod/v3'

const PLATFORM_LIMITS: Record<string, { chars?: number; words?: number; label: string }> = {
  instagram_caption: { chars: 2200, label: 'Instagram Caption' },
  instagram_bio: { chars: 150, label: 'Instagram Bio' },
  facebook_post: { words: 500, label: 'Facebook Post (ideal)' },
  linkedin_post: { chars: 3000, label: 'LinkedIn Post' },
  tiktok_caption: { chars: 2200, label: 'TikTok Caption' },
  twitter_post: { chars: 280, label: 'X/Twitter Post' },
  meta_ad_primary: { chars: 125, label: 'Meta Ad Primary Text (ideal)' },
  meta_ad_primary_max: { chars: 255, label: 'Meta Ad Primary Text (max)' },
  meta_ad_headline: { chars: 40, label: 'Meta Ad Headline' },
  meta_ad_description: { chars: 30, label: 'Meta Ad Description' },
  google_ad_headline: { chars: 30, label: 'Google Ad Headline' },
  google_ad_description: { chars: 90, label: 'Google Ad Description' },
  meta_title: { chars: 60, label: 'Meta Title (SEO)' },
  meta_description: { chars: 160, label: 'Meta Description (SEO)' },
  email_subject: { chars: 60, label: 'Email Subject Line (ideal)' },
}

export const wordCount = tool({
  description:
    'Count words and characters in text, and check against platform-specific limits. Use this to verify content fits platform requirements before delivering.',
  inputSchema: z.object({
    text: z.string().describe('The text to analyse'),
    platform: z
      .string()
      .optional()
      .describe(
        `Platform to check limits against. Options: ${Object.keys(PLATFORM_LIMITS).join(', ')}`
      ),
  }),
  execute: async ({ text, platform }) => {
    const chars = text.length
    const words = text.split(/\s+/).filter(Boolean).length

    const result: Record<string, unknown> = { characters: chars, words }

    if (platform && PLATFORM_LIMITS[platform]) {
      const limit = PLATFORM_LIMITS[platform]
      result.platform = limit.label
      if (limit.chars) {
        result.character_limit = limit.chars
        result.within_limit = chars <= limit.chars
        result.remaining = limit.chars - chars
      }
      if (limit.words) {
        result.word_limit = limit.words
        result.within_limit = words <= limit.words
        result.remaining = limit.words - words
      }
    }

    return result
  },
})
