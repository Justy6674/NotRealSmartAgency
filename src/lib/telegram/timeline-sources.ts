/**
 * Where the timeline's events come from.
 *
 * The extension seam. `buildTelegramTimeline` never learns a table name, and
 * the comparator never learns an event kind beyond its rank — so adding
 * "published post" or "approval" later is one adapter and one array entry, not
 * a new section in the page and a new special case in the sort.
 *
 * That matters because the bug being fixed here WAS a new section: media was
 * bolted on beside the chat as its own list with its own ordering, and the two
 * could never interleave. One more of those and the screen is broken again.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { STALE_AFTER_MS, toUtcMs, type TimelineSourceEvent } from './timeline'
import { stripMediaDirective } from './telegram-album'

export interface TimelineFetchContext {
  admin: SupabaseClient
  userId: string
  brandId: string
  /** Only rows at or after this instant. Null means the most recent window. */
  fromMs: number | null
  /** Generous — the builder pages by group afterwards. */
  rowLimit: number
}

export interface TimelineMapOptions {
  brandId: string
  /** Passed in, never read from the ambient clock, so tests are deterministic. */
  nowMs: number
}

export interface TimelineSource<Row> {
  name: string
  fetch(context: TimelineFetchContext): Promise<Row[]>
  map(rows: Row[], options: TimelineMapOptions): TimelineSourceEvent[]
}

/** How long a proposal may be missing before a clip stops saying "listening". */
const PROPOSAL_GRACE_MS = 10 * 60 * 1000

/**
 * Say what actually went wrong, in his words rather than the system's.
 *
 * A generic "try again" is worse than no message when trying again cannot
 * work: it puts the owner in a loop, sending the same thing into the same wall
 * and concluding the product is broken — which, in the way that matters, it
 * was. The stored error is written for a log; this turns it into a sentence
 * that tells him what to DO.
 */
export function explainJobError(error: string | null | undefined): string {
  const raw = error?.trim() ?? ''

  if (/budget/i.test(raw)) {
    // The number is deliberately not shown. "10003c / 10000c" is the shape of
    // the bug, not of the answer he needs.
    return 'The monthly spend limit for this account has been reached, so nothing will run'
      + ' until it is raised. This is not something you can fix by resending — tell me and'
      + ' I will lift it.'
  }

  if (/rate.?limit|429|too many requests/i.test(raw)) {
    return 'The AI is rate-limited for a moment. Give it about a minute, then send it again.'
  }

  if (/timeout|timed out|ETIMEDOUT/i.test(raw)) {
    return 'That took too long and was stopped. Nothing else changed — send it again.'
  }

  return 'That did not complete. Nothing else changed — try again.'
}

/**
 * Whether "Send it again" should even be offered.
 *
 * Offering a retry that is guaranteed to fail is how the owner spent an
 * evening pressing a button against a spend cap.
 */
export function canRetry(error: string | null | undefined): boolean {
  return !/budget/i.test(error?.trim() ?? '')
}

interface JobRow {
  id: string
  status: string | null
  input: Record<string, unknown> | null
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
  completed_at: string | null
}

interface CarouselDelivery {
  title: string
  outputId: string | null
  platform: string
  caption: string
  hashtags: string[]
  slides: Array<{ mediaItemId: string; fileUrl: string; fileName: string }>
}

/**
 * A job is not a carousel merely because its prose says it is. The Mini App
 * may show a review card only after NRS has persisted at least two real media
 * files. This is the same distinction as a Mixpost receipt: words are not the
 * thing the owner needs to inspect.
 */
export function carouselDeliveryFromJobResult(result: Record<string, unknown> | null): CarouselDelivery | null {
  const raw = result?.carousel_delivery
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const media = Array.isArray(value.media) ? value.media : []
  const slides = media.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    if (
      typeof row.media_item_id !== 'string' ||
      typeof row.file_url !== 'string' ||
      typeof row.file_name !== 'string'
    ) return []
    return [{ mediaItemId: row.media_item_id, fileUrl: row.file_url, fileName: row.file_name }]
  })
  if (slides.length < 2) return null

  return {
    title: typeof value.title === 'string' && value.title.trim() ? value.title : 'Carousel ready to review',
    outputId: typeof value.output_id === 'string' ? value.output_id : null,
    platform: typeof value.platform === 'string' && value.platform ? value.platform : 'instagram',
    caption: typeof value.caption === 'string' ? value.caption : '',
    hashtags: Array.isArray(value.hashtags)
      ? value.hashtags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    slides,
  }
}

