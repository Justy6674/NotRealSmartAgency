export const maxDuration = 30

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Brand } from '@/types/database'
import { scanWebsiteCore } from '@/lib/agents/tools/scan-website'
import { scanSocialCore } from '@/lib/agents/tools/scan-social'
import { scanGithubCore } from '@/lib/agents/tools/scan-github'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Load brand
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .single<Brand>()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  // Run scans in parallel — only those with configured URLs
  const scanPromises: Promise<{ type: string; result: unknown }>[] = []

  if (brand.website_url) {
    scanPromises.push(
      scanWebsiteCore(supabase, user.id, brandId, brand.website_url, 'general')
        .then((result) => ({ type: 'website', result }))
        .catch(() => ({ type: 'website', result: { error: 'Scan failed' } }))
    )
  }

  if (brand.github_url) {
    scanPromises.push(
      scanGithubCore(supabase, user.id, brandId, brand.github_url)
        .then((result) => ({ type: 'github', result }))
        .catch(() => ({ type: 'github', result: { error: 'Scan failed' } }))
    )
  }

  // Always scan socials — uses brand name to guess handles if no URLs provided
  const socialUrls = brand.social_urls && Object.keys(brand.social_urls).length > 0
    ? brand.social_urls as Record<string, string>
    : undefined
  scanPromises.push(
    scanSocialCore(supabase, user.id, brandId, brand.name, socialUrls)
      .then((result) => ({ type: 'social', result }))
      .catch(() => ({ type: 'social', result: { error: 'Scan failed' } }))
  )

  const scanResults = await Promise.all(scanPromises)

  // Build the structured first message
  const marketingStatus = brand.marketing_status ?? 'unknown'
  const marketingDescriptions: Record<string, string> = {
    unknown: 'Not yet assessed',
    no_marketing: 'No marketing presence',
    early_stage: 'Early stage marketing',
    needs_strategy: 'Has presence, needs strategy',
    active: 'Active marketing',
    scaling: 'Scaling marketing efforts',
  }

  const lines: string[] = [
    `Review my brand "${brand.name}".`,
    ``,
    `**Business Stage:** ${brand.business_stage ?? 'unknown'}`,
    `**Marketing Status:** ${marketingDescriptions[marketingStatus] ?? marketingStatus}`,
  ]

  if (brand.marketing_notes) {
    lines.push(`**Marketing Notes:** ${brand.marketing_notes}`)
  }

  lines.push('')

  for (const scan of scanResults) {
    const r = scan.result as Record<string, unknown>
    if (r.error) {
      lines.push(`## ${scan.type.charAt(0).toUpperCase() + scan.type.slice(1)} Scan\nFailed: ${r.error}\n`)
    } else {
      // Summarise scan results
      if (scan.type === 'website') {
        const ws = r as { title?: string; description?: string; headings?: { level: string; text: string }[]; bodyText?: string }
        lines.push(`## Website Scan`)
        if (ws.title) lines.push(`**Title:** ${ws.title}`)
        if (ws.description) lines.push(`**Meta Description:** ${ws.description}`)
        if (ws.headings?.length) {
          lines.push(`**Headings:** ${ws.headings.slice(0, 10).map(h => `${h.level}: ${h.text}`).join(' | ')}`)
        }
        if (ws.bodyText) lines.push(`**Body Preview:** ${ws.bodyText.slice(0, 500)}...`)
        lines.push('')
      } else if (scan.type === 'social') {
        const ss = r as { presence?: Record<string, { found: boolean; checked_url: string }> }
        lines.push(`## Social Media Scan`)
        if (ss.presence) {
          for (const [platform, data] of Object.entries(ss.presence)) {
            lines.push(`- **${platform}:** ${data.found ? 'Found' : 'Not found'} (${data.checked_url})`)
          }
        }
        lines.push('')
      } else if (scan.type === 'github') {
        const gs = r as { owner?: string; repo?: string; readme?: string; techStack?: Record<string, string> }
        lines.push(`## GitHub Scan`)
        if (gs.owner && gs.repo) lines.push(`**Repo:** ${gs.owner}/${gs.repo}`)
        if (gs.techStack) {
          const keyDeps = Object.keys(gs.techStack).filter(d =>
            ['react', 'next', 'vue', 'express', 'supabase', 'tailwindcss', 'typescript', 'stripe'].some(k => d.includes(k))
          )
          if (keyDeps.length) lines.push(`**Tech Stack:** ${keyDeps.join(', ')}`)
        }
        if (gs.readme) lines.push(`**README Preview:** ${gs.readme.slice(0, 300)}...`)
        lines.push('')
      }
    }
  }

  lines.push(`Run a comprehensive marketing audit and produce an actionable marketing playbook for this brand.`)

  const firstMessage = lines.join('\n')

  return NextResponse.json({ firstMessage, brandId: brand.id })
}
