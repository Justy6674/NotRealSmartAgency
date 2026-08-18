/**
 * "Publish now" — the button sitting beside "Schedule" on the same row of the
 * Review panel.
 *
 * THE FAULT: those two buttons reached two different services. "Schedule" hands
 * the row to the 5-minute cron, which goes through publishToPlatform and
 * therefore publishes a Zernio-linked project to Zernio. This route had no
 * Zernio code in it at all — no import, no key read — and always called Mixpost
 * directly. Scent Sell and Endorse Me are linked to Zernio profiles today, so
 * one stored row published to one account under one button and a different
 * account under the other, with nothing asserting the two point at the same
 * page, and nothing warning the owner. A project connected to Zernio but not
 * Mixpost published cleanly on one button and was written to the row as failed
 * on this one.
 *
 * Backend choice, project narrowing, account matching, caption assembly, media
 * upload and the regulatory review now all belong to the dispatcher. What stays
 * here is what only this route knows: who is asking, which rows they own, and
 * the { published, failed, results } shape the Review panel reads.
 */

export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod/v3'
import { fetchMixpostAccounts, type MixpostAccount } from '@/lib/mixpost/client'
import { fetchZernioAccounts, type ZernioAccount } from '@/lib/zernio/client'
import { checkPublishAllowed } from '@/lib/agents/publish-gate'
import { publishTickedAccounts } from '@/lib/publishers/publish-ticked'
import { asPublisherPlatform, type PublishMedia } from '@/lib/publishers/types'
import { platformOptionsOf } from '@/lib/publishers/zernio-platform-data'
import { relayIfSafe, userSafeError } from '@/lib/errors/user-safe'

const Schema = z.object({
  postId: z.string().uuid().optional(),
  postIds: z.array(z.string().uuid()).optional(),
})

/**
 * Decide image vs video without trusting the file extension alone.
 *
 * `getMediaType` in the Zernio client tests `url.toLowerCase().endsWith('.mp4')`.
 * A Supabase *signed* URL ends with a token query string, so every `endsWith`
 * misses and a video is typed as an image — which then fails the platform's
 * image rules for reasons that read as nothing to do with the real cause. The
 * stored mime type is authoritative when we have it; the extension is only the
 * fallback, and the query string is stripped before it is read.
 *
 * Byte-identical to the copy in app/api/cron/publish-posts/route.ts, and that
 * duplication is deliberate for now: the two publishing routes must build the
 * same PublishMedia from the same row or they drift apart again, and neither
 * route owns a place to share it from. It belongs beside the dispatcher.
 */
function mediaKind(url: string, fileType: string | null): 'image' | 'video' {
  if (fileType?.startsWith('video/')) return 'video'
  if (fileType?.startsWith('image/')) return 'image'
  const path = (url.split('?')[0] ?? '').split('#')[0]?.toLowerCase() ?? ''
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/.test(path) ? 'video' : 'image'
}

interface MediaRow {
  id?: string | null
  file_url: string
  file_type?: string | null
  file_size_bytes?: number | null
  duration_seconds?: number | null
  thumbnail_url?: string | null
  mixpost_media_id?: unknown
}

/**
 * The cached Mixpost media id, or nothing — never a guess.
 *
 * Migration 031 declares the column `integer`; src/types/database.ts declares it
 * `string | null`. The two have disagreed since the cache was added, and a bad
 * value here is not a cosmetic problem: the dispatcher treats it as "already
 * uploaded" and skips the upload, so a wrong id publishes somebody else's file.
 * Anything that is not a positive number is dropped and the media is uploaded
 * again — slower, and correct.
 */