/**
 * Carousel proposals are durable Review records. Their slide receipts are
 * written by NRS, rather than inferred from a title or a model response, so a
 * reload still shows the exact assets that will be sent to Mixpost.
 */
function carouselDeliveryFromProposal(row: OutputRow): CarouselDelivery | null {
  const metadata = row.metadata ?? {}
  if (metadata.post_type !== 'carousel') return null
  const rawSlides = Array.isArray(metadata.carousel_slides) ? metadata.carousel_slides : []
  const slides = rawSlides.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const slide = item as Record<string, unknown>
    if (
      typeof slide.media_item_id !== 'string'
      || typeof slide.file_url !== 'string'
      || typeof slide.file_name !== 'string'
    ) return []
    return [{
      mediaItemId: slide.media_item_id,
      fileUrl: slide.file_url,
      fileName: slide.file_name,
    }]
  })
  if (slides.length < 2) return null

  return {
    title: row.title?.trim() || 'Carousel ready to review',
    outputId: row.id,
    platform: typeof metadata.platform === 'string' && metadata.platform ? metadata.platform : 'instagram',
    caption: row.content ?? '',
    hashtags: Array.isArray(metadata.hashtags)
      ? metadata.hashtags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    slides,
  }
}

/**
 * The owner's messages and the Director's answers.
 *
 * One row becomes TWO events — the question, and exactly one of
 * pending / reply / error for the answer. They share a group anchored on the
 * question, which is what keeps an answer directly beneath the thing it
 * answers however long it took.
 */
