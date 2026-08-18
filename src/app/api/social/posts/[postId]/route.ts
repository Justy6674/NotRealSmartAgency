/**
 * One post, and the four things a row can do to it.
 *
 * Reschedule · Retry · Take down from the platform · Delete.
 *
 * ── Why the delete is three-way ────────────────────────────────────────
 * "Delete" means two different things and conflating them is how a business
 * ends up with a post live on Instagram that its own desk says is gone. So the
 * caller has to say which:
 *
 *   `app`      — remove it from this desk. The live post stays up.
 *   `platform` — take the live post down. The record stays here.
 *   `both`     — both.
 *
 * The platform arm is the one NRS had no equivalent of at all before this. For
 * four businesses advertising regulated health services it is the only way to
 * act on an AHPRA or TGA complaint about something already public: without it
 * the honest answer to "take that down" was "open the app on your phone".
 * Ten platforms support it; the rest are named plainly as needing a hand.
 *
 * ── Two kinds of id ────────────────────────────────────────────────────
 * A uuid is a row this desk made — ownership comes from RLS on
 * `scheduled_posts`. Anything else is a published-history id, which no table
 * here knows about; ownership for those is established by resolving the
 * business's own profile and checking the post sits on one of its accounts. A
 * history id with no `brandId` alongside it is refused rather than guessed at.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import {
  deleteZernioPost,
  getZernioPost,
  retryZernioPost,
  unpublishZernioPost,
  updateZernioPost,
  type ZernioPostRecord,
} from '@/lib/zernio/posts'
import { isZernioUnpublishPlatform } from '@/lib/zernio/types'
import { userSafeError } from '@/lib/errors/user-safe'

export const runtime = 'nodejs'
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Resolved {
  kind: 'desk' | 'history'
  /** The publisher's id for this post, when there is one. */
  publisherId: string | null
  deskRow: Record<string, unknown> | null
  historyPost: ZernioPostRecord | null
  brandId: string | null
  profileId: string | null
}

type Failure = { error: string; status: number }

function isFailure(value: Resolved | Failure): value is Failure {
  return (value as Failure).error !== undefined
}

async function profileIdForBrand(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('brands')
    .select('social_urls')
    .eq('id', brandId)
    .maybeSingle()
  return zernioProfileIdFromSocialUrls(data?.social_urls)
}

/**
 * Work out what this id is and whether the caller is allowed near it.
 *
 * There is no path through here that reaches the publisher without either RLS
 * having handed us the row, or the post having been proved to sit on an account
 * belonging to a business the caller can already read.
 */
async function resolve(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  brandIdHint: string | null,
): Promise<Resolved | Failure> {
  if (UUID.test(postId)) {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .maybeSingle()
    if (error) return { error: 'That post could not be read.', status: 500 }
    if (!data) return { error: 'That post could not be found.', status: 404 }

    const brandId = data.brand_id as string
    return {
      kind: 'desk',
      publisherId: typeof data.external_post_id === 'string' ? data.external_post_id : null,
      deskRow: data as Record<string, unknown>,
      historyPost: null,
      brandId,
      profileId: await profileIdForBrand(supabase, brandId),
    }
  }

  if (!brandIdHint) {
    return {
      error: 'Say which business this post belongs to before changing it.',
      status: 400,
    }
  }

  const profileId = await profileIdForBrand(supabase, brandIdHint)
  if (!profileId) {
    // Either the business is not readable by this caller (the select above
    // returns nothing under RLS) or it has no publishing connection. Either way
    // there is nothing to act on and no reason to distinguish the two out loud.
    return { error: 'That post could not be found.', status: 404 }
  }

  const post = await getZernioPost(postId)
  if (!post) return { error: 'That post could not be found.', status: 404 }

  // Ownership, decided here rather than upstream. A profile is an
  // organisational boundary and never a security one, so the accounts the post
  // went to are checked against the accounts this business owns.
  const own = await fetchZernioAccounts(profileId)
  const allowed = new Set(own.map((account) => account.id))
  if (!post.accountIds.some((id) => allowed.has(id))) {
    return { error: 'That post could not be found.', status: 404 }
  }

  return {
    kind: 'history',
    publisherId: post.id,
    deskRow: null,
    historyPost: post,
    brandId: brandIdHint,
    profileId,
  }
}

/* ── PATCH — move it to another time ─────────────────────────────────────── */

const PatchSchema = z.object({
  action: z.literal('reschedule'),
  brandId: z.string().uuid().optional(),
  /** Full ISO instant. The picker builds it; nobody types it. */
  scheduledFor: z.string(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const when = new Date(parsed.data.scheduledFor)
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: 'That is not a time we can use.' }, { status: 400 })
  }

  const found = await resolve(supabase, postId, parsed.data.brandId ?? null)
  if (isFailure(found)) return NextResponse.json({ error: found.error }, { status: found.status })

  try {
    if (found.kind === 'desk') {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ scheduled_at: when.toISOString(), status: 'scheduled' })
        .eq('id', postId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // The publisher holds its own copy of the time. Moving ours and not theirs
    // is how a post goes out at the old time while the desk shows the new one.
    if (found.publisherId) {
      await updateZernioPost({ postId: found.publisherId, scheduledFor: when.toISOString() })
    }

    return NextResponse.json({ ok: true, scheduledFor: when.toISOString() })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'social/posts/reschedule',
          err,
          'The new time could not be saved. Try again in a moment.',
        ),
      },
      { status: 502 },
    )
  }
}

