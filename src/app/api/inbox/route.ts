import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { getZernioClient } from '@/lib/zernio/client'
import { unwrapZernio } from '@/lib/zernio/errors'
import { fetchZernioAccountsHealth } from '@/lib/zernio/accounts'
import { zernioIdOf } from '@/lib/zernio/types'
import {
  fetchZernioConversationMessages,
  markZernioConversationRead,
  sendZernioMessage,
  setZernioConversationStatus,
} from '@/lib/zernio/engagement'
import {
  brandOwnsAccount,
  loadOutboundBrandContext,
  recordOutboundReply,
  reviewOutboundWords,
} from '@/lib/agents/tools/zernio-reply'
import type {
  InboxAccount,
  InboxItem,
  InboxResponse,
  InboxState,
  DeskMessage,
} from '@/components/agency/inbox/types'

export const dynamic = 'force-dynamic'

/** How many conversations to read. One upstream call, whatever this is. */
const CONVERSATION_LIMIT = 50

/**
 * GET /api/inbox
 *
 * Every social conversation the connected accounts can see, with one honest
 * judgement per row: is this waiting on a person, or has it been answered.
 *
 * ── What changed, and why it mattered ──────────────────────────────────
 * This route used to fetch the last message of EVERY conversation, one call
 * each, purely to learn who spoke last — fifty conversations meant fifty-one
 * upstream calls, every page load, on a nine-second timeout each. The list rows
 * already carry `unreadCount`, which answers the same question for nothing, and
 * several of them carry the direction of the last message outright. Both are
 * read here; the per-conversation fetch is gone.
 *
 * The judgement is deliberately cautious in the same direction as before. An
 * unread count above zero, or an explicit incoming last message, is reported as
 * waiting. Being asked to look at something already dealt with costs a moment;
 * silently filing a waiting customer as done costs the sale. What it cannot see
 * is a message the owner read on his phone without answering — the platform's
 * own unread count goes to zero when he opens it, and no API anywhere reports
 * "read but ignored".
 *
 * ── Two things this route will not do ──────────────────────────────────
 * It will not claim the Director handled something without a record that NRS
 * itself sent the words. And it will not read another tenant's conversations:
 * the account list is filtered to the brand's own profile in our code, because
 * upstream validates account ids against the whole team rather than the profile.
 *
 * ── Why this refuses rather than falls back ────────────────────────────
 * It used to resolve the brand's publisher profile *optionally*: no `brandId`,
 * or a brand never linked to a profile, left `profileId` null — and null was
 * then passed to every filter as "no filter". The account health read answered
 * for the whole team, the conversation list went out unscoped, the ownership
 * check was skipped by an `if (profileId && …)`, and the row filter compared
 * against a set that by then held every account in the team. Twelve of fourteen
 * brands have no profile, so that was the ordinary path, not an edge: one
 * customer's desk showed another customer's private messages.
 *
 * Everything below therefore fails CLOSED. No resolved profile is a refusal,
 * exactly as POST refuses. A row whose account id cannot be read is dropped
 * rather than kept — an unattributable conversation is the one most likely to
 * belong to somebody else. Tenant isolation is ours; a Zernio response is never
 * the thing that decides whose data this is.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const conversationId = searchParams.get('conversationId')
  const accountId = searchParams.get('accountId')

  const empty = (unavailable: InboxResponse['unavailable']): InboxResponse => ({
    items: [],
    accounts: [],
    unavailable,
    // Never 'workspace'. Every answer this route gives is scoped to one
    // business's own accounts or is empty, so nothing here may imply a
    // team-wide read the page would then print as fact.
    scope: 'brand',
    accountsFailed: 0,
  })

  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(empty('not_configured'))
  }

  try {
    // A business, always. Without one there is nobody to scope to, and the only
    // safe reading of "which conversations may I see" with no answer is none.
    if (!brandId) {
      return NextResponse.json(
        {
          ...empty('no_accounts'),
          error: 'Choose a business first — messages are only ever read for one business at a time.',
        },
        { status: 400 },
      )
    }

    const access = await loadOutboundBrandContext(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json(
        { error: 'That business could not be opened under this sign-in.' },
        { status: 403 },
      )
    }

    // The brand→publisher link. Absent on most brands, and its absence means
    // this business owns no accounts here — never "show everything".
    const profileId = access.brand.profileId
    if (!profileId) {
      return NextResponse.json({
        ...empty('no_accounts'),
        error:
          'This business is not connected to its own social accounts yet, so there are no messages to read for it.',
      })
    }

    // One thread, for the desk's reading pane.
    if (conversationId && accountId) {
      if (!(await brandOwnsAccount(profileId, accountId))) {
        return NextResponse.json(
          { error: 'That conversation could not be opened under this sign-in.' },
          { status: 403 },
        )
      }
      const thread = await fetchZernioConversationMessages({
        conversationId,
        accountId,
        limit: 50,
      })
      const rows = Array.isArray(thread.messages)
        ? thread.messages
        : Array.isArray(thread.data)
          ? thread.data
          : []
      return NextResponse.json({ messages: rows.map(threadMessageOf) })
    }

    // Scoped to this brand's profile inside fetchZernioAccountsHealth, in our
    // own code — the unfiltered upstream call answers for the whole team.
    const health = await fetchZernioAccountsHealth(profileId)

    // Ads-only accounts arrive in the same list as posting accounts and cannot
    // hold a conversation. An account with no readable id is dropped with them:
    // it could not be matched against a conversation row anyway, and keeping it
    // would only widen the set the row filter checks against.
    const accounts: InboxAccount[] = health.accounts
      .filter((account) => !!account.accountId && !account.platform.endsWith('ads'))
      .map((account) => ({
        id: account.accountId,
        platform: account.platform,
        username: account.username ?? account.displayName ?? null,
        needsReconnection: account.needsReconnect,
      }))

    if (accounts.length === 0) {
      return NextResponse.json(empty('no_accounts'))
    }

    const zernio = getZernioClient('messages.listInboxConversations')
    const result = await zernio.messages.listInboxConversations({
      query: {
        // Sent, but never trusted: measured live, upstream accepts a profile
        // filter on the accounts listing and ignores it. The row filter below
        // is what actually keeps another tenant's threads off this page.
        profileId,
        limit: CONVERSATION_LIMIT,
      },
    })
    // The typed wrapper in lib/zernio/engagement normalises these rows to the
    // fields the desk counts with, and drops the participant identity and
    // message preview this page prints. Rather than widen a module another
    // slice owns, the raw rows are read here and normalised into InboxItem,
    // which is this route's own contract.
    const listBody = unwrapZernio<Record<string, unknown>>(
      'messages.listInboxConversations',
      result as never,
    )
    const conversations: Record<string, unknown>[] = Array.isArray(listBody.data)
      ? (listBody.data as Record<string, unknown>[])
      : Array.isArray(listBody.conversations)
        ? (listBody.conversations as Record<string, unknown>[])
        : []
    const meta = (listBody.meta ?? {}) as Record<string, unknown>
    const accountsFailed = typeof meta.accountsFailed === 'number' ? meta.accountsFailed : 0

    // Conversations belonging to accounts this brand does not own never reach
    // the page, whatever upstream chose to return for the profile filter.
    const ownAccountIds = new Set(accounts.map((account) => account.id))
    if (ownAccountIds.size === 0) {
      return NextResponse.json(empty('no_accounts'))
    }

    // Which conversations NRS itself has replied to — the only evidence that
    // would ever justify saying the Director handled something. The previous
    // version of this query filtered on a `content_type` column that does not
    // exist, so it errored on every request and the set was always empty.
    const handledIds = new Set<string>()
    const { data: replies } = await supabase
      .from('outputs')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('output_type', 'other')
      .not('metadata->>zernio_conversation_id', 'is', null)
      .limit(500)
    for (const row of replies ?? []) {
      const id = (row.metadata as Record<string, unknown> | null)?.zernio_conversation_id
      if (typeof id === 'string') handledIds.add(id)
    }

    // The webhook path, for when it starts working. Costs one indexed read.
    const { data: tasks } = await supabase
      .from('tasks')
      .select('context')
      .eq('user_id', user.id)
      .not('context->>zernio_conversation_id', 'is', null)
      .limit(500)
    for (const row of tasks ?? []) {
      const context = (row.context ?? {}) as Record<string, unknown>
      if (context.replied_by === 'nrs' && typeof context.zernio_conversation_id === 'string') {
        handledIds.add(context.zernio_conversation_id)
      }
    }

    const items: InboxItem[] = conversations.flatMap((c) => {
      // `accountId` is sometimes a populated `{_id, name}` object and sometimes
      // a string, per endpoint — zernioIdOf reads both, and answers '' for
      // anything it cannot read. An empty answer is a row that cannot be
      // attributed to an account, so it is DROPPED: the previous filter kept
      // those (`if (rowAccountId && !own.has(…))`), which failed open on
      // exactly the rows least likely to be this brand's.
      const id = zernioIdOf(c)
      const rowAccountId = zernioIdOf(c.accountId)
      if (!id) return []
      if (!rowAccountId || !ownAccountIds.has(rowAccountId)) return []

      const preview = typeof c.lastMessage === 'string' ? c.lastMessage : ''
      // Media-only messages arrive as the literal text "[Attachment]" or as an
      // empty string, and `attachments` is [] in both cases — so the array
      // cannot be used to detect media.
      const isMedia = preview.trim() === '[Attachment]' || preview.trim() === ''

      const unread = typeof c.unreadCount === 'number' ? c.unreadCount : 0
      const direction =
        typeof c.lastMessageDirection === 'string'
          ? c.lastMessageDirection
          : typeof c.direction === 'string'
            ? c.direction
            : null

      const waiting = direction ? direction !== 'outgoing' : unread > 0
      const state: InboxState = waiting
        ? 'needs_you'
        : handledIds.has(id)
          ? 'handled'
          : 'answered'

      return [{
        id,
        accountId: rowAccountId,
        accountUsername: typeof c.accountUsername === 'string' ? c.accountUsername : null,
        platform: String(c.platform ?? 'unknown'),
        participantName: typeof c.participantName === 'string' ? c.participantName : null,
        participantUsername:
          typeof c.participantUsername === 'string' ? c.participantUsername : null,
        participantPicture:
          typeof c.participantPicture === 'string' ? c.participantPicture : null,
        lastMessage: isMedia ? null : preview,
        lastMessageIsMedia: isMedia,
        updatedAt: typeof c.updatedTime === 'string'
          ? c.updatedTime
          : typeof c.lastMessageAt === 'string'
            ? c.lastMessageAt
            : null,
        state,
        url: typeof c.url === 'string' && c.url ? c.url : null,
      }]
    })

    items.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

    const body: InboxResponse = {
      items,
      accounts,
      unavailable: null,
      // Always brand: this route cannot reach a conversation it has not scoped
      // to one business's own accounts, so there is no workspace-wide read left
      // for the page to warn about.
      scope: 'brand',
      accountsFailed,
    }
    return NextResponse.json(body)
  } catch (err) {
    return NextResponse.json({
      ...empty('unreachable'),
      error: userSafeError(
        'inbox',
        err,
        'Your social messages could not be read just now. Nothing has been missed — try again in a moment.',
      ),
    })
  }
}

/**
 * POST /api/inbox
 *
 * Send a reply, mark a conversation read, or archive it.
 *
 * A direct message from a clinic is not private correspondence in the
 * regulatory sense — it answers an enquiry about a regulated service in the
 * brand's own words — so the words pass the same review as a post before they
 * leave, and the sending wrapper cannot be called without the proof.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const brandId = typeof body.brandId === 'string' ? body.brandId : null
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : null
    const accountId = typeof body.accountId === 'string' ? body.accountId : null
    const action = typeof body.action === 'string' ? body.action : 'reply'
    const message = typeof body.message === 'string' ? body.message : ''

    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a business first — replies are checked against that business’s rules.' },
        { status: 400 },
      )
    }
    if (!conversationId || !accountId) {
      return NextResponse.json({ error: 'That conversation could not be identified.' }, { status: 400 })
    }

    const access = await loadOutboundBrandContext(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ error: 'That business could not be opened under this sign-in.' }, { status: 403 })
    }

    const profileId = access.brand.profileId
    if (!profileId || !(await brandOwnsAccount(profileId, accountId))) {
      return NextResponse.json({ error: 'That business could not be opened under this sign-in.' }, { status: 403 })
    }

    if (action === 'mark_read') {
      await markZernioConversationRead({ conversationId, accountId })
      return NextResponse.json({ ok: true })
    }

    if (action === 'archive' || action === 'unarchive') {
      await setZernioConversationStatus({
        conversationId,
        accountId,
        status: action === 'archive' ? 'archived' : 'active',
      })
      return NextResponse.json({ ok: true })
    }

    const review = await reviewOutboundWords({
      content: message,
      brand: access.brand,
      label: 'a direct message reply',
    })
    if (!review.allowed) {
      return NextResponse.json({ ok: false, blocked: true, reason: review.reason }, { status: 422 })
    }

    await sendZernioMessage({
      conversationId,
      accountId,
      message: message.trim(),
      approval: review.approval,
    })

    await recordOutboundReply(supabase, {
      userId: user.id,
      brandId,
      content: message.trim(),
      title: 'Message reply',
      metadata: { zernio_conversation_id: conversationId, zernio_account_id: accountId },
    })

    return NextResponse.json({ ok: true, warnings: review.warnings })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: userSafeError(
          'api/inbox POST',
          err,
          'The reply could not be sent just now. Nothing was sent — try again in a moment.',
        ),
      },
      { status: 500 },
    )
  }
}

function threadMessageOf(raw: unknown): DeskMessage {
  const rec = (raw ?? {}) as Record<string, unknown>
  const direction = typeof rec.direction === 'string' ? rec.direction : ''
  const attachments = Array.isArray(rec.attachments) ? rec.attachments : []
  const firstAttachment = (attachments[0] ?? {}) as Record<string, unknown>
  return {
    id: String(rec.id ?? rec._id ?? Math.random().toString(36).slice(2)),
    text: typeof rec.text === 'string'
      ? rec.text
      : typeof rec.message === 'string'
        ? rec.message
        : '',
    incoming: direction !== 'outgoing',
    at: typeof rec.createdTime === 'string'
      ? rec.createdTime
      : typeof rec.createdAt === 'string'
        ? rec.createdAt
        : null,
    attachmentUrl: typeof firstAttachment.url === 'string' ? firstAttachment.url : null,
  }
}
