import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateScentSellProductClaims } from '@/lib/products/scent-sell-product-gate'
import { checkPublishAllowed } from '@/lib/agents/publish-gate'
import { createDraftPost } from '@/lib/posts/create-draft'
import { publishToPlatform } from '@/lib/publishers/dispatcher'
import type { PublishMedia, PublisherPlatform } from '@/lib/publishers/types'
import { relayIfSafe, userSafeError } from '@/lib/errors/user-safe'

/**
 * The Director's publishing tool. It no longer talks to a platform itself.
 *
 * THE FAULT, and why the obvious version of this file was wrong:
 *
 * It built its own Mixpost base URL out of MIXPOST_API_URL and
 * MIXPOST_WORKSPACE_UUID, listed the workspace's accounts itself, and then
 * chose one by testing whether the project's name or slug appeared ANYWHERE
 * inside an account's name or username — taking `candidates[0]` when several
 * matched. Three separate things were wrong with that:
 *
 *   · It never read `social_urls.mixpost_account_ids`. Those are the CONFIRMED
 *     account overrides — the answer somebody has already checked — and every
 *     other Mixpost caller in this codebase honours them through
 *     mapAccountsToBrandsRaw. This one silently preferred a substring guess
 *     over a confirmed fact, so a project whose account is named for its
 *     product rather than its project matched nothing, and a project whose name
 *     is a substring of another's matched the wrong one. `candidates[0]` then
 *     picked whichever of those the API happened to return first.
 *   · It could not reach Zernio AT ALL. Scent Sell and Endorse Me are linked to
 *     Zernio profiles, and the 5-minute cron sends their scheduled posts there.
 *     So the same stored words went to Zernio when scheduled and to Mixpost when
 *     published from this tool — two OAuth connections to two services, and
 *     nothing in this codebase asserts they point at the same page.
 *   · It ran its own copy of the regulatory review, and only when
 *     `compliance_flags.ahpra || compliance_flags.tga` was set. An unregulated
 *     project got no review of any kind on this path, and the project's
 *     `brand_dna_constraints` were never consulted on any project.
 *
 * All three are now somebody else's problem by design: publishToPlatform is the
 * one door. It picks the backend, narrows accounts to THIS project before
 * narrowing them to the platform, and runs checkPublishAllowed on every project
 * before any platform call. Everything below is the part that is genuinely this
 * tool's job — resolving what the Director asked for, refusing what cannot be
 * published, recording the row, and saying plainly what happened.
 *
 * WHAT DELIBERATELY STAYED HERE, and why the shared gate does not replace it:
 *
 *   · validateScentSellProductClaims runs BEFORE anything is written down. The
 *     shared gate runs it too, but by then a scheduled_posts row exists; a false
 *     product claim should not survive as a row for later work to copy.
 *   · The missing-media_id refusal. The dispatcher receives resolved URLs and
 *     cannot know that the Director invented a UUID. It did once, the lookup
 *     returned nothing, and a text-only post went live in place of a video.
 *   · The Instagram/TikTok/YouTube media requirement. validateMedia only checks
 *     maxima; nothing downstream enforces a minimum.
 */

/**
 * Image vs video without trusting the file extension alone.
 *
 * A Supabase *signed* URL ends `?token=…`, so every `endsWith('.mp4')` test
 * misses and a video is typed as an image — which then fails the platform's
 * image rules for reasons that read as nothing to do with the real cause. The
 * stored mime type is authoritative when the row has one; the extension is only
 * the fallback, and the query string is stripped before it is read.
 *
 * Duplicated from the scheduled publisher rather than imported: the original
 * lives inside a route file (app/api/cron/publish-posts/route.ts) and exporting
 * a helper out of a route is worse than two copies of nine lines. If a third
 * copy appears, move it to lib/publishers.
 */
function mediaKind(url: string, fileType: string | null): 'image' | 'video' {
  if (fileType?.startsWith('video/')) return 'video'
  if (fileType?.startsWith('image/')) return 'image'
  const path = (url.split('?')[0] ?? '').split('#')[0]?.toLowerCase() ?? ''
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/.test(path) ? 'video' : 'image'
}

/**
 * The suffix the owner hears after the platform name. Unchanged wording — this
 * is read aloud, and the owner already knows what these phrases mean.
 */
function describeMedia(media: readonly PublishMedia[]): string {
  if (media.length === 0) return ''
  if (media.some((m) => m.type === 'video')) return ' (with video)'
  if (media.length > 1) return ` (carousel: ${media.length} images)`
  return ' (with image)'
}

const PLATFORM_LABELS: Record<PublisherPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X',
}

