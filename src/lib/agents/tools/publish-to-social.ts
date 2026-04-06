import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMixpostAccounts, uploadMediaFromUrl, createMixpostPost, resolveAccountIdsForPlatform } from '@/lib/mixpost/client'
import type { MixpostVersion, MixpostAccount } from '@/lib/mixpost/client'
import { getConfirmedAccountIds } from '@/lib/mixpost/brand-mapping'

/**
 * Publish content directly to social media platforms via Mixpost.
 * The user drops an image in chat and says "post this to Instagram" — this tool makes it happen.
 *
 * Supports immediate publishing or scheduling for a future date/time.
 * Resolves the correct Mixpost account for the brand + platform automatically.
 */
export function createPublishToSocialTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Publish a post to social media (Instagram, Facebook, LinkedIn, TikTok, YouTube, X). Can publish immediately or schedule for later. Use when the user says "post this", "publish to Instagram", "schedule this for tomorrow", or drops an image and asks you to post it. If the user provided an image in the conversation, use the image_url from Supabase Storage.',
    inputSchema: z.object({
      platforms: z
        .array(z.enum(['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter']))
        .describe('Which platforms to publish to'),
      caption: z.string().describe('The post caption/text'),
      hashtags: z
        .array(z.string())
        .optional()
        .describe('Hashtags to append (without # prefix)'),
      image_url: z
        .string()
        .optional()
        .describe('Public URL of an image to include (e.g. from Supabase Storage). Instagram REQUIRES an image.'),
      schedule_date: z
        .string()
        .optional()
        .describe('Schedule date in YYYY-MM-DD format. Omit to publish immediately.'),
      schedule_time: z
        .string()
        .optional()
        .describe('Schedule time in HH:mm format (24hr AEST). Omit to publish immediately.'),
    }),
    execute: async ({ platforms, caption, hashtags, image_url, schedule_date, schedule_time }) => {
      try {
      console.log('[publish_to_social] Starting for platforms:', platforms.join(', '))

      // Fetch the brand for name matching
      const { data: brand } = await supabase
        .from('brands')
        .select('id, name, slug, social_urls')
        .eq('id', brandId)
        .single()

      if (!brand) return 'Error: Brand not found.'

      // Fetch all Mixpost accounts
      console.log('[publish_to_social] Fetching Mixpost accounts...')
      let allAccounts: MixpostAccount[] | null = null
      try {
        allAccounts = await fetchMixpostAccounts()
      } catch (fetchErr) {
        console.error('[publish_to_social] fetchMixpostAccounts crashed:', fetchErr)
        return `Error fetching social accounts: ${fetchErr instanceof Error ? fetchErr.message : 'unknown'}`
      }
      if (!allAccounts?.length) {
        return 'Error: Could not connect to the publishing system. Check Mixpost configuration.'
      }
      console.log('[publish_to_social] Got', allAccounts.length, 'accounts')

      // Get confirmed account IDs if set, otherwise fuzzy-match by brand name
      const confirmedIds = getConfirmedAccountIds(brand)
      let brandAccounts: MixpostAccount[]
      if (confirmedIds.length) {
        brandAccounts = allAccounts.filter((a) => confirmedIds.includes(a.id))
      } else {
        // Fuzzy match: find accounts whose name contains the brand name (or vice versa)
        const brandLower = brand.name.toLowerCase()
        const slugLower = brand.slug.toLowerCase()
        brandAccounts = allAccounts.filter((a) => {
          const nameLower = (a.name || '').toLowerCase()
          const userLower = (a.username || '').toLowerCase()
          return nameLower.includes(brandLower) || brandLower.includes(nameLower) ||
                 nameLower.includes(slugLower) || userLower.includes(slugLower) ||
                 slugLower.includes(nameLower.replace(/[^a-z0-9]/g, ''))
        })
        // If no fuzzy match found, fall back to all accounts (better than nothing)
        if (!brandAccounts.length) brandAccounts = allAccounts
      }

      // Build full caption with hashtags
      const fullCaption = hashtags?.length
        ? `${caption}\n\n${hashtags.map((h) => `#${h}`).join(' ')}`
        : caption

      // Upload media if provided
      let mediaId: number | null = null
      if (image_url) {
        const uploaded = await uploadMediaFromUrl(image_url)
        if (uploaded) {
          mediaId = uploaded.id
        } else {
          // Try direct upload via the /media endpoint
          try {
            const base = process.env.MIXPOST_API_URL
            const token = process.env.MIXPOST_API_TOKEN
            const workspace = process.env.MIXPOST_WORKSPACE_UUID
            if (base && token && workspace) {
              const imgRes = await fetch(image_url)
              if (imgRes.ok) {
                const blob = await imgRes.blob()
                const formData = new FormData()
                formData.append('file', blob, 'upload.jpg')
                const uploadRes = await fetch(`${base}/api/${workspace}/media`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: formData,
                })
                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json()
                  mediaId = Number(uploadData.id ?? uploadData.data?.id)
                }
              }
            }
          } catch {
            // Non-blocking — post without media if upload fails
          }
        }
      }

      const isScheduled = schedule_date && schedule_time
      const results: string[] = []

      for (const platform of platforms) {
        // Find the Mixpost account for this platform
        const accountIds = resolveAccountIdsForPlatform(platform, brandAccounts)

        if (!accountIds.length) {
          results.push(`${platform}: No connected account found for ${brand.name}`)
          continue
        }

        const accountId = accountIds[0]
        const account = allAccounts.find((a) => a.id === accountId)

        if (!account) {
          results.push(`${platform}: Account not found in Mixpost`)
          continue
        }

        const version: MixpostVersion = {
          account_id: account.id,
          is_original: true,
          content: [
            {
              body: fullCaption,
              media: mediaId ? [mediaId] : [],
              url: null,
              video_thumbs: [],
            },
          ],
        }

        const post = await createMixpostPost({
          accounts: [account.id],
          versions: [version],
          date: schedule_date,
          time: schedule_time,
          timezone: 'Australia/Brisbane',
          schedule: isScheduled ? true : undefined,
          schedule_now: isScheduled ? undefined : true,
        })

        if (post) {
          if (isScheduled) {
            results.push(`${platform}: Scheduled for ${schedule_date} at ${schedule_time} AEST`)
          } else {
            results.push(`${platform}: Publishing now (may take 30-60 seconds to go live)`)
          }
        } else {
          results.push(`${platform}: Failed to create post — check publishing configuration`)
        }
      }

      // Also save to scheduled_posts table for tracking
      for (const platform of platforms) {
        await supabase.from('scheduled_posts').insert({
          user_id: userId,
          brand_id: brandId,
          platform,
          caption: fullCaption,
          hashtags: hashtags ?? [],
          status: isScheduled ? 'scheduled' : 'publishing',
          scheduled_at: isScheduled
            ? new Date(`${schedule_date}T${schedule_time}:00+10:00`).toISOString()
            : new Date().toISOString(),
          post_type: 'single',
        })
      }

      const summary = results.join('\n')
      return mediaId
        ? `Published with image:\n${summary}`
        : image_url
        ? `Published (image upload had issues — posted as text):\n${summary}`
        : `Published:\n${summary}`
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[publish_to_social] Error:', message)
        return `Publishing failed: ${message}. This might be a configuration issue — please try again or check the publishing settings.`
      }
    },
  })
}
