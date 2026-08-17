import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { JUSTIN_OWNER_EMAIL, OWNER_POSTING_PAUSED } from './transport'

const COOLDOWN_MS = 30 * 60 * 1000
const EMAILED_AT_KEY = 'billing_pause_emailed_at'

export function isBillingPausedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: number; statusCode?: number; message?: string }
  if (e.status === 402 || e.statusCode === 402) return true
  return /402|PAYMENT_REQUIRED/i.test(String(e.message ?? ''))
}

/**
 * Shared-fate billing (D21): pause every scheduled/publishing row on brands
 * that have a publisher profile. Do not hop to Mixpost. Do not retry.
 */
export async function pauseLinkedBrandPosting(): Promise<void> {
  const admin = createAdminClient()
  const { data: brands } = await admin
    .from('brands')
    .select('id, social_urls')

  const linkedIds = (brands ?? [])
    .filter((row) => {
      const raw = (row.social_urls as Record<string, unknown> | null)?.zernio_profile_id
      return typeof raw === 'string' && raw.trim() !== ''
    })
    .map((row) => row.id as string)

  if (linkedIds.length === 0) return

  const { data: rows } = await admin
    .from('scheduled_posts')
    .select('id, metadata')
    .in('brand_id', linkedIds)
    .in('status', ['scheduled', 'publishing'])

  for (const row of rows ?? []) {
    const metadata = {
      ...((row.metadata as Record<string, unknown> | null) ?? {}),
      posting_paused: true,
    }
    await admin.from('scheduled_posts').update({ metadata }).eq('id', row.id)
  }
}

export async function resumeLinkedBrandPosting(): Promise<void> {
  const admin = createAdminClient()
  const { data: brands } = await admin
    .from('brands')
    .select('id, social_urls')

  const linkedIds = (brands ?? [])
    .filter((row) => {
      const raw = (row.social_urls as Record<string, unknown> | null)?.zernio_profile_id
      return typeof raw === 'string' && raw.trim() !== ''
    })
    .map((row) => row.id as string)

  if (linkedIds.length === 0) return

  const { data: rows } = await admin
    .from('scheduled_posts')
    .select('id, metadata')
    .in('brand_id', linkedIds)
    .in('status', ['scheduled', 'publishing'])

  for (const row of rows ?? []) {
    const metadata = { ...((row.metadata as Record<string, unknown> | null) ?? {}) }
    delete metadata.posting_paused
    await admin.from('scheduled_posts').update({ metadata }).eq('id', row.id)
  }
}

export async function emailJustinBillingPaused(): Promise<void> {
  const admin = createAdminClient()
  const { data: brands } = await admin
    .from('brands')
    .select('id, social_urls')

  const linked = (brands ?? []).filter((row) => {
    const raw = (row.social_urls as Record<string, unknown> | null)?.zernio_profile_id
    return typeof raw === 'string' && raw.trim() !== ''
  })
  const first = linked[0]
  if (!first) return

  const urls = (first.social_urls as Record<string, unknown> | null) ?? {}
  const last = typeof urls[EMAILED_AT_KEY] === 'string' ? Date.parse(urls[EMAILED_AT_KEY] as string) : 0
  if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return

  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@notrealsmart.com.au',
      to: JUSTIN_OWNER_EMAIL,
      subject: 'Posting is paused — billing needs a look',
      text: 'Publishing is paused until billing is live again. Nothing was sent to the backup. Tap Resume posting in Social after you confirm billing is live.',
    })
  }

  await admin
    .from('brands')
    .update({ social_urls: { ...urls, [EMAILED_AT_KEY]: new Date().toISOString() } })
    .eq('id', first.id)
}

export { OWNER_POSTING_PAUSED }
