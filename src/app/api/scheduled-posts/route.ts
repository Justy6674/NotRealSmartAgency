import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createDraftPost } from '@/lib/posts/create-draft'
import {
  labelsForPosts,
  listBrandLabels,
  safeLabelColour,
  safeLabelName,
  setPostLabels,
  type PostLabel,
} from '@/lib/posts/post-labels'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import {
  accountsForDeskRow,
  connectedAccountsForBrand,
  type BrandForAccounts,
  type DeskConnectedAccount,
} from '@/lib/posts/desk-post-accounts'
import { fetchZernioAccounts, type ZernioAccount } from '@/lib/zernio/client'
import { listZernioPosts, type ZernioPostRecord } from '@/lib/zernio/posts'
import type { DeskPostStatus, SocialPostRow } from '@/hooks/usePostsList'
import { deskStatusOfDeskRow } from '@/lib/posts/desk-status'

// Publisher sync can take ~6 minutes per video transcode. Run on Node runtime
// (not edge) and bump maxDuration so the request doesn't time out before the
// sync completes. The sync itself is fired with `void` so the HTTP response
// returns immediately — but Vercel still needs the function context alive
// for the background work to finish.
export const runtime = 'nodejs'
export const maxDuration = 600

/**
 * How much published history the desk will pull in one go.
 *
 * The live account carries 210 posts published outside this app; a brand that
 * has been running for years could carry thousands. Five pages of 100 is enough
 * that no brand we have seen is truncated, and the response says plainly when
 * one is rather than quietly showing a short list.
 */
const HISTORY_PAGE = 100
const HISTORY_MAX_PAGES = 5

/* ── Owner-facing status ─────────────────────────────────────────────────── */

/**
 * The eight states the desk can show. The derivation itself lives in
 * `@/lib/posts/desk-status` and is imported, never restated: the sidebar
 * badge, the department tab strip, this route and the review screen all read
 * the same function, which is what stops them telling four different stories
 * about the same 121 rows. See that file for what "waiting on you" means and
 * why `failed` is not part of it.
 *
 * `partial` (some accounts took the post, some did not) belongs to published
 * history alone — no row of ours can be in it — so it is decided below.
 */

function deskStatusOfHistory(post: ZernioPostRecord): DeskPostStatus {
  switch (post.status) {
    case 'partial':
      return 'partial'
    case 'failed':
      return 'failed'
    case 'publishing':
      return 'publishing'
    case 'scheduled':
      return 'scheduled'
    case 'draft':
      return 'draft'
    default:
      return 'published'
  }
}

/* ── Row builders ────────────────────────────────────────────────────────── */

interface AccountLookup {
  id: string
  platform: string
  name: string
  /** The handle. Two accounts can share a display name; they cannot share this. */
  username: string | null
}

function deskRowToSocialPost(
  row: Record<string, unknown>,
  labels: PostLabel[],
  receipts: unknown[],
  connected: readonly DeskConnectedAccount[],
): SocialPostRow {
  const platform = String(row.platform ?? '')
  const mediaIds = Array.isArray(row.media_item_ids) ? (row.media_item_ids as string[]) : []
  const single = typeof row.media_item_id === 'string' ? row.media_item_id : null
  const allMedia = mediaIds.length > 0 ? mediaIds : single ? [single] : []
  const permalinks = (receipts as Array<Record<string, unknown>>)
    .map((run) => run.external_permalink)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  return {
    id: String(row.id),
    origin: 'desk',
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : null,
    platform,
    platforms: platform ? [platform] : [],
    caption: typeof row.caption === 'string' ? row.caption : '',
    hashtags: Array.isArray(row.hashtags) ? (row.hashtags as string[]) : [],
    scheduled_at: typeof row.scheduled_at === 'string' ? row.scheduled_at : null,
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
    status: deskStatusOfDeskRow(row),
    media_item_ids: allMedia,
    media_count: allMedia.length,
    thumbnail_url: null,
    external_post_id: typeof row.external_post_id === 'string' ? row.external_post_id : null,
    permalinks,
    labels,
    // Resolved from the accounts this business has connected — see
    // `accountsForDeskRow`. This used to be a hard-coded empty array, which is
    // why a draft never showed the page it was going to.
    accounts: accountsForDeskRow(row, connected),
    post_type: typeof row.post_type === 'string' ? row.post_type : null,
    error: typeof row.error === 'string' ? row.error : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    receipts: receipts as SocialPostRow['receipts'],
  }
}

