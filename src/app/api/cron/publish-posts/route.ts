export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchMixpostAccounts,
  uploadMediaFromUrl,
  createMixpostPost,
  resolveAccountIdsForPlatform,
  type MixpostVersion,
  fetchMixpostPost,
} from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { checkPublishAllowed } from '@/lib/agents/publish-gate'
import { fetchZernioAccounts, createZernioPost, uploadZernioMedia, type ZernioAccount } from '@/lib/zernio/client'



/**
 * Raised when the publisher could not be reached at all — not when it rejected
 * the content. The distinction decides whether a post is retried or written off.
 */
class PublisherUnreachableError extends Error {
  readonly retryable = true
}

/**
 * Normalise a Mixpost post status.
 *
 * The MixpostPost type declares `status: number` with codes 0-3, but the live
 * API returns the string "published". Rather than trust either, accept both —
 * an unrecognised value returns null so the caller waits instead of guessing.
 */
function mixpostPostState(status: unknown): 'published' | 'failed' | null {
  if (status === 'published' || status === 2) return 'published'
  if (status === 'failed' || status === 3) return 'failed'
  return null
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Confirm what actually happened to anything mid-flight, by asking Mixpost.
  //
  // This previously assumed a webhook would report back, and marked every
  // unconfirmed post failed after ten minutes. The webhook was never registered,
  // so posts that published perfectly were recorded as failures — seven were
  // live on Facebook and Instagram while NRS said they had not gone out.
  // Asking is strictly better than being told: it needs no shared secret, no
  // one-off admin step, and no inbound route, and it still works when a webhook
  // is dropped.
  const inFlightSince = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: inFlight } = await supabase
    .from('scheduled_posts')
    .select('id, external_post_id, updated_at')
    .eq('status', 'publishing')
    .lt('updated_at', inFlightSince)

  for (const post of inFlight ?? []) {
    const externalId = post.external_post_id as string | null

    // Only a post uuid can be looked up; legacy numeric ids cannot.
    if (externalId && /^[0-9a-f-]{36}$/i.test(externalId)) {
      const remote = await fetchMixpostPost(externalId)
      const state = remote ? mixpostPostState(remote.status) : null
      if (state === 'published') {
        await supabase
          .from('scheduled_posts')
          .update({ status: 'published', published_at: new Date().toISOString(), error: null })
          .eq('id', post.id)
        continue
      }
      if (state === 'failed') {
        await supabase
          .from('scheduled_posts')
          .update({ status: 'failed', error: 'The publisher reported this post as failed.' })
          .eq('id', post.id)
        continue
      }
      // Still working, or unreachable — leave it alone and ask again next tick
      // rather than inventing a verdict.
      if (remote) continue
    }

    // No usable id after twenty minutes means it never reached the publisher.
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString()
    if ((post.updated_at as string) < twentyMinutesAgo) {
      await supabase
        .from('scheduled_posts')
        .update({ status: 'failed', error: 'Never reached the publisher — no post was created.' })
        .eq('id', post.id)
    }
  }

  // Find posts due for publishing
  const { data: duePosts, error } = await supabase
    .from('scheduled_posts')
    .select('*, brands(id, name, slug, social_urls, post_signature, compliance_flags, brand_dna_constraints), media_items(file_url, file_name)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20)

  if (error || !duePosts?.length) {
    return NextResponse.json({ published: 0, message: 'No posts due' })
  }

  // Pre-fetch Mixpost accounts once for all posts
  const mixpostUrl = process.env.MIXPOST_API_URL
  const mixpostToken = process.env.MIXPOST_API_TOKEN
  const useMixpost = Boolean(mixpostUrl && mixpostToken)

  let brandAccountMap: Map<string, import('@/lib/mixpost/client').MixpostAccount[]> | null = null

  if (useMixpost) {
    const allAccounts = await fetchMixpostAccounts()
    if (allAccounts) {
      // Build brand stubs from the posts' brands for mapping
      const brandStubs = duePosts
        .filter(p => p.brands)
        .map(p => ({
          id: (p.brands as Record<string, unknown>).id as string,
          name: (p.brands as Record<string, unknown>).name as string,
          slug: (p.brands as Record<string, unknown>).slug as string,
          social_urls: ((p.brands as Record<string, unknown>).social_urls as Record<string, string>) ?? {},
        }))

      // De-duplicate by brand ID
      const uniqueBrands = Array.from(
        new Map(brandStubs.map(b => [b.id, b])).values()
      )

      brandAccountMap = mapAccountsToBrandsRaw(allAccounts, uniqueBrands)
    }
  }

  // Pre-fetch Zernio accounts for all profiles associated with these posts
  let zernioAccountMap: Map<string, ZernioAccount[]> = new Map();
  if (process.env.ZERNIO_API_KEY) {
    const allZernioAccounts = await fetchZernioAccounts();
    if (allZernioAccounts && allZernioAccounts.length > 0) {
      duePosts.forEach(p => {
        const brand = p.brands as Record<string, unknown> | null;
        if (brand) {
          const socialUrls = (brand.social_urls as Record<string, string>) ?? {};
          const profileId = socialUrls.zernio_profile_id;
          if (profileId) {
            const accs = allZernioAccounts.filter(a => a.profileId === profileId);
            zernioAccountMap.set(brand.id as string, accs);
          }
        }
      });
    }
  }

  let published = 0
  let failed = 0

  for (const post of duePosts) {
    // Mark as publishing
    await supabase
      .from('scheduled_posts')
      .update({ status: 'publishing' })
      .eq('id', post.id)

    try {
      // The review runs here, immediately before the platform call, rather than
      // at draft time: content can be edited in the Review UI after a draft-time
      // check passed, so an earlier verdict does not describe what is about to
      // be published.
      const postBrand = post.brands as Record<string, unknown> | null
      const gate = await checkPublishAllowed({
        content: [String(post.caption ?? ''), ...((post.hashtags as string[] | null) ?? [])].join('\n'),
        complianceFlags: postBrand?.compliance_flags as never,
        brandDNA: postBrand?.brand_dna_constraints as never,
        brandSlug: typeof postBrand?.slug === 'string' ? postBrand.slug : null,
        label: `scheduled post ${post.id}`,
      })
      if (!gate.allowed) {
        await supabase
          .from('scheduled_posts')
          .update({ status: 'failed', error: gate.reason })
          .eq('id', post.id)
        console.error(`[cron/publish-posts] blocked: ${gate.reason}`)
        failed++
        continue
      }
      if (gate.warnings.length > 0) {
        console.log(`[cron/publish-posts] compliance warnings for post ${post.id}:`, gate.warnings)
      }

      // Build post signature suffix
      const sig = (post.brands as Record<string, unknown>)?.post_signature as
        | { enabled?: boolean; text?: string; format?: string; mention?: string; hashtag?: string }
        | undefined
      let signatureSuffix = ''
      if (sig?.enabled) {
        if (sig.format === 'mention' && sig.mention) signatureSuffix = `\n\n${sig.mention}`
        else if (sig.format === 'hashtag' && sig.hashtag) signatureSuffix = ` ${sig.hashtag}`
        else if (sig.text) signatureSuffix = `\n\n${sig.text}`
      }

      let externalPostId: string | null = null

      const brandId = post.brand_id as string
      const zernioAccs = zernioAccountMap.get(brandId) || []
      const zernioAccount = zernioAccs.find(a => a.platform === post.platform)

      // Gather media URLs from media_items (shared across publishers)
      const mediaUrls: string[] = []
      
      // Carousel support: media_item_ids array
      const mediaItemIds = (post as Record<string, unknown>).media_item_ids as string[] | undefined
      if (mediaItemIds?.length) {
        const { data: mediaItems } = await supabase
          .from('media_items')
          .select('file_url')
          .in('id', mediaItemIds)
        mediaUrls.push(...(mediaItems ?? []).map((m: { file_url: string }) => m.file_url))
      }

      // Single media fallback (joined relation)
      if (mediaUrls.length === 0 && post.media_items?.file_url) {
        mediaUrls.push(post.media_items.file_url as string)
      }

      // image_url fallback (from publish_to_social or generate_image)
      if (mediaUrls.length === 0 && (post as Record<string, unknown>).image_url) {
        mediaUrls.push((post as Record<string, unknown>).image_url as string)
      }

      if (zernioAccount) {
        // ── Primary SaaS Path: Zernio ──
        
        // 1. Handle media
        const zernioMediaIds: string[] = []
        for (const url of mediaUrls) {
          const mId = await uploadZernioMedia(url)
          if (mId) zernioMediaIds.push(mId)
        }

        // 2. Build caption
        let caption = post.caption as string
        const hashtags = post.hashtags as string[] | null
        if (hashtags?.length) {
          caption += '\n\n' + hashtags.map((h: string) => `#${h}`).join(' ')
        }
        caption += signatureSuffix

        // 3. Post
        const result = await createZernioPost({
          content: caption,
          accounts: [{ platform: post.platform, accountId: zernioAccount.id }],
          mediaIds: zernioMediaIds,
          publishNow: true
        })
        
        externalPostId = result._id || result.id || null;
      } else if (useMixpost && brandAccountMap) {
        // ── Publish via Mixpost (self-hosted, free) ──

        // 1. Resolve Mixpost account IDs for this brand + platform
        const brandAccounts = brandAccountMap.get(brandId) ?? []
        const accountIds = resolveAccountIdsForPlatform(post.platform, brandAccounts)

        if (accountIds.length === 0) {
          throw new Error(
            `No Mixpost account found for platform "${post.platform}" on brand "${(post.brands as Record<string, unknown>)?.name ?? brandId}". Connect this platform in Mixpost first.`
          )
        }

        // 3. Upload media to Mixpost
        const mixpostMediaIds: number[] = []
        for (const url of mediaUrls) {
          const result = await uploadMediaFromUrl(url)
          if (result) mixpostMediaIds.push(result.id)
        }

        // 4. Build caption with hashtags + signature
        let caption = post.caption as string
        const hashtags = post.hashtags as string[] | null
        if (hashtags?.length) {
          caption += '\n\n' + hashtags.map((h: string) => `#${h}`).join(' ')
        }
        caption += signatureSuffix

        // 5. Build platform-specific options
        const platformOptions: Record<string, unknown> = {}
        const postType = (post as Record<string, unknown>).post_type as string | undefined

        if (post.platform === 'instagram') {
          platformOptions.type = postType === 'reel' ? 'reel' : 'post'
        }
        if (post.platform === 'tiktok') {
          platformOptions.privacy_level = 'PUBLIC_TO_EVERYONE'
          if (postType === 'carousel') platformOptions.auto_add_music = true
        }
        if (post.platform === 'linkedin') {
          platformOptions.visibility = 'PUBLIC'
        }
        if (post.platform === 'youtube') {
          platformOptions.privacy_status = 'public'
          // AI-generated content disclosure
          platformOptions.contains_synthetic_media = true
        }

        // 6. Build version (original version targets all selected accounts)
        const version: MixpostVersion = {
          account_id: 0,
          is_original: true,
          content: [{
            body: caption,
            media: mixpostMediaIds,
            url: null,
            video_thumbs: [],
          }],
          options: Object.keys(platformOptions).length > 0 ? platformOptions : undefined,
        }

        // 7. Create post in Mixpost
        const result = await createMixpostPost({
          accounts: accountIds,
          versions: [version],
          schedule_now: true,
        })

        if (!result) {
          throw new Error('Failed to create Mixpost post — API returned no result')
        }

        externalPostId = result.id
      } else if (!useMixpost) {
        // ── Fallback: Ayrshare ──
        const { data: integration } = await supabase
          .from('user_integrations')
          .select('cached_data')
          .eq('user_id', post.user_id)
          .eq('provider', 'ayrshare')
          .single()

        const apiKey =
          (integration?.cached_data?.api_key as string) ||
          process.env.AYRSHARE_API_KEY ||
          null

        if (!apiKey) {
          throw new Error(
            'No publishing service configured. Set MIXPOST_API_URL + MIXPOST_API_TOKEN or an Ayrshare API key.'
          )
        }

        const mediaUrl = post.media_items?.file_url as string | undefined

        const ayrshareRes = await fetch('https://app.ayrshare.com/api/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            post: (post.caption as string) + signatureSuffix,
            platforms: [post.platform === 'twitter' ? 'twitter' : post.platform],
            ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}),
            ...(post.hashtags ? { hashtags: post.hashtags } : {}),
          }),
        })

        const result = await ayrshareRes.json()

        if (!ayrshareRes.ok) {
          throw new Error(result.message ?? `Ayrshare error ${ayrshareRes.status}`)
        }

        externalPostId = result.id ?? result.postId ?? null
      } else {
        // Mixpost configured but accounts fetch failed — retry next cron tick
        throw new PublisherUnreachableError('Could not reach the publisher to list accounts.')
      }

      // Mark as publishing — webhook will confirm final 'published' status
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'publishing',
          external_post_id: externalPostId,
        })
        .eq('id', post.id)

      published++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'

      // A publisher we could not reach says nothing about the content. The
      // previous code threw an error promising a retry and then wrote failed
      // anyway, so a momentary outage — a restart, a DNS change, a network
      // blip — permanently discarded real scheduled content and nothing ever
      // picked it up again. It goes back in the queue for the next tick.
      if (err instanceof PublisherUnreachableError) {
        await supabase
          .from('scheduled_posts')
          .update({ status: 'scheduled', error: null })
          .eq('id', post.id)

        console.warn(`[cron/publish-posts] publisher unreachable, requeued post ${post.id}`)
        failed++
        continue
      }

      await supabase
        .from('scheduled_posts')
        .update({ status: 'failed', error: message })
        .eq('id', post.id)

      failed++
    }
  }

  return NextResponse.json({ published, failed, total: duePosts.length })
}