export const directorJobSource: TimelineSource<JobRow> = {
  name: 'director_jobs',

  async fetch({ admin, userId, brandId, fromMs, rowLimit }) {
    let query = admin
      .from('mcp_jobs')
      .select('id, status, input, result, error, created_at, completed_at')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .eq('channel', 'telegram')
      .order('created_at', { ascending: false })
      .limit(rowLimit)

    if (fromMs !== null) query = query.gte('created_at', new Date(fromMs).toISOString())

    const { data } = await query
    return (data ?? []) as JobRow[]
  },

  map(rows, { brandId, nowMs }) {
    const events: TimelineSourceEvent[] = []

    for (const row of rows) {
      const askedAtMs = toUtcMs(row.created_at)
      if (askedAtMs === null) continue

      // The model needs the media directive on the active turn, but the owner
      // must only see their own words. Showing UUIDs and internal instructions
      // in the Mini App made a normal attachment look like a failed upload.
      const message = typeof row.input?.message === 'string'
        ? stripMediaDirective(row.input.message)
        : ''
      const mediaItemIds = Array.isArray(row.input?.media_item_ids)
        ? row.input.media_item_ids.filter((id): id is string => typeof id === 'string')
        : []
      const clientEventId =
        typeof row.input?.client_event_id === 'string' ? row.input.client_event_id : null
      const askId = `ask:${row.id}`

      // A message the Director wrote for itself (an internal directive) has no
      // owner text; showing an empty bubble would be a phantom the owner never
      // sent.
      if (message) {
        events.push({
          id: askId,
          kind: 'user_message',
          groupParentId: null,
          occurredAtMs: askedAtMs,
          side: 'owner',
          brandId,
          clientEventId,
          payload: { kind: 'user_message', text: message, mediaIds: mediaItemIds, status: 'sent' },
        })
      }

      const answerId = `answer:${row.id}`
      const parent = message ? askId : null
      const response = typeof row.result?.response === 'string' ? row.result.response : ''
      const completedAtMs = toUtcMs(row.completed_at)

      if (row.status === 'done' && response) {
        events.push({
          id: answerId,
          kind: 'director_reply',
          groupParentId: parent,
          // Its own instant, for the day separator. The GROUP anchor is what
          // it sorts by, and that is the question's instant — see timeline.ts.
          occurredAtMs: completedAtMs ?? askedAtMs,
          side: 'director',
          brandId,
          payload: { kind: 'director_reply', jobId: row.id, text: response, withheld: false },
        })
        const carousel = carouselDeliveryFromJobResult(row.result)
        if (carousel) {
          events.push({
            id: `carousel:${row.id}`,
            kind: 'carousel_delivery',
            groupParentId: answerId,
            occurredAtMs: completedAtMs ?? askedAtMs,
            side: 'director',
            brandId,
            payload: {
              kind: 'carousel_delivery',
              jobId: row.id,
              title: carousel.title,
              outputId: carousel.outputId,
              platform: carousel.platform,
              caption: carousel.caption,
              hashtags: carousel.hashtags,
              slides: carousel.slides,
              approved: false,
              mixpost: null,
            },
          })
        }
        continue
      }

      if (row.status === 'error' || (row.status === 'done' && !response)) {
        events.push({
          id: answerId,
          kind: 'director_error',
          groupParentId: parent,
          occurredAtMs: completedAtMs ?? askedAtMs,
          side: 'director',
          brandId,
          payload: {
            kind: 'director_error',
            jobId: row.id,
            // Both branches of this used to say the same generic sentence, so
            // the real reason was read, tested for, and thrown away. The
            // Director spent a day rejecting every message with "Budget
            // exceeded — 10003c / 10000c monthly limit" while the owner was
            // told to try again, which was the one thing that could not work.
            text: explainJobError(row.error),
            retryText: canRetry(row.error) ? (message || null) : null,
            retryClientEventId: clientEventId,
          },
        })
        continue
      }

      // Still queued or running. Past the stale bound it is reported as failed
      // WITH a retry, rather than spinning forever with nothing to act on.
      const waitedMs = nowMs - askedAtMs
      if (waitedMs > STALE_AFTER_MS) {
        events.push({
          id: answerId,
          kind: 'director_error',
          groupParentId: parent,
          occurredAtMs: askedAtMs,
          side: 'director',
          brandId,
          payload: {
            kind: 'director_error',
            jobId: row.id,
            text: 'This one stopped responding. Nothing else changed — send it again when you are ready.',
            retryText: message || null,
            retryClientEventId: clientEventId,
          },
        })
        continue
      }

      events.push({
        id: answerId,
        kind: 'director_pending',
        groupParentId: parent,
        occurredAtMs: askedAtMs,
        side: 'director',
        brandId,
        payload: {
          kind: 'director_pending',
          jobId: row.id,
          label: 'Working…',
          waitingSinceMs: askedAtMs,
        },
      })
    }

    return events
  },
}

