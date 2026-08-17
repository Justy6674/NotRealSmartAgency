import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import type {
  InboxAccount,
  InboxItem,
  InboxResponse,
  InboxState,
} from '@/components/agency/inbox/types'

export const dynamic = 'force-dynamic'

const ZERNIO_BASE = 'https://zernio.com/api/v1'

/** How many conversations to read. Each one costs a second upstream call. */
const CONVERSATION_LIMIT = 50

/** Upstream is a third party on someone else's network. Never hang the page. */
const TIMEOUT_MS = 9000

/**
 * GET /api/inbox
 *
 * Every social conversation the connected accounts can see, with one honest
 * judgement per row: is this waiting on a person, or has it been answered.
 *
 * Two decisions worth stating plainly.
 *
 * First, this reads the Zernio API rather than the `tasks` table. The webhook
 * that was meant to fill `tasks` has never inserted a row — its brand lookup
 * searches for "scentsell" while the brand is "Scent Sell", it writes a status
 * that is not in the enum, and it puts a string in a uuid column. None of it is
 * error-checked. Reading `tasks` would render an empty page forever while
 * twenty real conversations sat one API call away.
 *
 * Second, this route is session-scoped. Every existing /api/zernio/* route uses
 * the service-role key with no session check, so anyone who can reach the URL
 * reads another tenant's data. That is not repeated here.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const brandId = new URL(request.url).searchParams.get('brandId')

  const empty = (unavailable: InboxResponse['unavailable']): InboxResponse => ({
    items: [],
    accounts: [],
    unavailable,
    scope: 'workspace',
    accountsFailed: 0,
  })

  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(empty('not_configured'))
  }

  const headers = { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` }
  const get = async (path: string) => {
    const res = await fetch(`${ZERNIO_BASE}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      // The body is upstream's internals and several of them echo request
      // detail back. It goes to the log, never to the browser.
      throw new Error(`Zernio ${path} ${res.status}: ${await res.text().catch(() => '')}`)
    }
    return res.json()
  }

  try {
    // The brand→Zernio link. Absent on the live Scent Sell brand, which is why
    // the response carries a scope rather than silently showing everything.
    let profileId: string | null = null
    if (brandId) {
      const { data: brand } = await supabase
        .from('brands')
        .select('social_urls')
        .eq('id', brandId)
        .eq('user_id', user.id)
        .maybeSingle()
      const urls = (brand?.social_urls ?? {}) as Record<string, unknown>
      if (typeof urls.zernio_profile_id === 'string' && urls.zernio_profile_id) {
        profileId = urls.zernio_profile_id
      }
    }

    const accountsBody = await get('/accounts')
    const rawAccounts: Record<string, unknown>[] = Array.isArray(accountsBody?.accounts)
      ? accountsBody.accounts
      : []

    // Zernio returns ads-only accounts in the same list as posting accounts,
    // and accounts it auto-created with `enabled: false` that the scheduler
    // ignores. Neither can hold a conversation.
    const accounts: InboxAccount[] = rawAccounts
      .filter((a) => a.enabled !== false && !String(a.platform ?? '').endsWith('ads'))
      .filter((a) => !profileId || resolveProfileId(a.profileId) === profileId)
      .map((a) => ({
        // Upstream ids are Mongo-style `_id`. Reading `.id` yields undefined,
        // which is how the publish path ended up sending no account at all.
        id: String(a._id ?? a.id ?? ''),
        platform: String(a.platform ?? 'unknown'),
        username: typeof a.username === 'string' ? a.username : null,
        needsReconnection: a.needsReconnection === true,
      }))
      .filter((a) => a.id)

    if (accounts.length === 0) {
      return NextResponse.json({ ...empty('no_accounts'), scope: profileId ? 'brand' : 'workspace' })
    }

    const query = new URLSearchParams({ limit: String(CONVERSATION_LIMIT) })
    if (profileId) query.set('profileId', profileId)
    const listBody = await get(`/inbox/conversations?${query.toString()}`)

    const conversations: Record<string, unknown>[] = Array.isArray(listBody?.data) ? listBody.data : []
    const accountsFailed = Number(listBody?.meta?.accountsFailed ?? 0) || 0

    // Which conversations NRS itself has replied to. This is the only evidence
    // that would ever justify saying the Director handled something, and there
    // are zero such rows today — `zernio_reply` writes to `outputs` with an
    // `agent_id` column that does not exist, so the insert always fails and is
    // never checked. Left in place because it is the correct join the moment
    // that write is repaired, and because guessing is the alternative.
    const handledIds = new Set<string>()
    const { data: replies } = await supabase
      .from('outputs')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('content_type', 'dm_reply')
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

    // Whether the customer or the account spoke last is the entire distinction
    // this page exists to draw, and the conversation list does not carry it.
    // One extra call each, in parallel: twenty of them take about a second.
    // `sortOrder=desc` matters — the default is ascending, so `limit=1` alone
    // returns the OLDEST message and every row would read as stale.
    const items: InboxItem[] = await Promise.all(
      conversations.map(async (c) => {
        const id = String(c.id ?? '')
        const accountId = String(c.accountId ?? '')
        let direction: string | null = null

        if (id && accountId) {
          try {
            const thread = await get(
              `/inbox/conversations/${encodeURIComponent(id)}/messages` +
                `?accountId=${encodeURIComponent(accountId)}&limit=1&sortOrder=desc`,
            )
            // The thread array is `messages`, not `data`. Reading `.data` here
            // yields an empty array and every row silently reads as unknown.
            const last = Array.isArray(thread?.messages) ? thread.messages[0] : null
            if (last && typeof last.direction === 'string') direction = last.direction
          } catch (err) {
            console.error('[inbox] last message', err)
          }
        }

        const preview = typeof c.lastMessage === 'string' ? c.lastMessage : ''
        // Media-only messages arrive as the literal text "[Attachment]" or as
        // an empty string, and `attachments` is [] in both cases — so the
        // array cannot be used to detect media.
        const isMedia = preview.trim() === '[Attachment]' || preview.trim() === ''

        // An unreadable thread is reported as needing a person rather than as
        // answered. Being asked to look at something already dealt with costs
        // a moment; silently filing a waiting customer as done costs the sale.
        const state: InboxState =
          direction === 'outgoing'
            ? handledIds.has(id) ? 'handled' : 'answered'
            : 'needs_you'

        return {
          id,
          accountId,
          accountUsername: typeof c.accountUsername === 'string' ? c.accountUsername : null,
          platform: String(c.platform ?? 'unknown'),
          participantName: typeof c.participantName === 'string' ? c.participantName : null,
          participantUsername:
            typeof c.participantUsername === 'string' ? c.participantUsername : null,
          participantPicture:
            typeof c.participantPicture === 'string' ? c.participantPicture : null,
          lastMessage: isMedia ? null : preview,
          lastMessageIsMedia: isMedia,
          updatedAt: typeof c.updatedTime === 'string' ? c.updatedTime : null,
          state,
          url: typeof c.url === 'string' && c.url ? c.url : null,
        }
      }),
    )

    items.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

    const body: InboxResponse = {
      items,
      accounts,
      unavailable: null,
      scope: profileId ? 'brand' : 'workspace',
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

/** `profileId` comes back as either an id or a populated object. */
function resolveProfileId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const id = (value as Record<string, unknown>)._id
    if (typeof id === 'string') return id
  }
  return null
}