function cachedMixpostId(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function toPublishMedia(row: MediaRow): PublishMedia {
  const kind = mediaKind(row.file_url, row.file_type ?? null)
  const cached = cachedMixpostId(row.mixpost_media_id)
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
    ...(row.id ? { media_item_id: row.id } : {}),
    ...(cached ? { mixpost_media_id: cached } : {}),
    ...(row.thumbnail_url ? { thumbnail_url: row.thumbnail_url } : {}),
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const ids = parsed.data.postIds ?? (parsed.data.postId ? [parsed.data.postId] : [])
  if (ids.length === 0) return NextResponse.json({ error: 'No post IDs provided' }, { status: 400 })

  const admin = createAdminClient()

  // The ownership check. The dispatcher runs on the admin client and checks
  // nothing about who asked, so this filter is the only thing standing between
  // a post id and somebody else's connected account — it stays on this side of
  // the call, before anything is sent.
  const { data: posts, error } = await admin
    .from('scheduled_posts')
    .select('*, brands(id, name, slug, social_urls, post_signature, compliance_flags, brand_dna_constraints), media_items(id, file_url, file_name, file_type, file_size_bytes, duration_seconds, thumbnail_url, mixpost_media_id)')
    .in('id', ids)
    .eq('user_id', user.id)

  if (error || !posts?.length) {
    return NextResponse.json({ error: 'Posts not found' }, { status: 404 })
  }

  // List both publishers' accounts ONCE for the whole batch and hand the lists
  // over. This is a network saving and nothing else: the dispatcher still runs
  // mapAccountsToBrandsRaw over the Mixpost list before it filters by platform,
  // which is the ordering that keeps one project's post off every other
  // project's account. Twenty posts otherwise mean twenty account listings.
  const mixpostAccounts: MixpostAccount[] | null = await fetchMixpostAccounts()

  let zernioAccounts: readonly ZernioAccount[] | undefined
  try {
    zernioAccounts = await fetchZernioAccounts()
  } catch (err) {
    // A publisher this batch may not even use must not take the request down;
    // the dispatcher lists them itself when the list is missing.
    console.error(
      '[scheduled-posts/publish-now] could not list Zernio accounts:',
      err instanceof Error ? err.message : String(err),
    )
  }

  /*
   * The 503 fast-fail, narrowed.
   *
   * It used to fire whenever the Mixpost listing came back null, which is
   * exactly wrong now: a project that publishes through Zernio does not need
   * Mixpost at all, and refusing the whole batch on Mixpost's account listing
   * would keep this button broken for Scent Sell and Endorse Me — the fault
   * this route was changed to fix. It fires only when NEITHER publisher can be
   * listed, i.e. there is nowhere for anything to go. With one of them
   * reachable the batch proceeds and each post reports its own outcome, which
   * is more use to the owner than one blanket failure.
   */
  if (!mixpostAccounts && (zernioAccounts?.length ?? 0) === 0) {
    return NextResponse.json(
      { error: 'Could not reach the publishing service, so nothing was sent. Try again in a moment.' },
      { status: 503 },
    )
  }

  let published = 0
  let failed = 0
  /**
   * Requeued, not failed — counted separately so the panel can stop calling it
   * a failure, but ALSO counted in `failed` below, because the panel currently
   * reads only { published, failed } and a post left out of both numbers would
   * be reported as a clean success while sitting back in the queue.
   */
  let requeued = 0
  const results: Array<{ postId: string; status: string; error?: string }> = []

  for (const post of posts) {
    /** Write the refusal to the row and tell the owner, in their words. */
    const refuse = async (message: string) => {
      await admin
        .from('scheduled_posts')
        .update({ status: 'failed', error: message })
        .eq('id', post.id)
      failed++
      results.push({ postId: post.id, status: 'failed', error: message })
    }

    try {
      // The review runs here as well as inside the dispatcher, and deliberately
      // so: this is a second, earlier refusal on a path where a person is
      // pressing a button, not a substitute for the one at the door. It reviews
      // the stored words; the dispatcher reviews the exact final text including
      // the '#' prefixes and the brand's sign-off. Removing either one makes
      // this path weaker than the scheduled one, which keeps both.
      const postBrand = post.brands as Record<string, unknown> | null
      const gate = await checkPublishAllowed({
        content: [String(post.caption ?? ''), ...((post.hashtags as string[] | null) ?? [])].join('\n'),
        complianceFlags: postBrand?.compliance_flags as never,
        brandDNA: postBrand?.brand_dna_constraints as never,
        brandSlug: typeof postBrand?.slug === 'string' ? postBrand.slug : null,
        label: `manual post ${post.id}`,
      })
      if (!gate.allowed) {
        // The gate's reason is written for the owner and is safe to store on
        // the row — publish-gate.ts says so where it builds it. It is not put
        // through userSafeError, which would replace the one thing the owner
        // needs to read with a generic sentence.
        await refuse(gate.reason ?? 'This post did not pass the publishing gate, so nothing was sent.')
        continue
      }
      if (gate.warnings.length > 0) {
        console.log(`[scheduled-posts/publish-now] compliance warnings for post ${post.id}:`, gate.warnings)
      }

      // The dispatcher takes the six-platform union, not a string. This route
      // used to hand `post.platform` straight to Mixpost, where an unrecognised
      // value matched no accounts and failed later with a message about
      // Mixpost. Refusing it here says something the owner can act on.
      const platform = asPublisherPlatform(post.platform)
      if (!platform) {
        await refuse(
          `"${String(post.platform)}" is not a platform this account can post to. Connect it first, or change the platform on this post.`,
        )
        continue
      }

      // Mark as publishing before the send, so a crash mid-flight leaves a row
      // the cron's in-flight sweep will resolve rather than one that looks
      // untouched and invites a second press.
      await admin
        .from('scheduled_posts')
        .update({ status: 'publishing' })
        .eq('id', post.id)

      // The brand's sign-off travels as its own field. Baking it into the
      // caption here is what made the same stored row publish with the sign-off
      // down one route and without it down another.
      const sig = (post.brands as Record<string, unknown>)?.post_signature as
        | { enabled?: boolean; text?: string; format?: string; mention?: string; hashtag?: string }
        | undefined
      let signatureSuffix = ''
      if (sig?.enabled) {
        if (sig.format === 'mention' && sig.mention) signatureSuffix = `\n\n${sig.mention}`
        else if (sig.format === 'hashtag' && sig.hashtag) signatureSuffix = ` ${sig.hashtag}`
        else if (sig.text) signatureSuffix = `\n\n${sig.text}`
      }

      // Gather media in the order the owner arranged it.
      //
      // This route mapped the carousel rows in whatever order PostgREST
      // returned them from `.in()`, which is not the order of the id array — a
      // carousel is an ordered thing and the slides came out shuffled. Re-keying
      // by id and walking the original array fixes that without changing which
      // items are included.
      const mediaRows: MediaRow[] = []

      const mediaItemIds = (post as Record<string, unknown>).media_item_ids as string[] | undefined
      if (mediaItemIds?.length) {
        const { data: carousel } = await admin
          .from('media_items')
          .select('id, file_url, file_type, file_size_bytes, duration_seconds, thumbnail_url, mixpost_media_id')
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

      // image_url fallback, from publish_to_social or generate_image. This
      // route never read it, so a post created by the Director with a generated
      // image published here as text only while the cron published it with the
      // picture.
      if (mediaRows.length === 0 && (post as Record<string, unknown>).image_url) {
        mediaRows.push({ file_url: (post as Record<string, unknown>).image_url as string })
      }

      // ── The one door ──────────────────────────────────────────────────
      //
      // `attempt` is 1 and must stay 1: the dispatcher skips the regulatory
      // review above attempt 1, on the understanding that a retry re-sends
      // content that already passed. A press of this button has not.
      const result = await publishTickedAccounts(
        {
          scheduled_post_id: post.id as string,
          brand_id: post.brand_id as string,
          platform,
          caption: String(post.caption ?? ''),
          media: mediaRows.map(toPublishMedia),
          hashtags: (post.hashtags as string[] | null) ?? undefined,
          signature: signatureSuffix === '' ? undefined : signatureSuffix,
          post_type: (post as Record<string, unknown>).post_type as string | null,
          platform_options: platformOptionsOf((post as Record<string, unknown>).metadata),
          metadata: { source: 'scheduled-posts/publish-now' },
        },
        (post as Record<string, unknown>).metadata,
        { zernioAccounts, mixpostAccounts: mixpostAccounts ?? undefined },
      )

      /*
       * Relay what the publisher actually said. Four outcomes, not two.
       *
       * This route wrote status 'published' and published_at the instant
       * Mixpost's create call returned. Mixpost has ACCEPTED the post at that
       * point and confirms later, on a webhook — so the owner was told a post
       * was live before anyone had said it was, which is the overstatement
       * src/lib/posts/create-draft.ts exists to prevent. It also stored
       * Mixpost's numeric id, which the cron's in-flight sweep does not
       * recognise; the moment a row legitimately sat in 'publishing' with one,
       * the sweep would write off a live post as never sent. `external_post_id`
       * from the dispatcher is the uuid the sweep looks for.
       */
      if (result.confirmed) {
        await admin
          .from('scheduled_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            external_post_id: result.external_post_id ?? null,
            error: null,
          })
          .eq('id', post.id)
        published++
        results.push({ postId: post.id, status: 'published' })
        continue
      }

      if (result.ok) {
        await admin
          .from('scheduled_posts')
          .update({
            status: 'publishing',
            external_post_id: result.external_post_id ?? null,
            // Cleared because this button is pressed most often on a row that
            // failed last time. Leaving the old message beside a 'publishing'
            // badge reads as a fresh failure of a send that is in flight.
            error: null,
          })
          .eq('id', post.id)
        published++
        results.push({ postId: post.id, status: 'publishing' })
        continue
      }

      // The publisher was never reached, as opposed to refusing the content.
      // Writing that off as failed is how a restart, a DNS change or a network
      // blip permanently discarded real content: a failed row is not picked up
      // by the cron, which only takes status 'scheduled'. It goes back in the
      // queue instead, and the owner is told it will go out by itself.
      if (result.retryable) {
        await admin
          .from('scheduled_posts')
          .update({ status: 'scheduled', error: null })
          .eq('id', post.id)
        requeued++
        failed++
        results.push({
          postId: post.id,
          status: 'scheduled',
          error: 'Could not reach the publisher just now. This post is back in the queue and will go out automatically.',
        })
        continue
      }

      // A refusal. The dispatcher's own wording is the owner-facing one and is
      // better than anything this route would invent — but its catch blocks
      // return whatever the transport said, so it is relayed only if it is
      // demonstrably not internal. The limit is generous because a blocked
      // AHPRA/TGA review explains itself at length and that explanation is the
      // whole value of the message.
      await refuse(
        relayIfSafe(
          'scheduled-posts/publish-now',
          result.error,
          'This post was not published. Check the account connection for this platform and try again.',
          400,
        ),
      )
    } catch (err: unknown) {
      const message = userSafeError(
        'scheduled-posts/publish-now',
        err,
        'Something went wrong while sending this post, so nothing was published. Try again shortly.',
      )
      await refuse(message)
    }
  }

  // The shape the Review panel reads, unchanged: it counts { published, failed }
  // for the bulk button and only checks the HTTP status for the single one.
  // `published` counts every post the publisher ACCEPTED, confirmed or not —
  // counting only confirmed ones would report healthy Mixpost sends as failures.
  // The panel's wording should follow: "sent — they will appear shortly", not
  // "published successfully", because at this point that is all anyone knows.
  return NextResponse.json({ published, failed, requeued, results })
}
