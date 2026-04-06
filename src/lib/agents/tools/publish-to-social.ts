import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Publish content directly to social media platforms via Mixpost.
 * Minimal, self-contained — no external imports that could crash in AI SDK tool context.
 */
export function createPublishToSocialTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Publish a post to social media (Instagram, Facebook, LinkedIn, TikTok, YouTube, X). Can publish immediately or schedule for later. Use when the user says "post this", "publish to Instagram", "schedule this for tomorrow", or drops an image and asks you to post it.',
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
        .describe('Public URL of an image to include. Instagram REQUIRES an image.'),
      schedule_date: z
        .string()
        .optional()
        .describe('Schedule date YYYY-MM-DD. Omit for immediate publish.'),
      schedule_time: z
        .string()
        .optional()
        .describe('Schedule time HH:mm (24hr AEST). Omit for immediate publish.'),
    }),
    execute: async ({ platforms, caption, hashtags, image_url, schedule_date, schedule_time }) => {
      try {
        const base = process.env.MIXPOST_API_URL
        const token = process.env.MIXPOST_API_TOKEN
        const workspace = process.env.MIXPOST_WORKSPACE_UUID

        if (!base || !token) {
          return 'Publishing is not configured. MIXPOST_API_URL or MIXPOST_API_TOKEN is missing.'
        }

        const apiBase = workspace ? `${base}/api/${workspace}` : `${base}/api`

        // Fetch brand name for account matching
        const { data: brand } = await supabase
          .from('brands')
          .select('name, slug, social_urls')
          .eq('id', brandId)
          .single()

        const brandName = brand?.name ?? ''
        const brandSlug = brand?.slug ?? ''

        // Fetch all Mixpost accounts
        const accountsRes = await fetch(`${apiBase}/accounts`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        })

        if (!accountsRes.ok) {
          return `Failed to fetch social accounts (${accountsRes.status}). Check Mixpost configuration.`
        }

        const accountsRaw = await accountsRes.json()
        const accounts: Array<{ id: number; name: string; username: string | null; provider: string }> =
          Array.isArray(accountsRaw) ? accountsRaw : accountsRaw.data ?? []

        if (!accounts.length) {
          return 'No social accounts connected. Connect your accounts in Mixpost first.'
        }

        // Platform → provider mapping
        const providerMap: Record<string, string[]> = {
          instagram: ['instagram'],
          facebook: ['facebook_page', 'facebook_group'],
          linkedin: ['linkedin', 'linkedin_page'],
          twitter: ['x', 'twitter'],
          tiktok: ['tiktok'],
          youtube: ['youtube'],
        }

        // Build full caption
        const fullCaption = hashtags?.length
          ? `${caption}\n\n${hashtags.map((h) => `#${h}`).join(' ')}`
          : caption

        // Upload media if provided
        let mediaId: number | null = null
        if (image_url) {
          try {
            const imgRes = await fetch(image_url)
            if (imgRes.ok) {
              const blob = await imgRes.blob()
              const formData = new FormData()
              formData.append('file', blob, 'upload.jpg')
              const uploadRes = await fetch(`${apiBase}/media`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
              })
              if (uploadRes.ok) {
                const data = await uploadRes.json()
                mediaId = Number(data.id ?? data.data?.id)
              }
            }
          } catch {
            // Continue without media
          }
        }

        const isScheduled = !!(schedule_date && schedule_time)
        const results: string[] = []

        for (const platform of platforms) {
          const providers = providerMap[platform] ?? [platform]

          // Find account: prefer brand-name match, fall back to first match
          const brandLower = brandName.toLowerCase()
          const slugLower = brandSlug.toLowerCase()
          let account = accounts.find((a) => {
            if (!providers.includes(a.provider)) return false
            const n = (a.name || '').toLowerCase()
            const u = (a.username || '').toLowerCase()
            return n.includes(brandLower) || n.includes(slugLower) ||
                   u.includes(slugLower) || brandLower.includes(n.replace(/[^a-z0-9]/g, ''))
          })

          // Fall back to any account on this provider
          if (!account) {
            account = accounts.find((a) => providers.includes(a.provider))
          }

          if (!account) {
            results.push(`${platform}: No connected account found`)
            continue
          }

          const postBody = {
            accounts: [account.id],
            versions: [{
              account_id: account.id,
              is_original: true,
              content: [{
                body: fullCaption,
                media: mediaId ? [mediaId] : [],
                url: null,
                video_thumbs: [] as never[],
              }],
            }],
            ...(isScheduled
              ? { date: schedule_date, time: schedule_time, timezone: 'Australia/Brisbane', schedule: true }
              : { schedule_now: true }),
          }

          const postRes = await fetch(`${apiBase}/posts`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(postBody),
          })

          if (postRes.ok) {
            const label = platform.charAt(0).toUpperCase() + platform.slice(1)
            results.push(isScheduled
              ? `${label}: Scheduled for ${schedule_date} at ${schedule_time} AEST via ${account.name}`
              : `${label}: Publishing now via ${account.name} (30-60 seconds to go live)`)
          } else {
            const errText = await postRes.text().catch(() => '')
            results.push(`${platform}: Failed (${postRes.status}) ${errText.slice(0, 100)}`)
          }
        }

        // Track in scheduled_posts table
        for (const platform of platforms) {
          try {
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
          } catch {
            // Non-blocking
          }
        }

        return results.join('\n')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[publish_to_social] Error:', msg)
        return `Publishing failed: ${msg}`
      }
    },
  })
}
