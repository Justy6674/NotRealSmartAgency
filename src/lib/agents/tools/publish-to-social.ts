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
      image_urls: z
        .array(z.string())
        .optional()
        .describe('Multiple image URLs for carousel posts (2-10 images). Each URL must be publicly accessible. Use this for multi-image carousels instead of image_url.'),
      schedule_date: z
        .string()
        .optional()
        .describe('Schedule date YYYY-MM-DD. Omit for immediate publish.'),
      schedule_time: z
        .string()
        .optional()
        .describe('Schedule time HH:mm (24hr AEST). Omit for immediate publish.'),
    }),
    execute: async ({ platforms, caption, hashtags, image_url, image_urls, schedule_date, schedule_time }) => {
      try {
        const base = process.env.MIXPOST_API_URL
        const token = process.env.MIXPOST_API_TOKEN
        const workspace = process.env.MIXPOST_WORKSPACE_UUID

        if (!base || !token) {
          return 'Publishing is not configured. MIXPOST_API_URL or MIXPOST_API_TOKEN is missing.'
        }

        const apiBase = workspace ? `${base}/api/${workspace}` : `${base}/api`

        // Fetch brand with compliance flags for Guardian check
        const { data: brand } = await supabase
          .from('brands')
          .select('name, slug, social_urls, compliance_flags')
          .eq('id', brandId)
          .single()

        if (!brand) {
          return `Cannot publish — brand not found (ID: ${brandId}). Make sure you selected the right brand.`
        }

        const brandName = brand.name
        const brandSlug = brand.slug

        // ── AHPRA/TGA Compliance Gate — runs BEFORE publishing ──
        const complianceFlags = brand?.compliance_flags ?? {}
        if (complianceFlags.ahpra || complianceFlags.tga) {
          try {
            const { runComplianceFilter } = await import('@/lib/agents/compliance-filter')
            const fullText = hashtags?.length
              ? `${caption}\n\n${hashtags.map((h: string) => `#${h}`).join(' ')}`
              : caption
            const check = await runComplianceFilter(
              fullText,
              complianceFlags,
              undefined
            )
            if (!check.isValid) {
              const issues = [
                ...check.flags.map((f: string) => `BLOCKED: ${f}`),
                ...check.brandVoiceIssues.map((v: string) => `BRAND VOICE: ${v}`),
              ].join('\n')
              return `COMPLIANCE CHECK FAILED — post NOT published.\n\n${issues}\n\nFix the content and try again. AHPRA/TGA penalties: up to $60,000 per offence.`
            }
            if (check.warnings.length > 0) {
              // Warnings are non-blocking but logged
              console.log(`[publish_to_social] Compliance warnings for ${brandSlug}:`, check.warnings)
            }
          } catch (err) {
            console.error('[publish_to_social] Compliance check error:', err)
            // Fail open for non-health brands, fail closed for health brands
            if (complianceFlags.ahpra) {
              return 'COMPLIANCE CHECK ERROR — post NOT published. The AHPRA compliance check failed to run. Cannot publish health content without compliance verification.'
            }
          }
        }

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

        // Upload media if provided — supports single image or carousel (multi-image)
        const allImageUrls = image_urls?.length ? image_urls : image_url ? [image_url] : []
        const mediaIds: number[] = []

        for (const url of allImageUrls) {
          try {
            let uploadedId: number | null = null

            // Method 1: Remote URL upload (preferred — no need to download first)
            const remoteRes = await fetch(`${apiBase}/media/remote/initiate`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url, alt_text: '' }),
            })
            if (remoteRes.ok) {
              const remoteData = await remoteRes.json()
              if (remoteData.status === 'completed' && remoteData.media?.id) {
                uploadedId = Number(remoteData.media.id)
              } else if (remoteData.id) {
                uploadedId = Number(remoteData.id)
              } else if (remoteData.data?.id) {
                uploadedId = Number(remoteData.data.id)
              }
            }

            // Method 2: Fallback to binary upload if remote failed
            if (!uploadedId) {
              const imgRes = await fetch(url)
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
                  uploadedId = Number(data.id ?? data.data?.id)
                }
              }
            }

            if (uploadedId) {
              mediaIds.push(uploadedId)
            }
            console.log(`[publish_to_social] Media upload: url=${url} | mediaId=${uploadedId}`)
          } catch (err) {
            console.error(`[publish_to_social] Media upload error for ${url}:`, err)
          }
        }

        const mediaId = mediaIds[0] ?? null
        if (allImageUrls.length > 0 && mediaIds.length === 0) {
          console.error('[publish_to_social] Failed to upload any media to Mixpost')
        }

        const isScheduled = !!(schedule_date && schedule_time)
        const results: string[] = []
        const postResults: Array<{ platform: string; externalId: string | null; success: boolean }> = []

        for (const platform of platforms) {
          const providers = providerMap[platform] ?? [platform]

          // Find account: STRICT brand-name match only — NEVER fall back to another brand's account
          const brandLower = brandName.toLowerCase()
          const slugLower = brandSlug.toLowerCase()

          // Safety: if brand name is empty, refuse to match (empty string matches everything)
          if (!brandLower) {
            results.push(`${platform}: Cannot match accounts — brand name is empty. This is a bug.`)
            continue
          }

          // Build all matching candidates for this provider
          const candidates = accounts.filter((a) => {
            if (!providers.includes(a.provider)) return false
            const n = (a.name || '').toLowerCase()
            const u = (a.username || '').toLowerCase()
            // Match brand name or slug in account name/username
            return n.includes(brandLower) || n.includes(slugLower) ||
                   u.includes(slugLower) || u.includes(brandLower.replace(/\s+/g, ''))
          })

          const account = candidates[0] ?? null

          console.log(`[publish_to_social] Brand: "${brandName}" (${brandSlug}) | Platform: ${platform} | Candidates: ${candidates.map(c => c.name).join(', ') || 'NONE'} | Selected: ${account?.name ?? 'NONE'}`)

          if (!account) {
            results.push(`${platform}: No ${brandName} account found in Mixpost. Available accounts for this platform: ${accounts.filter(a => providers.includes(a.provider)).map(a => a.name).join(', ')}`)
            postResults.push({ platform, externalId: null, success: false })
            continue
          }

          // Instagram REQUIRES an image — block text-only posts
          if (platform === 'instagram' && mediaIds.length === 0) {
            results.push(`Instagram: BLOCKED — Instagram requires an image. No image was provided or the image upload to Mixpost failed. Use generate_image or upload_media first, then try again with the image_url.`)
            postResults.push({ platform, externalId: null, success: false })
            continue
          }

          const postBody = {
            accounts: [account.id],
            versions: [{
              account_id: account.id,
              is_original: true,
              content: [{
                body: fullCaption,
                media: mediaIds.length > 0 ? mediaIds : [],
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
            const postData = await postRes.json().catch(() => ({}))
            const externalId = String(postData.data?.uuid ?? postData.uuid ?? postData.data?.id ?? postData.id ?? '')
            const label = platform.charAt(0).toUpperCase() + platform.slice(1)
            results.push(isScheduled
              ? `${label}: Scheduled for ${schedule_date} at ${schedule_time} AEST via ${account.name}`
              : `${label}: Publishing now via ${account.name}${mediaIds.length > 1 ? ` (carousel: ${mediaIds.length} images)` : mediaIds.length === 1 ? ' (with image)' : ''} (30-60 seconds to go live)`)
            postResults.push({ platform, externalId: externalId || null, success: true })
          } else {
            const errText = await postRes.text().catch(() => '')
            results.push(`${platform}: Failed (${postRes.status}) ${errText.slice(0, 100)}`)
            postResults.push({ platform, externalId: null, success: false })
          }
        }

        // Track in scheduled_posts table (include image_url + external_post_id)
        for (const pr of postResults) {
          try {
            await supabase.from('scheduled_posts').insert({
              user_id: userId,
              brand_id: brandId,
              platform: pr.platform,
              caption: fullCaption,
              hashtags: hashtags ?? [],
              status: isScheduled ? 'scheduled' : (pr.success ? 'publishing' : 'failed'),
              scheduled_at: isScheduled
                ? new Date(`${schedule_date}T${schedule_time}:00+10:00`).toISOString()
                : new Date().toISOString(),
              post_type: 'single',
              ...(image_url ? { image_url } : {}),
              ...(pr.externalId ? { external_post_id: pr.externalId } : {}),
              ...(!pr.success ? { error: `Failed to publish to ${pr.platform}` } : {}),
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