function historyToSocialPost(post: ZernioPostRecord, accounts: Map<string, AccountLookup>): SocialPostRow {
  const platforms = Array.from(new Set(post.platforms.map((p) => p.platform).filter(Boolean)))
  const permalinks = post.platforms
    .map((p) => p.platformPostUrl)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  return {
    id: post.id,
    origin: 'history',
    brand_id: null,
    platform: platforms[0] ?? '',
    platforms,
    caption: post.content,
    hashtags: [],
    scheduled_at: post.scheduledFor ?? null,
    published_at: post.publishedAt ?? null,
    status: deskStatusOfHistory(post),
    media_item_ids: [],
    media_count: post.mediaItems.length,
    thumbnail_url: post.thumbnailUrl ?? post.mediaItems[0]?.thumbnail ?? post.mediaItems[0]?.url ?? null,
    external_post_id: post.id,
    permalinks,
    // History has no labels and cannot have any: a label hangs off a row this
    // desk made, and this post was published somewhere else. An empty cell is
    // the honest answer, not a missing feature.
    labels: [],
    accounts: post.platforms.map((target) => {
      const known = accounts.get(target.accountId)
      return {
        id: target.accountId,
        platform: target.platform,
        name: known?.name ?? target.platform,
        ...(known?.username ? { username: known.username } : {}),
      }
    }),
    post_type: null,
    error: null,
    metadata: post.metadata,
    receipts: [],
  }
}

/* ── History ─────────────────────────────────────────────────────────────── */

interface HistoryResult {
  rows: SocialPostRow[]
  total: number
  truncated: boolean
  /** Set when history could not be read at all — surfaced, never swallowed. */
  unavailable: string | null
}

async function readHistory(
  profileId: string | null,
  /** Already listed by the caller — the desk needs the same list for its own
   *  rows, and listing twice is a second round trip for one answer. */
  listed: ZernioAccount[] | null,
): Promise<HistoryResult> {
  if (!profileId) {
    return { rows: [], total: 0, truncated: false, unavailable: null }
  }

  try {
    const accountList = listed ?? (await fetchZernioAccounts(profileId))
    const accounts = new Map<string, AccountLookup>(
      accountList.map((account) => [
        account.id,
        {
          id: account.id,
          platform: account.platform,
          name: account.displayName || account.username || account.platform,
          username: account.username ?? null,
        },
      ]),
    )

    const rows: SocialPostRow[] = []
    let total = 0
    let truncated = false

    for (let page = 1; page <= HISTORY_MAX_PAGES; page++) {
      // `source` is named explicitly and always will be. The API's own default
      // is `zernio`, which returns zero rows on a brand with 210 published
      // posts — an empty screen with no error is the exact failure this list
      // was rebuilt to stop.
      const result = await listZernioPosts({
        source: 'external',
        profileId,
        sortBy: 'scheduled-desc',
        page,
        limit: HISTORY_PAGE,
      })
      total = result.pagination.total || total
      rows.push(...result.posts.map((post) => historyToSocialPost(post, accounts)))
      if (result.posts.length < HISTORY_PAGE) break
      if (page === HISTORY_MAX_PAGES && rows.length < total) truncated = true
    }

    return { rows, total: total || rows.length, truncated, unavailable: null }
  } catch (err) {
    console.error('[scheduled-posts] could not read published history:', err)
    return {
      rows: [],
      total: 0,
      truncated: false,
      unavailable:
        'Your published history could not be loaded just now. Everything you have made here is still shown below.',
    }
  }
}

