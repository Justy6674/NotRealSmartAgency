export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { isCronAuthorised, CRON_UNAUTHORISED_BODY } from '@/lib/security/cron-auth'

/**
 * Auto-Monitors Cron — proactive alerts for brand health.
 *
 * Checks every brand for:
 * 1. Failed posts in last 24 hours
 * 2. Content gaps (nothing scheduled for next 3 days)
 * 3. Neglected platforms (no publish in last 7 days)
 *
 * Stores alerts in audit_log with action = 'performance_alert'.
 * Designed to be called by Vercel Cron every 60 minutes.
 */

interface AlertPayload {
  alert_type: 'failed_posts' | 'content_gap' | 'neglected_platform'
  message: string
  severity: 'warning' | 'critical'
  platform?: string
  count?: number
}

export async function GET(request: Request) {
  // Fail closed: with CRON_SECRET unset the old inline compare matched the
  // literal string 'Bearer undefined', so anyone sending it got in.
  if (!isCronAuthorised(request)) {
    return NextResponse.json(CRON_UNAUTHORISED_BODY, { status: 401 })
  }

  const supabase = createAdminClient()
  let alertsCreated = 0

  // 1. Get all users who own brands
  const { data: brands, error: brandsErr } = await supabase
    .from('brands')
    .select('id, name, slug, user_id, social_urls')
    .eq('is_active', true)

  if (brandsErr || !brands?.length) {
    return NextResponse.json({ alerts: 0, message: 'No active brands found' })
  }

  // Pre-fetch Mixpost accounts for neglected-platform check
  let brandAccountMap: Map<string, { provider: string }[]> | null = null
  try {
    const accounts = await fetchMixpostAccounts()
    if (accounts) {
      const brandStubs = brands.map((b) => ({
        id: b.id as string,
        name: b.name as string,
        slug: b.slug as string,
        social_urls: (b.social_urls as Record<string, string>) ?? {},
      }))
      const uniqueBrands = Array.from(
        new Map(brandStubs.map((b) => [b.id, b])).values()
      )
      brandAccountMap = mapAccountsToBrandsRaw(accounts, uniqueBrands) as Map<
        string,
        { provider: string }[]
      >
    }
  } catch {
    // Mixpost unavailable — skip neglected-platform checks
  }

  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const alerts: {
    user_id: string
    action: string
    entity_type: string
    entity_id: string
    details: AlertPayload
  }[] = []

  for (const brand of brands) {
    const brandId = brand.id as string
    const userId = brand.user_id as string
    const brandName = brand.name as string

    // ── Check 1: Failed posts in last 24 hours ──
    const { data: failedPosts } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('brand_id', brandId)
      .eq('status', 'failed')
      .gte('updated_at', twentyFourHoursAgo)

    if (failedPosts && failedPosts.length > 0) {
      alerts.push({
        user_id: userId,
        action: 'performance_alert',
        entity_type: 'brand',
        entity_id: brandId,
        details: {
          alert_type: 'failed_posts',
          message: `${brandName}: ${failedPosts.length} post${failedPosts.length === 1 ? '' : 's'} failed to publish in the last 24 hours`,
          severity: 'critical',
          count: failedPosts.length,
        },
      })
    }

    // ── Check 2: Content gap — nothing scheduled for next 3 days ──
    const { data: upcomingPosts } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('brand_id', brandId)
      .in('status', ['scheduled', 'draft'])
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', threeDaysFromNow)
      .limit(1)

    if (!upcomingPosts || upcomingPosts.length === 0) {
      alerts.push({
        user_id: userId,
        action: 'performance_alert',
        entity_type: 'brand',
        entity_id: brandId,
        details: {
          alert_type: 'content_gap',
          message: `${brandName}: No content scheduled for the next 3 days — your audience may lose momentum`,
          severity: 'warning',
        },
      })
    }

    // ── Check 3: Neglected platforms ──
    if (brandAccountMap) {
      const brandAccounts = brandAccountMap.get(brandId) ?? []
      const connectedPlatforms = [
        ...new Set(brandAccounts.map((a) => a.provider)),
      ]

      for (const platform of connectedPlatforms) {
        const { data: recentPublished } = await supabase
          .from('scheduled_posts')
          .select('id')
          .eq('brand_id', brandId)
          .eq('platform', platform)
          .eq('status', 'published')
          .gte('published_at', sevenDaysAgo)
          .limit(1)

        if (!recentPublished || recentPublished.length === 0) {
          // Also check by updated_at for posts that published but
          // don't have published_at set
          const { data: altCheck } = await supabase
            .from('scheduled_posts')
            .select('id')
            .eq('brand_id', brandId)
            .eq('platform', platform)
            .eq('status', 'published')
            .gte('updated_at', sevenDaysAgo)
            .limit(1)

          if (!altCheck || altCheck.length === 0) {
            alerts.push({
              user_id: userId,
              action: 'performance_alert',
              entity_type: 'brand',
              entity_id: brandId,
              details: {
                alert_type: 'neglected_platform',
                message: `${brandName}: No posts published on ${platform} in the last 7 days`,
                severity: 'warning',
                platform,
              },
            })
          }
        }
      }
    }
  }

  // Batch-insert all alerts into audit_log
  if (alerts.length > 0) {
    const { error: insertErr } = await supabase.from('audit_log').insert(
      alerts.map((a) => ({
        user_id: a.user_id,
        action: a.action,
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        details: a.details,
      }))
    )

    if (insertErr) {
      console.error('Failed to insert monitor alerts:', insertErr)
      return NextResponse.json(
        { error: 'Failed to store alerts', detail: insertErr.message },
        { status: 500 }
      )
    }
    alertsCreated = alerts.length
  }

  console.log(`[monitor-alerts] Created ${alertsCreated} alerts across ${brands.length} brands`)

  return NextResponse.json({
    alerts: alertsCreated,
    brands_checked: brands.length,
  })
}