/* ── POST — send it again ────────────────────────────────────────────────── */

const PostSchema = z.object({
  action: z.literal('retry'),
  brandId: z.string().uuid().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const found = await resolve(supabase, postId, parsed.data.brandId ?? null)
  if (isFailure(found)) return NextResponse.json({ error: found.error }, { status: found.status })

  try {
    /*
     * A desk row goes back through the ordinary publishing path, not through a
     * retry at the publisher.
     *
     * The retry-in-place shortcut is only honest while the words are unchanged
     * — that is the reasoning the dispatcher uses when it runs the regulatory
     * review on attempt 1 only. A row sitting on this desk can have been edited
     * since it failed, and for four regulated health businesses re-sending
     * edited copy without the review is exactly the thing the gate exists to
     * stop. Putting it back to `scheduled` hands it to the publish path, which
     * runs the gate on the text it is actually about to send.
     */
    if (found.kind === 'desk') {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ status: 'scheduled', error: null })
        .eq('id', postId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({
        ok: true,
        message: 'Back in the queue. It will go out automatically.',
      })
    }

    if (!found.publisherId) {
      return NextResponse.json({ error: 'There is nothing to send again.' }, { status: 400 })
    }
    await retryZernioPost(found.publisherId)
    return NextResponse.json({ ok: true, message: 'Sending again now.' })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'social/posts/retry',
          err,
          'That post could not be sent again just now. Try in a moment.',
        ),
      },
      { status: 502 },
    )
  }
}

/* ── DELETE — three arms ─────────────────────────────────────────────────── */

type DeleteScope = 'app' | 'platform' | 'both'

function scopeOf(value: string | null): DeleteScope | null {
  return value === 'app' || value === 'platform' || value === 'both' ? value : null
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const scope = scopeOf(searchParams.get('scope'))
  if (!scope) {
    return NextResponse.json(
      { error: 'Say whether to remove it here, from the platform, or both.' },
      { status: 400 },
    )
  }

  const found = await resolve(supabase, postId, searchParams.get('brandId'))
  if (isFailure(found)) return NextResponse.json({ error: found.error }, { status: found.status })

  const removedFrom: string[] = []
  const couldNotRemoveFrom: string[] = []
  let removedHere = false

  try {
    if (scope === 'platform' || scope === 'both') {
      // Which platforms the post actually reached. Asking the publisher to take
      // it down from a platform it never went to is a confusing error for
      // nobody's benefit.
      let targets = found.historyPost?.platforms ?? []
      if (targets.length === 0 && found.publisherId) {
        const live = await getZernioPost(found.publisherId)
        targets = live?.platforms ?? []
      }
      if (targets.length === 0 && found.deskRow) {
        const platform = String(found.deskRow.platform ?? '')
        if (platform) targets = [{ platform, accountId: '' }]
      }

      if (!found.publisherId) {
        return NextResponse.json(
          {
            error:
              'This post was never sent from here, so there is no live copy for us to take down.',
          },
          { status: 400 },
        )
      }

      for (const target of targets) {
        if (!isZernioUnpublishPlatform(target.platform)) {
          couldNotRemoveFrom.push(target.platform)
          continue
        }
        try {
          await unpublishZernioPost(found.publisherId, target.platform)
          removedFrom.push(target.platform)
        } catch (err) {
          console.error('[social/posts/delete] takedown failed', target.platform, err)
          couldNotRemoveFrom.push(target.platform)
        }
      }
    }

    if (scope === 'app' || scope === 'both') {
      if (found.kind === 'desk') {
        // Soft delete. Mixpost keeps a Trash tab and so do we: a post the owner
        // deleted by accident, on a desk where deleting is one click, is worth
        // more than the row it costs to keep.
        const { error } = await supabase
          .from('scheduled_posts')
          .update({ status: 'cancelled' })
          .eq('id', postId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        removedHere = true
      } else if (found.publisherId) {
        await deleteZernioPost(found.publisherId)
        removedHere = true
      }
    }

    return NextResponse.json({
      ok: true,
      removedHere,
      removedFrom,
      couldNotRemoveFrom,
      message: buildDeleteMessage(scope, removedHere, removedFrom, couldNotRemoveFrom),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'social/posts/delete',
          err,
          'That post could not be removed just now. Try again in a moment.',
        ),
      },
      { status: 502 },
    )
  }
}

/**
 * What actually happened, in one sentence the owner can act on.
 *
 * A takedown that half-worked has to say so. "Deleted" over a post still live
 * on one of three platforms is the single most expensive sentence this desk
 * could print for a regulated health business.
 */
function buildDeleteMessage(
  scope: DeleteScope,
  removedHere: boolean,
  removedFrom: string[],
  couldNotRemoveFrom: string[],
): string {
  const parts: string[] = []
  if (removedHere) parts.push('Removed from your posts')
  if (removedFrom.length > 0) parts.push(`taken down from ${removedFrom.join(', ')}`)
  if (parts.length === 0 && scope !== 'app') {
    parts.push('Nothing was taken down')
  }
  let message = parts.length > 0 ? `${parts.join(' and ')}.` : 'Nothing changed.'
  if (couldNotRemoveFrom.length > 0) {
    message += ` It is still live on ${couldNotRemoveFrom.join(', ')} — those have to be removed in the app itself.`
  }
  return message
}