interface MediaRow {
  id: string
  file_name: string | null
  file_type: string | null
  thumbnail_url: string | null
  transcription_status: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

/** Clips and photos sent from the Mini App. */
export const miniAppMediaSource: TimelineSource<MediaRow> = {
  name: 'mini_app_media',

  async fetch({ admin, userId, brandId, fromMs, rowLimit }) {
    let query = admin
      .from('media_items')
      .select('id, file_name, file_type, thumbnail_url, transcription_status, metadata, created_at')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      // Unchanged from the route this replaces. Broadening it to every
      // Telegram source would double-render a captioned photo sent to the bot:
      // once from its job row, once as a clip, with no shared key to collapse
      // them. That needs a shared message id on both writers first.
      .contains('metadata', { source: 'telegram', via: 'mini_app' })
      .order('created_at', { ascending: false })
      .limit(rowLimit)

    if (fromMs !== null) query = query.gte('created_at', new Date(fromMs).toISOString())

    const { data } = await query
    return (data ?? []) as MediaRow[]
  },

  map(rows, { brandId, nowMs }) {
    return rows.flatMap<TimelineSourceEvent>((row) => {
      const atMs = toUtcMs(row.created_at)
      if (atMs === null) return []

      const transcribed = row.transcription_status === 'transcribed'
      const ageMs = nowMs - atMs
      const stage =
        row.transcription_status === 'failed'
          ? 'failed'
          : transcribed && ageMs > PROPOSAL_GRACE_MS
            ? 'no_draft'
            : transcribed
              ? 'ready'
              : 'listening'

      const clientEventId =
        typeof row.metadata?.client_event_id === 'string' ? row.metadata.client_event_id : null

      return [{
        id: `clip:${row.id}`,
        kind: 'media_upload' as const,
        groupParentId: null,
        occurredAtMs: atMs,
        side: 'owner' as const,
        brandId,
        clientEventId,
        payload: {
          kind: 'media_upload' as const,
          mediaItemId: row.id,
          fileName: row.file_name ?? 'file',
          fileType: row.file_type ?? '',
          thumbnailUrl: row.thumbnail_url,
          stage,
          transcriptionStatus: row.transcription_status,
          uploadPercent: 100,
          containedByEventId: null,
        },
      }]
    })
  },
}

interface OutputRow {
  id: string
  title: string | null
  content: string | null
  metadata: Record<string, unknown> | null
  is_approved: boolean | null
  created_at: string
}

/**
 * First-pass posts written about a clip.
 *
 * Joined back to the clip through `metadata.media_item_ids`, which our own code
 * writes — not a model — so the link is reliable. A proposal whose clip is
 * outside the window stands on its own rather than disappearing.
 */
export const proposalSource: TimelineSource<OutputRow> = {
  name: 'proposals',

  async fetch({ admin, userId, brandId, fromMs, rowLimit }) {
    let query = admin
      .from('outputs')
      .select('id, title, content, metadata, is_approved, created_at')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .eq('output_type', 'social_post')
      .order('created_at', { ascending: false })
      .limit(rowLimit)

    if (fromMs !== null) query = query.gte('created_at', new Date(fromMs).toISOString())

    const { data } = await query
    return (data ?? []) as OutputRow[]
  },

  map(rows, { brandId }) {
    return rows.flatMap<TimelineSourceEvent>((row) => {
      const meta = row.metadata ?? {}
      if (meta.stage !== 'proposal') return []

      const atMs = toUtcMs(row.created_at)
      const carousel = carouselDeliveryFromProposal(row)
      if (carousel) {
        return [{
          id: `carousel-output:${row.id}`,
          kind: 'carousel_delivery' as const,
          groupParentId: null,
          occurredAtMs: atMs,
          side: 'director' as const,
          brandId,
          payload: {
            kind: 'carousel_delivery' as const,
            jobId: `proposal:${row.id}`,
            title: carousel.title,
            outputId: carousel.outputId,
            platform: carousel.platform,
            caption: carousel.caption,
            hashtags: carousel.hashtags,
            slides: carousel.slides,
            approved: Boolean(row.is_approved),
            mixpost: (() => {
              const draft = meta.carousel_draft
              if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null
              const state = (draft as Record<string, unknown>).mixpost
              return state === 'synced' || state === 'pending' || state === 'failed' || state === 'skipped' || state === 'duplicate'
                ? state
                : null
            })(),
          },
        }]
      }

      const mediaItemIds = Array.isArray(meta.media_item_ids)
        ? meta.media_item_ids.filter((id): id is string => typeof id === 'string')
        : []

      return [{
        id: `output:${row.id}`,
        kind: 'proposal' as const,
        groupParentId: mediaItemIds.length > 0 ? `clip:${mediaItemIds[0]}` : null,
        occurredAtMs: atMs,
        side: 'director' as const,
        brandId,
        payload: {
          kind: 'proposal' as const,
          outputId: row.id,
          mediaItemIds,
          aboutFileName: typeof meta.file_name === 'string' ? meta.file_name : null,
          opener: typeof meta.opener === 'string' ? meta.opener : '',
          hook: typeof meta.hook === 'string' ? meta.hook : (row.title ?? ''),
          caption: row.content ?? '',
          hashtags: Array.isArray(meta.hashtags)
            ? meta.hashtags.filter((tag): tag is string => typeof tag === 'string')
            : [],
          postType: typeof meta.post_type === 'string' ? meta.post_type : 'single',
          approved: Boolean(row.is_approved),
          withheld: false,
        },
      }]
    })
  },
}

/** Every source the timeline is built from. Add one here and it appears. */
export const TELEGRAM_TIMELINE_SOURCES: readonly TimelineSource<never>[] = [
  directorJobSource,
  miniAppMediaSource,
  proposalSource,
] as unknown as readonly TimelineSource<never>[]