/* ── GET ─────────────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')
  const idsParam = searchParams.get('ids')
  const wantsLabels = searchParams.get('labels') === '1'
  const wantsHistory = searchParams.get('history') === '1'

  // The label list for one business, for the picker and the filter dropdown.
  if (wantsLabels) {
    if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    try {
      return NextResponse.json(await listBrandLabels(supabase, brandId))
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not read labels' },
        { status: 500 },
      )
    }
  }

  const ids = (idsParam ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  // `ids` is the fix for the bulk bar. Duplicate used to GET `?ids=<id>` on a
  // route that required brandId, so every one of those requests 400'd, every
  // fetch returned null, zero posts were created and the bar reported success
  // having done nothing at all. RLS scopes the rows, so no brandId is needed
  // when the caller already names them.
  if (ids.length === 0 && !brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  let query = supabase
    .from('scheduled_posts')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (ids.length > 0) query = query.in('id', ids)
  if (brandId) query = query.eq('brand_id', brandId)
  if (from) query = query.gte('scheduled_at', from)
  if (to) query = query.lte('scheduled_at', to)
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
    query = statuses.length > 1 ? query.in('status', statuses) : query.eq('status', statuses[0])
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const posts = data ?? []
  const postIds = posts.map((row) => row.id as string)

  // Receipts live on publisher_runs (matched by external_post_id in the
  // webhook). The owner sees one line per ticked account, never a vendor name.
  const byPost = new Map<string, Array<Record<string, unknown>>>()
  if (postIds.length > 0) {
    const admin = createAdminClient()
    const { data: runs } = await admin
      .from('publisher_runs')
      .select('scheduled_post_id, account_id, platform, status, external_permalink, created_at')
      .in('scheduled_post_id', postIds)
      .order('created_at', { ascending: false })

    for (const run of runs ?? []) {
      const key = String(run.scheduled_post_id)
      const list = byPost.get(key) ?? []
      list.push(run as Record<string, unknown>)
      byPost.set(key, list)
    }
  }

  // The desk shape: one array of unified rows, published history included.
  // Everything else on the site still reads the plain `scheduled_posts` array,
  // so the old response stays exactly as it was.
  if (wantsHistory) {
    let labels = new Map<string, PostLabel[]>()
    try {
      labels = await labelsForPosts(supabase, postIds)
    } catch (err) {
      console.error('[scheduled-posts] could not read labels:', err)
    }

    let profileId: string | null = null
    let brand: BrandForAccounts | null = null
    if (brandId) {
      const { data } = await supabase
        .from('brands')
        .select('id, name, slug, social_urls')
        .eq('id', brandId)
        .maybeSingle()
      if (data) {
        brand = {
          id: String(data.id),
          name: String(data.name ?? ''),
          slug: String(data.slug ?? ''),
          social_urls: data.social_urls ?? null,
        }
      }
      profileId = zernioProfileIdFromSocialUrls(brand?.social_urls)
    }

    // Listed once and used twice: published history names the account a post
    // went to, and every desk row needs the same list to say where it is going.
    const zernioAccounts = profileId ? await fetchZernioAccounts(profileId) : null
    const connected = brand ? await connectedAccountsForBrand(brand, { zernioAccounts }) : []

    const history = await readHistory(profileId, zernioAccounts)

    // A history row that this desk also has a row for is the same post twice.
    // The desk's own row wins, because it is the one that can be edited,
    // labelled and taken down.
    const known = new Set(
      posts
        .map((row) => row.external_post_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    )

    const deskRows = posts.map((row) =>
      deskRowToSocialPost(
        row as Record<string, unknown>,
        labels.get(row.id as string) ?? [],
        byPost.get(row.id as string) ?? [],
        connected,
      ),
    )
    const historyRows = history.rows.filter((row) => !known.has(row.id))

    return NextResponse.json({
      posts: [...deskRows, ...historyRows],
      history: {
        total: history.total,
        shown: historyRows.length,
        truncated: history.truncated,
        unavailable: history.unavailable,
      },
    })
  }

  if (postIds.length === 0) return NextResponse.json(posts)

  return NextResponse.json(
    posts.map((post) => ({
      ...post,
      receipts: byPost.get(post.id as string) ?? [],
    })),
  )
}

/* ── PATCH ───────────────────────────────────────────────────────────────── */

