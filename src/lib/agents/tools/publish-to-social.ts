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
      'Publish a post to social media (Instagram, Facebook, LinkedIn, TikTok, YouTube, X). Supports images AND videos. Can publish immediately or schedule for later. For videos, pass media_ids (UUIDs of rows in the media library) — do NOT pass raw video URLs. For quick image-only posts you can still use image_url/image_urls. Use when the user says "post this", "publish to Instagram", "upload to YouTube", or drops media and asks you to post it.',
    inputSchema: z.object({
      platforms: z
        .array(z.enum(['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter']))
        .describe('Which platforms to publish to'),
      caption: z.string().describe('The post caption/text'),
      hashtags: z
        .array(z.string())
        .optional()
        .describe('Hashtags to append (without # prefix)'),
      media_ids: z
        .array(z.string().uuid())
        .optional()
        .describe(
          "UUIDs of media_items rows to attach. Use this for videos from uploads or query_media — the tool looks up file_url, mime type, and thumbnail. For Instagram Reels, YouTube Shorts, TikTok, always use media_ids. For carousels of uploaded images, use media_ids instead of image_urls.",
        ),
      image_url: z
        .string()
        .optional()
        .describe('Public URL of an image to include. Prefer media_ids where possible. Instagram photo posts require an image.'),
      image_urls: z
        .array(z.string())
        .optional()
        .describe('Multiple image URLs for carousel posts (2-10 images). Each URL must be publicly accessible. Prefer media_ids.'),
      schedule_date: z
        .string()
        .optional()
        .describe('Schedule date YYYY-MM-DD. Omit for immediate publish.'),
      schedule_time: z
        .string()
        .optional()
        .describe('Schedule time HH:mm (24hr AEST). Omit for immediate publish.'),
    }),
    execute: async ({ platforms, caption, hashtags, media_ids, image_url, image_urls, schedule_date, schedule_time }) => {
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
            // A regulated brand may not publish on a review that did not run.
            // The filter catches its own failures and returns a default-valid
            // result, so the outer catch below never fires for that case — this
            // flag is the only signal that the check was skipped, and it covers
            // TGA as well as AHPRA (DownscaleDerm is TGA-only).
            if (!check.checkCompleted && (complianceFlags.ahpra || complianceFlags.tga)) {
              const regime = [complianceFlags.ahpra ? 'AHPRA' : null, complianceFlags.tga ? 'TGA' : null]
                .filter(Boolean)
                .join('/')
              return `COMPLIANCE CHECK DID NOT RUN — post NOT published.\n\nThe ${regime} review could not be completed, so this content is unverified. Regulated content is never published without a completed review. Try again shortly; if it keeps failing, the compliance model is unreachable.`
            }
            if (check.warnings.length > 0) {
              // Warnings are non-blocking but logged
              console.log(`[publish_to_social] Compliance warnings for ${brandSlug}:`, check.warnings)
            }
          } catch (err) {
            // Reached only if the filter itself throws — importing it, or a
            // caller-side fault. Regulated brands still fail closed.
            console.error('[publish_to_social] Compliance check error:', err)
            if (complianceFlags.ahpra || complianceFlags.tga) {
              return 'COMPLIANCE CHECK ERROR — post NOT published. The compliance check failed to run, and regulated content cannot be published without verification.'
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

        // ─── Resolve media items ──────────────────────────────────────────────
        // Three input sources, in priority order:
        //   1. media_ids — look up from our media_items table (supports video + image, carousels)
        //   2. image_urls — multi-image carousel from raw URLs
        //   3. image_url — single image from raw URL
        //
        // For each item we build a normalised descriptor with file_url, mime,
        // file name, thumbnail_url, AND (if previously uploaded) a cached
        // Mixpost media id so we can skip the slow remote-initiate round-trip
        // on subsequent publishes. Mixpost's video transcode takes ~6 minutes
        // for a 141MB .mov — once is enough.
        interface MediaDescriptor {
          url: string
          mime: string
          fileName: string
          thumbnailUrl: string | null
          mediaItemId: string | null // our UUID, for scheduled_posts.media_item_ids
          mixpostMediaId: number | null // cached Mixpost numeric id (skip re-upload)
        }

        const allMedia: MediaDescriptor[] = []

        if (media_ids?.length) {
          const { data: items } = await supabase
            .from('media_items')
            .select('id, file_url, file_name, file_type, thumbnail_url, mixpost_media_id')
            .in('id', media_ids)
            .eq('brand_id', brandId)

          const foundIds = new Set((items ?? []).map((i) => i.id))
          const missingIds = media_ids.filter((id) => !foundIds.has(id))

          // FAIL LOUDLY — if any media_id can't be found, refuse to publish.
          // Silent fallback to text-only posts was a real bug: Director hallucinated
          // a media_id, lookup returned nothing, and a text-only post went live
          // instead of the expected video. Never again.
          if (missingIds.length > 0) {
            return `BLOCKED — cannot publish. The following media_ids were not found in ${brandName}'s media library: ${missingIds.join(', ')}\n\nCall query_media first to get the real UUIDs (look for the "ID:" field in the output), then retry with those exact IDs. Do NOT guess or reuse any other UUID (like brand_id).`
          }

          if (items) {
            // Preserve caller order
            for (const id of media_ids) {
              const item = items.find((m) => m.id === id)
              if (item) {
                allMedia.push({
                  url: item.file_url,
                  mime: item.file_type ?? 'application/octet-stream',
                  fileName: item.file_name ?? 'upload.bin',
                  thumbnailUrl: item.thumbnail_url ?? null,
                  mediaItemId: item.id,
                  mixpostMediaId: (item as Record<string, unknown>).mixpost_media_id as number | null ?? null,
                })
              }
            }
          }
        }

        // Legacy path: raw image URLs (backward compat)
        const legacyUrls = image_urls?.length ? image_urls : image_url ? [image_url] : []
        for (const url of legacyUrls) {
          allMedia.push({
            url,
            mime: 'image/jpeg',
            fileName: 'upload.jpg',
            thumbnailUrl: null,
            mediaItemId: null,
            mixpostMediaId: null,
          })
        }

        const hasVideo = allMedia.some((m) => m.mime.startsWith('video/'))

        // Upload each item to Mixpost. Collects failures so we can return
        // a precise BLOCKED message instead of silently publishing text-only.
        const mixpostMediaIds: number[] = []
        const videoThumbs: string[] = []
        const uploadErrors: string[] = []

        /**
         * Poll Mixpost's download-status endpoint until the remote fetch completes.
         * Returns the media id + uuid, or null on failure/timeout.
         *
         * Default 500s — Mixpost's two-pass libx264 transcode of a 141MB MJPEG
         * .mov takes ~380s. 500s gives headroom for larger files. The outer
         * Vercel maxDuration on the MCP route is 600s.
         */
        async function pollRemoteDownload(
          downloadId: string,
          maxSeconds = 500,
        ): Promise<{ id: number; uuid: string | null } | null> {
          const started = Date.now()
          const statusUrl = `${apiBase}/media/remote/${downloadId}/status`
          while (Date.now() - started < maxSeconds * 1000) {
            await new Promise((r) => setTimeout(r, 3000))
            try {
              const r = await fetch(statusUrl, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              })
              if (!r.ok) continue
              const d = await r.json()
              if (d.status === 'completed') {
                // Completed payloads can carry the new media in several shapes
                const id = d.media?.id ?? d.id ?? d.data?.id
                const uuid = d.media?.uuid ?? d.uuid ?? d.data?.uuid ?? null
                return id ? { id: Number(id), uuid } : null
              }
              if (d.status === 'failed') {
                uploadErrors.push(`Mixpost remote download failed for ${downloadId}: ${d.error ?? 'unknown'}`)
                return null
              }
              // else pending/downloading/processing — keep polling
            } catch {
              /* transient, keep polling */
            }
          }
          uploadErrors.push(`Mixpost remote download timed out for ${downloadId} after ${maxSeconds}s`)
          return null
        }

        for (const item of allMedia) {
          try {
            let uploadedId: number | null = null
            let uploadedUuid: string | null = null

            // ─── Cache hit: media already transcoded + living in Mixpost ──
            // Mixpost's video transcode takes ~6 minutes per video. We cache
            // the returned id on the media_items row so subsequent publishes
            // skip the whole remote-initiate + poll chain entirely.
            if (item.mixpostMediaId) {
              uploadedId = item.mixpostMediaId
              console.log(`[publish_to_social] Mixpost cache hit for ${item.fileName}: media_id=${uploadedId}`)
              mixpostMediaIds.push(uploadedId)
              if (item.mime.startsWith('video/') && item.thumbnailUrl) {
                videoThumbs.push(item.thumbnailUrl)
              }
              continue
            }

            // Method 1: Remote URL upload (preferred — Mixpost pulls from our Supabase URL).
            // Mixpost's /media/remote/initiate is ASYNC — it returns
            // { download_id, status: 'pending' } for larger files. We MUST poll
            // /media/remote/{download_id}/status until completed or failed. The
            // previous implementation only handled synchronous responses and
            // silently proceeded to publish text-only when Mixpost was still
            // downloading — real bug that produced text-only Facebook posts.
            const remoteRes = await fetch(`${apiBase}/media/remote/initiate`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url: item.url, alt_text: '' }),
            })
            if (remoteRes.ok) {
              const remoteData = await remoteRes.json()
              // Fast path: already completed (small images)
              if (remoteData.status === 'completed') {
                const id = Number(remoteData.media?.id ?? remoteData.id ?? remoteData.data?.id ?? NaN)
                uploadedId = Number.isFinite(id) ? id : null
                uploadedUuid = remoteData.media?.uuid ?? remoteData.uuid ?? remoteData.data?.uuid ?? null
              } else if (remoteData.status === 'pending' && remoteData.download_id) {
                // Slow path: poll until done (videos)
                const result = await pollRemoteDownload(String(remoteData.download_id))
                if (result) {
                  uploadedId = result.id
                  uploadedUuid = result.uuid
                }
              } else if (remoteData.status === 'failed') {
                uploadErrors.push(`Mixpost remote initiate failed: ${remoteData.error ?? 'unknown'}`)
              }
            } else {
              const errText = await remoteRes.text().catch(() => '')
              uploadErrors.push(`Mixpost remote initiate HTTP ${remoteRes.status}: ${errText.slice(0, 200)}`)
            }

            // Method 2: Fallback to binary upload (for images only — videos
            // would exhaust Vercel memory on a 148MB file). Images are small.
            if (!uploadedId && !item.mime.startsWith('video/')) {
              const fileRes = await fetch(item.url)
              if (fileRes.ok) {
                const blob = await fileRes.blob()
                const formData = new FormData()
                formData.append('file', blob, item.fileName)
                const uploadRes = await fetch(`${apiBase}/media`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: formData,
                })
                if (uploadRes.ok) {
                  const data = await uploadRes.json()
                  uploadedId = Number(data.id ?? data.data?.id)
                } else {
                  const errText = await uploadRes.text().catch(() => '')
                  uploadErrors.push(`Mixpost binary upload HTTP ${uploadRes.status}: ${errText.slice(0, 200)}`)
                }
              }
            }

            if (uploadedId) {
              mixpostMediaIds.push(uploadedId)
              if (item.mime.startsWith('video/') && item.thumbnailUrl) {
                videoThumbs.push(item.thumbnailUrl)
              }
              // Persist the Mixpost id on the media_items row so the next
              // publish skips the remote-initiate + poll (~382s saved per video).
              if (item.mediaItemId) {
                void supabase
                  .from('media_items')
                  .update({
                    mixpost_media_id: uploadedId,
                    mixpost_media_uuid: uploadedUuid,
                    mixpost_cached_at: new Date().toISOString(),
                  })
                  .eq('id', item.mediaItemId)
              }
            } else {
              uploadErrors.push(`Failed to upload ${item.fileName} (${item.mime})`)
            }
            console.log(
              `[publish_to_social] Media upload: mime=${item.mime} | mediaId=${uploadedId}`,
            )
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            uploadErrors.push(`Exception uploading ${item.fileName}: ${msg}`)
            console.error(`[publish_to_social] Media upload error for ${item.url}:`, err)
          }
        }

        // Backwards-compatible alias used further down
        const mediaIds = mixpostMediaIds

        // FAIL LOUDLY if any media item was requested but Mixpost couldn't ingest it.
        // Previous behaviour: silently publish text-only. Result: two wrong posts hit
        // Facebook before we caught it. Never again.
        if (allMedia.length > 0 && mediaIds.length < allMedia.length) {
          const errorSummary = uploadErrors.length > 0 ? uploadErrors.join('\n  - ') : 'unknown reason'
          return `BLOCKED — cannot publish. ${mediaIds.length}/${allMedia.length} media items uploaded to Mixpost successfully.\n\nUpload failures:\n  - ${errorSummary}\n\nCommon causes for video failures: file size exceeds Mixpost's MIXPOST_MAX_FILE_UPLOAD_SIZE, unsupported codec, or Supabase URL unreachable. Fix the underlying issue and retry — do NOT retry with the same file expecting a different result.`
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

          // Instagram / TikTok / YouTube require media — text-only posts blocked
          if ((platform === 'instagram' || platform === 'tiktok' || platform === 'youtube') && mediaIds.length === 0) {
            results.push(`${platform}: BLOCKED — ${platform} requires media (${hasVideo ? 'video' : 'image/video'}). Upload to the media library first, then pass media_ids.`)
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
                // Mixpost uses video_thumbs to set poster images for video posts.
                // Empty for image-only posts; populated from media_items.thumbnail_url for videos.
                video_thumbs: videoThumbs,
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
            const mediaDesc = hasVideo
              ? ' (with video)'
              : mediaIds.length > 1
                ? ` (carousel: ${mediaIds.length} images)`
                : mediaIds.length === 1
                  ? ' (with image)'
                  : ''
            results.push(isScheduled
              ? `${label}: Scheduled for ${schedule_date} at ${schedule_time} AEST via ${account.name}${mediaDesc}`
              : `${label}: Publishing now via ${account.name}${mediaDesc} (30-60 seconds to go live)`)
            postResults.push({ platform, externalId: externalId || null, success: true })
          } else {
            const errText = await postRes.text().catch(() => '')
            results.push(`${platform}: Failed (${postRes.status}) ${errText.slice(0, 100)}`)
            postResults.push({ platform, externalId: null, success: false })
          }
        }

        // Determine the correct post_type per PostType enum ('single' | 'carousel' | 'reel' | 'video')
        // Video posts on short-form platforms → 'reel'; elsewhere → 'video'; otherwise image logic.
        const ourMediaItemIds = allMedia.map((m) => m.mediaItemId).filter((id): id is string => !!id)

        // Track in scheduled_posts table — one row per platform result
        for (const pr of postResults) {
          try {
            let postType: 'single' | 'carousel' | 'reel' | 'video'
            if (hasVideo) {
              postType = (pr.platform === 'instagram' || pr.platform === 'facebook' || pr.platform === 'tiktok')
                ? 'reel'
                : 'video'
            } else {
              postType = mediaIds.length > 1 ? 'carousel' : 'single'
            }

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
              post_type: postType,
              ...(ourMediaItemIds.length > 0 ? { media_item_ids: ourMediaItemIds } : {}),
              ...(image_url ? { image_url } : {}),
              ...(pr.externalId ? { external_post_id: pr.externalId } : {}),
              ...(!pr.success ? { error: `Failed to publish to ${pr.platform}` } : {}),
              metadata: {
                source: 'publish_to_social',
                created_by: 'Director',
                ...(hasVideo ? { has_video: true } : {}),
              },
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
