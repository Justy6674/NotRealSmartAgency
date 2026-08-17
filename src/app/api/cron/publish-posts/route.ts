export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMixpostPost } from '@/lib/mixpost/client'
import { checkPublishAllowed } from '@/lib/agents/publish-gate'
import { publishToPlatform } from '@/lib/publishers/dispatcher'
import {
  fetchZernioAccounts,
  fetchZernioPostStatus,
  zernioPostState,
  type ZernioAccount,
} from '@/lib/zernio/client'
import type { PublishMedia, PublishResult, PublisherPlatform } from '@/lib/publishers/types'

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

/**
 * The platforms the one door can actually reach.
 *
 * This route used to hand `post.platform` to Mixpost as a bare string, and
 * `resolveAccountIdsForPlatform` falls back to `[platform]` for anything it
 * does not recognise — so an unknown value did not fail here, it quietly
 * matched no accounts and failed later with a message about Mixpost. Narrowing
 * it at the edge means an unsupported platform is refused in words the owner
 * can act on, before any account lookup happens.
 *
 * Checked against live data on 2026-08-17: all 158 rows in `scheduled_posts`
 * use one of these six, so nothing currently scheduled is excluded.
 */
const DISPATCHABLE_PLATFORMS: readonly PublisherPlatform[] = [
  'facebook',
  'instagram',
  'linkedin',
  'tiktok',
  'twitter',
  'youtube',
]

function asPublisherPlatform(value: unknown): PublisherPlatform | null {
  return typeof value === 'string' &&
    (DISPATCHABLE_PLATFORMS as readonly string[]).includes(value)
    ? (value as PublisherPlatform)
    : null
}

/**
 * Decide image vs video without trusting the file extension alone.
 *
 * `getMediaType` in the Zernio client tests `url.toLowerCase().endsWith('.mp4')`.
 * A Supabase *signed* URL ends `?token=…`, so every `endsWith` misses and a
 * video is typed as an image — which then fails the platform's image rules for
 * reasons that read as nothing to do with the real cause. The stored mime type
 * is authoritative when we have it; the extension is only the fallback, and the
 * query string is stripped before it is read.
 */
function mediaKind(url: string, fileType: string | null): 'image' | 'video' {
  if (fileType?.startsWith('video/')) return 'video'
  if (fileType?.startsWith('image/')) return 'image'
  const path = (url.split('?')[0] ?? '').split('#')[0]?.toLowerCase() ?? ''
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/.test(path) ? 'video' : 'image'
}

interface MediaRow {
  file_url: string
  file_type?: string | null
  file_size_bytes?: number | null
  duration_seconds?: number | null
}

function toPublishMedia(row: MediaRow): PublishMedia {
  const kind = mediaKind(row.file_url, row.file_type ?? null)
  return {
    url: row.file_url,
    type: kind,
    // The stored mime type when the row has one. The generic stand-in is only
    // ever reached by the legacy `image_url` column, which carries no metadata
    // at all — it is a placeholder, not a measurement, and nothing downstream
    // may treat it as one.
    mime_type: row.file_type ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    ...(typeof row.file_size_bytes === 'number' ? { size_bytes: row.file_size_bytes } : {}),
    ...(typeof row.duration_seconds === 'number' ? { duration_seconds: row.duration_seconds } : {}),
  }
}

/**
 * The dispatcher never got the content, as opposed to refusing it.
 *
 * `publishToPlatform` reports both as `{ ok: false, error }`, so without this
 * every outage would be read as a rejection and the row written off. That is
 * the exact fault the requeue below was written to stop: a restart, a DNS
 * change or a network blip permanently discarded real scheduled content and
 * nothing ever picked it up again.
 *
 * These strings are the dispatcher's own transport failures — a Mixpost
 * account list that could not be fetched, and a rate limit it intends to serve
 * later. Matching on prose is not how this should work; it is what the current
 * `PublishResult` allows. When that type grows a `retryable` flag, read the
 * flag and delete this list. Do NOT widen it in the meantime: "no account
 * connected for instagram" is a configuration answer, not an outage, and
 * requeueing it would loop every five minutes without ever telling the owner.
 */
const PUBLISHER_UNREACHABLE = ['No Mixpost accounts connected', 'Rate limit exceeded'] as const

