import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { sendTelegramText } from '@/lib/telegram/telegram-api'
import { measure, pagespeedConfigured, type VitalsResult } from '@/lib/vitals/pagespeed'
import { buildWeeklyReport } from '@/lib/vitals/report'

/**
 * Weekly Core Web Vitals check on the brands' own sites, reported to Telegram.
 *
 * Sending is safe alongside Hermes: only a webhook or getUpdates can conflict
 * over a bot, and this does neither — it posts a message and leaves.
 *
 * Results are filed as an `outputs` row rather than a new table, so this needed
 * no migration against live Supabase, and last week's numbers are there to
 * compare against when the trend matters more than the snapshot.
 */

export const runtime = 'nodejs'
export const maxDuration = 300

/** The brands Justin asked to be watched, by slug in the brands table. */
const WATCHED = [
  'downscale',        // Downscale Weight Loss
  'scent-sell',       // ScentSell
  'do-today',
  'endorseme',
  'telescribe',
  'telecheck',
  'telecheck-clinic',
] as const

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function GET(request: Request) {
  // Vercel Cron sends the secret; nothing else may trigger a fleet of scans.
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  if (!pagespeedConfigured()) {
    return NextResponse.json(
      { error: 'PAGESPEED_API_KEY is not set — no measurement was attempted.' },
      { status: 503 },
    )
  }

  const admin = createAdminClient()
  const { data: brands } = await admin
    .from('brands')
    .select('id, name, slug, website_url, user_id')
    .in('slug', WATCHED as unknown as string[])

  const targets = (brands ?? []).filter(
    (b): b is typeof b & { website_url: string } => typeof b.website_url === 'string' && b.website_url.length > 0,
  )

  // Sequential on purpose: PageSpeed rate-limits hard, and a weekly job has all
  // the time it needs. Mobile first — it is what Google grades on.
  const results: VitalsResult[] = []
  for (const brand of targets) {
    for (const strategy of ['mobile', 'desktop'] as const) {
      results.push(await measure({ brand: brand.name, url: brand.website_url, strategy }))
    }
  }

  const report = buildWeeklyReport(results)

  // File it before sending: a failed send must not lose the measurement.
  const owner = targets[0]?.user_id
  if (owner) {
    await admin.from('outputs').insert({
      user_id: owner,
      brand_id: targets.find((b) => b.slug === 'notrealsmart')?.id ?? targets[0].id,
      output_type: 'analytics_report',
      title: `Core Web Vitals — week to ${new Date().toISOString().slice(0, 10)}`,
      content: report,
      is_approved: false,
      metadata: { source: 'cron_web_vitals', results },
    })
  }

  const config = getNRSTelegramConfig()
  const chatId = process.env.NRS_TELEGRAM_OWNER_CHAT_ID
  let delivered = false
  if (config?.enabled && chatId) {
    delivered = await sendTelegramText({ botToken: config.botToken, chatId, text: report })
      .then(() => true)
      .catch(() => false)
  }

  return NextResponse.json({
    measured: results.length,
    sites: targets.length,
    delivered,
    failing: results.filter((r) => r.strategy === 'mobile' && (r.verdict === 'poor' || r.verdict === 'needs-work')).length,
  })
}
