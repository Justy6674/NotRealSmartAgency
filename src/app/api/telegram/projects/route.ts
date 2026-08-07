/**
 * Which projects are switched on in Telegram, and the switch itself.
 *
 * Fourteen projects in a picker is a list nobody reads. This is the owner's
 * on/off per project — it drives the Mini App's picker, the webhook's project
 * list, and which projects get a forum topic, so one switch means the same
 * thing everywhere.
 *
 * The same field fences a second person to their brands, which is why the
 * response says whose account each row belongs to.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { readBrandFence } from '@/lib/telegram/project-fence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface TelegramAccountRow {
  id: string
  telegram_user_id: string
  label: string | null
  allowed_brand_ids: string[] | null
}

/**
 * Read the caller's projects and every Telegram account that acts as them.
 *
 * RLS decides which brands come back, so an account can never be shown or
 * given a project its owner cannot see.
 */
async function loadState(userId: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: brands }, { data: accounts }] = await Promise.all([
    supabase.from('brands').select('id, name').order('name'),
    admin
      .from('telegram_accounts')
      .select('id, telegram_user_id, label, allowed_brand_ids')
      .eq('actor_user_id', userId)
      .is('revoked_at', null)
      .order('created_at'),
  ])

  return {
    brands: (brands ?? []) as Array<{ id: string; name: string }>,
    accounts: (accounts ?? []) as TelegramAccountRow[],
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { brands, accounts } = await loadState(user.id)

  return NextResponse.json({
    accounts: accounts.map((account) => {
      const fence = readBrandFence(account.allowed_brand_ids)
      return {
        id: account.id,
        label: account.label ?? 'This Telegram account',
        telegram_user_id: account.telegram_user_id,
        // No fence means every project — say that as every project being on,
        // rather than as an empty list, which reads as nothing being on.
        all_projects: fence === null,
        projects: brands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          enabled: fence === null ? true : fence.has(brand.id),
        })),
      }
    }),
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => null) as
    | { account_id?: unknown; brand_ids?: unknown; all_projects?: unknown }
    | null

  const accountId = typeof body?.account_id === 'string' ? body.account_id : ''
  if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })

  const { brands, accounts } = await loadState(user.id)

  // The account must belong to the caller. Reading it back through the same
  // owner-scoped query is the check — a client-supplied id cannot reach
  // somebody else's pairing.
  const account = accounts.find((candidate) => candidate.id === accountId)
  if (!account) {
    return NextResponse.json({ error: 'That Telegram account is not yours to change.' }, { status: 403 })
  }

  // "Everything on" is stored as no fence, so a project added later is on by
  // default rather than silently missing from a frozen list.
  if (body?.all_projects === true) {
    const { error } = await createAdminClient()
      .from('telegram_accounts')
      .update({ allowed_brand_ids: null })
      .eq('id', account.id)
    if (error) return NextResponse.json({ error: 'Could not save that change.' }, { status: 500 })
    return NextResponse.json({ all_projects: true, enabled_count: brands.length })
  }

  const requested = Array.isArray(body?.brand_ids)
    ? body.brand_ids.filter((id): id is string => typeof id === 'string')
    : []

  // Only ids the caller actually owns. RLS already decided that set above.
  const ownIds = new Set(brands.map((brand) => brand.id))
  const brandIds = [...new Set(requested)].filter((id) => ownIds.has(id))

  if (brandIds.length === 0) {
    return NextResponse.json(
      { error: 'Leave at least one project switched on, or turn all of them on.' },
      { status: 400 },
    )
  }

  const { error } = await createAdminClient()
    .from('telegram_accounts')
    .update({ allowed_brand_ids: brandIds })
    .eq('id', account.id)

  if (error) return NextResponse.json({ error: 'Could not save that change.' }, { status: 500 })

  return NextResponse.json({ all_projects: false, enabled_count: brandIds.length })
}