function publisherWasUnreachable(result: PublishResult): boolean {
  if (result.retry_after_ms) return true
  const error = result.error ?? ''
  return PUBLISHER_UNREACHABLE.some((fragment) => error.includes(fragment))
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

    /*
     * Ask the publisher that actually sent it.
     *
     * This guard was `/^[0-9a-f-]{36}$/` alone — a Mixpost UUID. A Zernio id is
     * a 24-character Mongo ObjectId, so every Zernio post failed the test, was
     * never looked up, and dropped through to being written off below as "Never
     * reached the publisher". A post live on Facebook read as a failure in NRS,
     * and the obvious response — send it again — puts it on the page twice.
     *
     * The row does not record which publisher sent it, so the id shape decides.
     * That is not elegant, but it is exact: the two formats cannot collide.
     */
    const isMixpostId = !!externalId && /^[0-9a-f-]{36}$/i.test(externalId)
    const isZernioId = !!externalId && /^[0-9a-f]{24}$/i.test(externalId)

    if (externalId && isZernioId) {
      const state = zernioPostState(await fetchZernioPostStatus(externalId))
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
      // Unknown, still running, or Zernio unreachable. It has an id, so it did
      // reach a publisher — asking again next tick beats inventing a verdict.
      continue
    }

    if (externalId && isMixpostId) {
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

    /*
     * Only a post with NO id at all is written off.
     *
     * This previously caught anything the guard above did not recognise, so an
     * id in an unexpected shape — every Zernio id, and any future publisher's —
     * was reported to the owner as never sent. "We could not identify this" and
     * "this did not go out" are different facts, and merging them fails in the
     * direction that causes duplicate posts on a live account.
     */
    if (externalId) continue

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
    .select('*, brands(id, name, slug, social_urls, post_signature, compliance_flags, brand_dna_constraints), media_items(file_url, file_name, file_type, file_size_bytes, duration_seconds)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(20)

  if (error || !duePosts?.length) {
    return NextResponse.json({ published: 0, message: 'No posts due' })
  }

  // List the team's Zernio accounts once and hand the list over.
  //
  // This is a batch optimisation, not a decision. The route used to key these
  // by `social_urls.zernio_profile_id` itself and prefer Zernio whenever a
  // match existed — a private rule that /api/scheduled-posts/publish-now did
  // not share, which is how one row published to the Zernio account under
  // "Schedule" and the Mixpost account under "Publish now". The rule now lives
  // once, in selectPublisherBackend. All this does is save one API call per
  // post; omitting it would be correct, only slower.
  let zernioAccounts: readonly ZernioAccount[] | undefined
  try {
    zernioAccounts = await fetchZernioAccounts()
  } catch (err) {
    // A publisher we may not even be using must not take the tick down. The
    // dispatcher falls back on its own when the list is missing.
    console.error(
      '[cron/publish-posts] could not list Zernio accounts:',
      err instanceof Error ? err.message : String(err),
    )
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
      //
      // It is handed to the dispatcher as its own field rather than spliced
      // into the caption here. Three paths each appended it differently, or
      // not at all, so the same stored row published with the brand's sign-off
      // down one route and without it down another. One field, appended in one
      // place, is the only arrangement where they cannot disagree.
      const sig = (post.brands as Record<string, unknown>)?.post_signature as
        | { enabled?: boolean; text?: string; format?: string; mention?: string; hashtag?: string }
        | undefined
      let signatureSuffix = ''
      if (sig?.enabled) {
        if (sig.format === 'mention' && sig.mention) signatureSuffix = `\n\n${sig.mention}`
        else if (sig.format === 'hashtag' && sig.hashtag) signatureSuffix = ` ${sig.hashtag}`
        else if (sig.text) signatureSuffix = `\n\n${sig.text}`
      }

      const platform = asPublisherPlatform(post.platform)
      if (!platform) {
        throw new Error(
          `"${String(post.platform)}" is not a platform this account can post to. Connect it first, or change the platform on this post.`,
        )
      }

      // Gather media, in the order the owner arranged it.
      //
      // The carousel branch previously mapped the rows in whatever order
      // PostgREST returned them from `.in()`, which is not the order of the
      // id array — a carousel is an ordered thing and the slides could come
      // out shuffled. Re-keying by id and walking the original array fixes
      // that without changing which items are included.
      const mediaRows: MediaRow[] = []

      const mediaItemIds = (post as Record<string, unknown>).media_item_ids as string[] | undefined
      if (mediaItemIds?.length) {
        const { data: carousel } = await supabase
          .from('media_items')
          .select('id, file_url, file_type, file_size_bytes, duration_seconds')
          .in('id', mediaItemIds)
        const byId = new Map(
          (carousel ?? []).map((m: MediaRow & { id: string }) => [m.id, m]),
        )
        for (const id of mediaItemIds) {
          const row = byId.get(id)
          if (row?.file_url) mediaRows.push(row)
        }
      }

      // Single media fallback (joined relation)
      if (mediaRows.length === 0 && post.media_items?.file_url) {
        mediaRows.push(post.media_items as MediaRow)
      }

      // image_url fallback (from publish_to_social or generate_image)
      if (mediaRows.length === 0 && (post as Record<string, unknown>).image_url) {
        mediaRows.push({ file_url: (post as Record<string, unknown>).image_url as string })
      }

      // ── The one door ──────────────────────────────────────────────────
      //
      // Everything below the gate used to be an inline `if (zernioAccount) …
      // else if (useMixpost) … else ayrshare` fork, which is why this route
      // and /api/scheduled-posts/publish-now could send the same row to two
      // different services. Backend choice, account matching, caption
      // assembly and media handling now belong to publishToPlatform.
      //
      // AYRSHARE WAS THE THIRD ARM OF THAT FORK AND IT IS NOT COMING BACK.
      // Do not restore it as a "fallback" on the strength of an
      // `AYRSHARE_API_KEY` still named in a stale integrations note, or of
      // 'ayrshare' still sitting in the IntegrationProvider union. It was not
      // a spare copy of this path, it was a different one, and each difference
      // was silent:
      //   · it handed `hashtags` to Ayrshare as its own field instead of
      //     appending them to the body, so one stored row reached the public
      //     as different words depending on which environment variables
      //     happened to be set on the deployment that ran the tick;
      //   · it sent `mediaUrls: [post.media_items.file_url]` — a single item —
      //     so a carousel published as one image and nothing reported a loss;
      //   · it was selected by `else if (!useMixpost)`, that is, by
      //     configuration being ABSENT. A publisher chosen because nobody set
      //     anything is a publisher chosen when nobody is watching, which on a
      //     health brand is an AHPRA/TGA exposure, not an inconvenience.
      // A publisher that cannot be reached must say so and be requeued by the
      // catch below. It must never quietly take a different-shaped route to a
      // live account. regulatory-invariants.test.ts lists Ayrshare under
      // RETIRED and holds its endpoint to match nothing anywhere in src/ —
      // which is also why the URL is not written out here, comment or not, as
      // that scan reads raw source text. Bringing it back has to be argued for
      // in that file rather than slipped in through this one.
      //
      // `attempt` is 1 and must stay 1: the dispatcher skips the regulatory
      // review on attempts above 1, on the understanding that a retry is
      // re-sending content that already passed. Content arriving from this
      // loop has not.
      const result = await publishToPlatform(
        {
          scheduled_post_id: post.id as string,
          brand_id: post.brand_id as string,
          platform,
          caption: String(post.caption ?? ''),
          media: mediaRows.map(toPublishMedia),
          hashtags: (post.hashtags as string[] | null) ?? undefined,
          signature: signatureSuffix === '' ? undefined : signatureSuffix,
          // post_type decides Instagram reel-vs-feed, TikTok's carousel music
          // and YouTube's synthetic-media disclosure. It travels with the
          // request so the dispatcher can apply them in one place; a publisher
          // that ignores it drops the AI disclosure on a regulated brand.
          metadata: {
            source: 'cron/publish-posts',
            post_type: (post as Record<string, unknown>).post_type ?? null,
          },
        },
        1,
        { zernioAccounts },
      )

      if (!result.ok) {
        if (publisherWasUnreachable(result)) {
          throw new PublisherUnreachableError(
            result.error ?? 'Could not reach the publisher.',
          )
        }
        throw new Error(result.error ?? 'The publisher did not accept this post.')
      }

      // Relay what the publisher actually said.
      //
      // `ok` only means the send was accepted. Only `confirmed` means the
      // platform said it is live — Zernio returns that synchronously, Mixpost
      // never does and is reconciled by the in-flight sweep above. Writing
      // 'published' on `ok` alone would repeat the fault create-draft.ts was
      // written to prevent: pending is not done.
      await supabase
        .from('scheduled_posts')
        .update(
          result.confirmed
            ? {
                status: 'published',
                published_at: new Date().toISOString(),
                external_post_id: result.external_post_id ?? null,
                error: null,
              }
            : {
                status: 'publishing',
                external_post_id: result.external_post_id ?? null,
              },
        )
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
