import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyBrandFence } from './project-fence'

export interface TelegramMiniAppUser {
  id: string | number
  first_name?: string
  username?: string
}

export interface TelegramMiniAppAuth {
  telegramUserId: string
  user: TelegramMiniAppUser
  authDate: number
}

export interface TelegramMiniAppGrant {
  grantId: string
  projectId: string
  projectName: string
  capabilities: string[]
}

export interface TelegramMiniAppContext {
  auth: TelegramMiniAppAuth
  accountId: string
  actorUserId: string
  grants: TelegramMiniAppGrant[]
  activeSession: { grantId: string; projectId: string } | null
}

function equalHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

/** Validate Telegram's Web App initData before using any identity in it. */
export function validateTelegramMiniAppInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramMiniAppAuth | null {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  const authDate = Number(params.get('auth_date'))
  const userRaw = params.get('user')
  if (!receivedHash || !Number.isInteger(authDate) || !userRaw) return null
  if (authDate > nowSeconds + 60 || nowSeconds - authDate > 86_400) return null

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  if (!equalHex(receivedHash, calculatedHash)) return null

  try {
    const user = JSON.parse(userRaw) as TelegramMiniAppUser
    if (!user || typeof user.id !== 'number' && typeof user.id !== 'string') return null
    return { telegramUserId: String(user.id), user, authDate }
  } catch {
    return null
  }
}

type AdminClient = ReturnType<typeof createAdminClient>

export async function resolveTelegramMiniAppContext(
  admin: AdminClient,
  auth: TelegramMiniAppAuth,
): Promise<TelegramMiniAppContext | null> {
  const { data: account } = await admin
    .from('telegram_accounts')
    .select('id, actor_user_id, allowed_brand_ids')
    .eq('telegram_user_id', auth.telegramUserId)
    .is('revoked_at', null)
    .maybeSingle()
  if (!account) return null

  const { data: grantRows } = await admin
    .from('project_access_grants')
    .select('id, brand_id, capabilities, brands!inner(name)')
    .eq('actor_user_id', account.actor_user_id)
    .eq('channel', 'telegram')
    .eq('status', 'active')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  const allGrants = ((grantRows ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const brand = row.brands as { name?: unknown } | null
    if (typeof row.id !== 'string' || typeof row.brand_id !== 'string' || typeof brand?.name !== 'string') return []
    return [{
      grantId: row.id,
      projectId: row.brand_id,
      projectName: brand.name,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter((value): value is string => typeof value === 'string') : [],
    }]
  })

  // The same fence the webhook applies. It used to live only there — and the
  // webhook is the surface that receives nothing, while this one is the
  // surface people actually use, so a fenced account saw every project here.
  const grants = applyBrandFence(allGrants, account.allowed_brand_ids)

  const { data: session } = await admin
    .from('telegram_project_sessions')
    .select('project_access_grant_id, brand_id')
    .eq('telegram_account_id', account.id)
    .eq('status', 'active')
    .maybeSingle()

  const selected = session
    && typeof session.project_access_grant_id === 'string'
    && typeof session.brand_id === 'string'
    ? { grantId: session.project_access_grant_id, projectId: session.brand_id }
    : null

  return {
    auth,
    accountId: account.id,
    actorUserId: account.actor_user_id,
    grants,
    // A project switched off after it was selected must stop being the active
    // one. Otherwise the stale selection survives and the next message fails
    // with "cannot run Director work", which reads as a fault rather than as
    // the switch that was deliberately turned off.
    activeSession: selected && grants.some((grant) => grant.projectId === selected.projectId)
      ? selected
      : null,
  }
}