/** Platforms that cannot publish a post with nothing attached. */
const MEDIA_REQUIRED = new Set<PublisherPlatform>(['instagram', 'tiktok', 'youtube'])

/**
 * Publish content to social media through the one publishing door.
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
        const { data: brand } = await supabase
          .from('brands')
          .select('name, slug, compliance_flags, brand_dna_constraints')
          .eq('id', brandId)
          .maybeSingle()

        if (!brand) {
          return 'Cannot publish — I could not find that project. Pick the project again and try once more.'
        }

        const brandName = brand.name as string
        const brandSlug = brand.slug as string

        // Runs before a row exists, let alone a platform call. A wrong perfume
        // name is not a normal copy error for the marketplace: it is a false
        // product claim. The catalogue is the authority; an unavailable or near
        // result blocks the named claim rather than letting a plausible model
        // guess through. The shared gate performs this check too, but only once
        // the draft has been written down, and a false claim should not exist
        // as a row that query_outputs can later hold up as an example.
        const productGate = await validateScentSellProductClaims(
          brandSlug,
          hashtags?.length ? `${caption}\n${hashtags.join(' ')}` : caption,
        )
        if (!productGate.allowed) return `PRODUCT IDENTITY CHECK FAILED — post NOT published.\n\n${productGate.reason}`

        // ─── Resolve media ────────────────────────────────────────────────
        // Three input sources, in priority order:
        //   1. media_ids — rows in our media_items table (video + image, carousels)
        //   2. image_urls — multi-image carousel from raw URLs
        //   3. image_url — a single raw URL
        //
        // Nothing is uploaded here any more. The Mixpost upload, its cache and
        // its poll budget belong to the dispatcher, which is the only path that
        // knows whether the destination is even Mixpost — this file used to
        // transcode a video into Mixpost and then discover the project publishes
        // through Zernio. What travels instead is everything the dispatcher
        // needs to make those decisions: the cached Mixpost id so it can skip a
        // ~380s transcode, the poster frame, and the row id to write the cache
        // back to.
        const media: PublishMedia[] = []
        const mediaItemIds: string[] = []

        if (media_ids?.length) {
          const { data: items } = await supabase
            .from('media_items')
            .select('id, file_url, file_name, file_type, file_size_bytes, duration_seconds, thumbnail_url, mixpost_media_id')
            .in('id', media_ids)
            .eq('brand_id', brandId)

          const rows = items ?? []
          const foundIds = new Set(rows.map((i) => i.id as string))
          const missingIds = media_ids.filter((id) => !foundIds.has(id))

          // FAIL LOUDLY — if any media_id cannot be found, refuse to publish.
          // Silent fallback to a text-only post was a real bug: the Director
          // hallucinated a media_id, the lookup returned nothing, and a
          // text-only post went live instead of the expected video. The
          // dispatcher cannot catch this — it is handed resolved URLs and has
          // no way to know one was asked for and never arrived.
          if (missingIds.length > 0) {
            return `BLOCKED — cannot publish. The following media_ids were not found in ${brandName}'s media library: ${missingIds.join(', ')}\n\nCall query_media first to get the real UUIDs (look for the "ID:" field in the output), then retry with those exact IDs. Do NOT guess or reuse any other UUID (like brand_id).`
          }

          // Re-key by id and walk the caller's array. `.in()` returns
          // PostgREST's order, not the owner's, and a carousel is an ordered
          // thing — mapping the rows as they arrive shuffles the slides.
          const byId = new Map(rows.map((row) => [row.id as string, row]))
          for (const id of media_ids) {
            const row = byId.get(id)
            if (!row?.file_url) continue

            const fileType = (row.file_type as string | null) ?? null
            const kind = mediaKind(row.file_url as string, fileType)
            // The column is declared TEXT in src/types/database.ts and holds a
            // number in practice. Coerced rather than cast: a non-numeric value
            // must read as "no cache", not as NaN handed to Mixpost.
            const cachedId = Number(row.mixpost_media_id)

            media.push({
              url: row.file_url as string,
              type: kind,
              mime_type: fileType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
              ...(typeof row.file_size_bytes === 'number' ? { size_bytes: row.file_size_bytes } : {}),
              ...(typeof row.duration_seconds === 'number' ? { duration_seconds: row.duration_seconds } : {}),
              media_item_id: row.id as string,
              ...(Number.isFinite(cachedId) && cachedId > 0 ? { mixpost_media_id: cachedId } : {}),
              ...(row.thumbnail_url ? { thumbnail_url: row.thumbnail_url as string } : {}),
            })
            mediaItemIds.push(row.id as string)
          }
        }

        // Legacy path: raw image URLs. These carry no metadata at all, so the
        // mime type below is a placeholder rather than a measurement — nothing
        // downstream may treat it as one.
        const legacyUrls = image_urls?.length ? image_urls : image_url ? [image_url] : []
        for (const url of legacyUrls) {
          const kind = mediaKind(url, null)
          media.push({
            url,
            type: kind,
            mime_type: kind === 'video' ? 'video/mp4' : 'image/jpeg',
          })
        }

        const mediaDesc = describeMedia(media)
        const hasVideo = media.some((m) => m.type === 'video')
        const isScheduled = !!(schedule_date && schedule_time)

        // ─── The scheduled branch's own review ────────────────────────────
        //
        // A scheduled post never reaches publishToPlatform from here — it is
        // written as a `scheduled` row and the 5-minute cron publishes it, which
        // is the only way a future-dated send can also honour this project's
        // Zernio connection. The consequence is that the door's review does not
        // run until the cron ticks, so without this the owner would be told
        // "Scheduled for the 20th", walk away, and the refusal would land three
        // weeks later in a status column nobody reads.
        //
        // This is the SHARED gate, called once for the whole request, not a
        // second copy of the review: the caption is identical across every
        // platform in one call, so asking per platform would buy nothing and
        // cost a model call each time. The content string matches the one the
        // cron will review later, so the verdict now and the verdict then are
        // answers to the same question.
        if (isScheduled) {
          const gate = await checkPublishAllowed({
            content: [caption, ...(hashtags ?? [])].join('\n'),
            complianceFlags: brand.compliance_flags as never,
            brandDNA: brand.brand_dna_constraints as never,
            brandSlug,
            label: `${brandName} → scheduled`,
          })
          if (!gate.allowed) {
            return `COMPLIANCE CHECK FAILED — post NOT published.\n\n${gate.reason ?? 'The review did not clear this content.'}\n\nFix the content and try again. AHPRA/TGA penalties: up to $60,000 per offence.`
          }
          if (gate.warnings.length > 0) {
            console.log(`[publish_to_social] Compliance warnings for ${brandSlug}:`, gate.warnings)
          }
        }

        const results: string[] = []

        for (const platform of platforms) {
          const label = PLATFORM_LABELS[platform]

          // validateMedia only checks maxima, so nothing downstream refuses a
          // post that has nothing to show on a platform that cannot render one.
          if (MEDIA_REQUIRED.has(platform) && media.length === 0) {
            results.push(`${label}: BLOCKED — ${label} requires media (${hasVideo ? 'video' : 'image or video'}). Upload to the media library first, then pass media_ids.`)
            continue
          }

          // ─── The row is born first, and only here ──────────────────────
          //
          // createDraftPost is the ONE place a draft is born; this tool used to
          // raw-insert into scheduled_posts AFTER the platform had already
          // accepted the post, which meant the row existed only if the send
          // worked and carried none of the brand-name correction, duplicate
          // suppression or platform/media sanity checks that every other draft
          // gets. It also has to come first for a second reason: the dispatcher
          // writes its audit row to publisher_runs.scheduled_post_id, which is
          // `not null references scheduled_posts(id)`. No row, no audit.
          //
          // Status decides whether a Mixpost draft is synced. 'scheduled' syncs
          // one and the cron publishes the NRS row; 'publishing' skips the sync
          // entirely, because on the immediate path the dispatcher is about to
          // create the real post and a draft alongside it is just litter.
          let draft
          try {
            draft = await createDraftPost({
              supabase,
              userId,
              brandId,
              platform,
              caption,
              hashtags: hashtags ?? [],
              mediaItemIds,
              status: isScheduled ? 'scheduled' : 'publishing',
              ...(isScheduled
                ? { scheduledAt: new Date(`${schedule_date}T${schedule_time}:00+10:00`).toISOString() }
                : {}),
              // A scheduled row is published by the cron reading THIS row, so
              // waiting up to 90s per platform for the Mixpost draft to sync
              // would stall the conversation for something the send does not
              // depend on.
              awaitMixpost: false,
              metadata: {
                source: 'publish_to_social',
                created_by: 'Director',
                ...(hasVideo ? { has_video: true } : {}),
              },
            })
          } catch (err) {
            // createDraftPost refuses a combination the platform could never
            // publish — a photo carousel bound for YouTube, say — in words the
            // owner can act on. relayIfSafe passes those through and swallows
            // anything that turns out to carry internal detail.
            results.push(`${label}: NOT published. ${relayIfSafe('publish_to_social', err, 'I could not save this post, so nothing was sent. Try again.')}`)
            continue
          }

          // The legacy raw-URL path attaches nothing to media_item_ids, so the
          // scheduled publisher's only way back to the picture is this column.
          // Without it a scheduled raw-URL post publishes text-only weeks later
          // and nothing reports the loss.
          if (mediaItemIds.length === 0 && legacyUrls[0]) {
            await supabase
              .from('scheduled_posts')
              .update({ image_url: legacyUrls[0] })
              .eq('id', draft.id)
          }

          if (isScheduled) {
            results.push(`${label}: Scheduled for ${schedule_date} at ${schedule_time} AEST${mediaDesc}`)
            continue
          }

          // ─── The one door ───────────────────────────────────────────────
          //
          // The words that publish must be the words in the row. createDraftPost
          // corrects the project's own name in the caption before storing it
          // (enforceBrandName), so re-sending the model's original text here
          // would publish something the review never saw and the row does not
          // contain. Read it back rather than assuming they match.
          //
          // Hashtags travel BARE and separate. The dispatcher's buildCaption
          // adds the '#' and appends them in one place, which is the whole
          // reason the same stored row used to reach the public as different
          // words depending on which path sent it.
          const { data: stored } = await supabase
            .from('scheduled_posts')
            .select('caption, hashtags')
            .eq('id', draft.id)
            .maybeSingle()

          const result = await publishToPlatform({
            scheduled_post_id: draft.id,
            brand_id: brandId,
            platform,
            caption: (stored?.caption as string | null) ?? caption,
            media,
            hashtags: (stored?.hashtags as string[] | null) ?? hashtags,
            // Decides Instagram/Facebook reel-vs-feed and whether TikTok is
            // asked to add music. Derived once by createDraftPost so the row and
            // the send cannot disagree about what kind of post this is.
            post_type: draft.postType,
          })

          // Relay what the publisher actually said.
          //
          // `ok` only means the send was accepted. Only `confirmed` means the
          // platform said it is live — Zernio returns that synchronously,
          // Mixpost never does and is reconciled by the cron's in-flight sweep.
          // Writing 'published' on `ok` alone repeats the fault create-draft.ts
          // exists to prevent: pending is not done.
          //
          // A retryable failure goes back to 'scheduled' with the error
          // CLEARED, which is what puts it in front of the 5-minute cron again.
          // Marking it 'failed' is how real content used to be discarded by a
          // DNS blip and never picked up again — the cron only ever selects
          // status='scheduled'.
          const safeError = result.ok
            ? null
            : relayIfSafe(
                'publish_to_social',
                result.error,
                'The publisher did not accept this post.',
              )

          const update: Record<string, unknown> = result.confirmed
            ? {
                status: 'published',
                published_at: new Date().toISOString(),
                error: null,
                ...(result.external_post_id ? { external_post_id: result.external_post_id } : {}),
              }
            : result.ok
              ? {
                  status: 'publishing',
                  error: null,
                  ...(result.external_post_id ? { external_post_id: result.external_post_id } : {}),
                }
              : result.retryable
                ? { status: 'scheduled', error: null }
                : { status: 'failed', error: safeError }

          const { error: writeBackError } = await supabase
            .from('scheduled_posts')
            .update(update)
            .eq('id', draft.id)

          if (writeBackError) {
            // The post's fate is decided by the platform, not by our ability to
            // record it. Logged, never spoken: the owner is about to be told
            // exactly what happened to the post either way.
            console.error(`[publish_to_social] status write-back failed for ${draft.id}:`, writeBackError.message)
          }

          // What the owner hears. Never names the publishing service: the
          // destination depends on which backend the door chose, and this file
          // no longer knows or needs to know.
          if (result.confirmed) {
            results.push(
              `${label}: Published to ${brandName}'s ${label}${mediaDesc}.`
              + (result.external_permalink ? ` ${result.external_permalink}` : ''),
            )
          } else if (result.ok) {
            results.push(`${label}: Publishing now to ${brandName}'s ${label}${mediaDesc} (30-60 seconds to go live)`)
          } else if (result.retryable) {
            results.push(`${label}: Not published yet — I could not reach the publishing service. It is queued and will go out on its own within a few minutes. Nothing is lost.`)
          } else {
            results.push(`${label}: NOT published. ${safeError}`)
          }
        }

        // A tool's return value is read aloud, so an empty string is the owner
        // hearing silence and assuming it worked. The schema allows an empty
        // `platforms` array and the model has sent one.
        if (results.length === 0) {
          return 'Nothing was published — no platform was named. Tell me where you want this posted (Instagram, Facebook, LinkedIn, TikTok, YouTube or X) and I will send it.'
        }

        return results.join('\n')
      } catch (err) {
        return userSafeError(
          'publish_to_social',
          err,
          'Publishing failed and nothing was sent. Try again, and if it keeps failing the publishing service is unreachable.',
        )
      }
    },
  })
}