const PatchSchema = z.object({
  id: z.string().uuid(),
  scheduled_at: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled']).optional(),
  post_type: z.enum(['single', 'carousel', 'reel', 'video']).optional(),
  media_item_ids: z.array(z.string().uuid()).optional(),
  content_type: z.enum(['entertainment', 'education', 'inspiration', 'promotional']).optional(),
  content_pillar: z.string().optional(),
  /**
   * The weekly posting time this post is taking.
   *
   * Sent when the owner presses "Add to next free time", so the row OWNS the
   * time it was given and the next post is offered the one after it. Null
   * clears it — a post moved to a time picked by hand no longer holds a slot.
   */
  queue_slot_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  /** Replaces the post's labels wholesale. Omit to leave them untouched. */
  labelIds: z.array(z.string().uuid()).optional(),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = PatchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { id, metadata: incomingMetadata, labelIds, ...updates } = parsed.data

  // Only include fields that were provided
  const fieldsToUpdate: Record<string, unknown> = {}
  if (updates.scheduled_at !== undefined) fieldsToUpdate.scheduled_at = updates.scheduled_at
  if (updates.caption !== undefined) fieldsToUpdate.caption = updates.caption
  if (updates.hashtags !== undefined) fieldsToUpdate.hashtags = updates.hashtags
  if (updates.status !== undefined) fieldsToUpdate.status = updates.status
  if (updates.post_type !== undefined) fieldsToUpdate.post_type = updates.post_type
  if (updates.media_item_ids !== undefined) fieldsToUpdate.media_item_ids = updates.media_item_ids
  if (updates.content_type !== undefined) fieldsToUpdate.content_type = updates.content_type
  if (updates.content_pillar !== undefined) fieldsToUpdate.content_pillar = updates.content_pillar
  if (updates.queue_slot_id !== undefined) fieldsToUpdate.queue_slot_id = updates.queue_slot_id

  // Deep merge metadata (fetch current, spread, update)
  if (incomingMetadata !== undefined) {
    const { data: current } = await supabase
      .from('scheduled_posts')
      .select('metadata')
      .eq('id', id)
      .single()

    fieldsToUpdate.metadata = {
      ...((current?.metadata as Record<string, unknown>) ?? {}),
      ...incomingMetadata,
    }
  }

  // An approval is a decision, and the desk needs to be able to tell an
  // approved draft from one nobody has looked at. Stamping it here means the
  // "Waiting on you" tab empties the moment the owner says yes.
  if (updates.status === 'scheduled' && incomingMetadata === undefined) {
    const { data: current } = await supabase
      .from('scheduled_posts')
      .select('metadata')
      .eq('id', id)
      .single()
    fieldsToUpdate.metadata = {
      ...((current?.metadata as Record<string, unknown>) ?? {}),
      approved_at: new Date().toISOString(),
    }
  }

  if (labelIds !== undefined) {
    const { data: owning, error: owningError } = await supabase
      .from('scheduled_posts')
      .select('id, brand_id')
      .eq('id', id)
      .single()
    if (owningError || !owning) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    try {
      await setPostLabels(supabase, {
        scheduledPostId: id,
        brandId: owning.brand_id as string,
        labelIds,
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Labels could not be saved' },
        { status: 500 },
      )
    }
    if (Object.keys(fieldsToUpdate).length === 0) {
      return NextResponse.json({ ...owning, labelIds })
    }
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scheduled_posts')
    .update(fieldsToUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/* ── POST ────────────────────────────────────────────────────────────────── */

const LabelCreateSchema = z.object({
  kind: z.literal('label'),
  brandId: z.string().uuid(),
  name: z.string(),
  colour: z.string().optional(),
})

const CreateSchema = z.object({
  brandId: z.string().uuid(),
  platform: z.enum(['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).optional().default([]),
  scheduled_at: z.string(),
  status: z.enum(['draft', 'scheduled']).optional().default('draft'),
  media_item_id: z.string().uuid().optional(),
  media_item_ids: z.array(z.string().uuid()).optional().default([]),
  post_type: z.enum(['single', 'carousel', 'reel', 'video']).optional().default('single'),
  content_type: z.enum(['entertainment', 'education', 'inspiration', 'promotional']).optional(),
  content_pillar: z.string().optional(),
  /**
   * The weekly posting time this post is taking, when it was given one.
   *
   * "Add to next free time" resolves a real time from the owner's week and
   * sends its id here, so `scheduled_posts.queue_slot_id` is written by the
   * canonical draft pipeline rather than left permanently null — which is what
   * made every per-time count on the schedule read 0 and let two posts be
   * offered the same minute.
   */
  queue_slot_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await request.json()

  // A new label for the business. Shares this route because labels only exist
  // to be put on these rows; giving them their own endpoint would separate them
  // from the only thing they attach to.
  const asLabel = LabelCreateSchema.safeParse(body)
  if (asLabel.success) {
    const name = safeLabelName(asLabel.data.name)
    if (!name) {
      return NextResponse.json({ error: 'Give the label a short name.' }, { status: 400 })
    }
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', asLabel.data.brandId)
      .maybeSingle()
    if (!brand) {
      return NextResponse.json({ error: 'Business not found' }, { status: 403 })
    }
    const { data, error } = await supabase
      .from('social_post_labels')
      .insert({
        brand_id: asLabel.data.brandId,
        owner_user_id: user.id,
        name,
        colour: safeLabelColour(asLabel.data.colour),
      })
      .select('id, name, colour')
      .single()
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You already have a label with that name.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  }

  const parsed = CreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { brandId, platform, caption, hashtags, scheduled_at, status, media_item_id, media_item_ids, post_type, content_type, content_pillar, queue_slot_id, metadata } = parsed.data

  // Verify brand belongs to the user
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', user.id)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found or access denied' }, { status: 403 })
  }

  // createDraftPost owns the insert AND the publisher push, so the browser and
  // every AI path create drafts the same way. awaitMixpost:false keeps this
  // route's reply instant — the Review tab already polls for the sync pill.
  let created
  try {
    created = await createDraftPost({
      supabase,
      userId: user.id,
      brandId,
      platform,
      caption,
      hashtags,
      mediaItemIds: media_item_ids ?? (media_item_id ? [media_item_id] : []),
      postType: post_type,
      status,
      scheduledAt: scheduled_at,
      ...(queue_slot_id ? { queueSlotId: queue_slot_id } : {}),
      metadata: metadata as Record<string, unknown> | undefined,
      contentType: content_type,
      contentPillar: content_pillar,
      awaitMixpost: false,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('scheduled_posts')
    .select()
    .eq('id', created.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Draft saved but could not be read back' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

/* ── DELETE (labels only) ────────────────────────────────────────────────── */

/**
 * Remove a label from the business.
 *
 * Posts are never deleted through this route — that is the three-way delete on
 * `/api/social/posts/[postId]`, which has to decide whether the live platform
 * copy comes down too. A label has no such consequence.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const labelId = searchParams.get('labelId')
  if (!labelId) {
    return NextResponse.json({ error: 'labelId is required' }, { status: 400 })
  }

  const { error } = await supabase.from('social_post_labels').delete().eq('id', labelId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
