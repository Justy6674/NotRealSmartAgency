export const maxDuration = 300 // Fluid Compute — 5 minutes

import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildDailyIntelHtml } from '@/lib/email/templates/daily-intel'
import type { Brand, Competitor } from '@/types/database'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

// ─── AI News Sources ─────────────────────────────────────────────────────────

const AI_NEWS_SOURCES = [
  'https://news.ycombinator.com/front',
  'https://github.com/trending?since=daily',
  'https://vercel.com/changelog',
  'https://docs.anthropic.com/en/changelog',
  'https://www.producthunt.com/topics/artificial-intelligence',
]

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NRS-Agency-Digest/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Strip HTML tags, keep text
    return html.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 3000)
  } catch {
    return null
  }
}

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

// ─── Main Route ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const date = new Date().toLocaleDateString('en-AU', { dateStyle: 'full' })

  // Load all users with digest enabled (check work_context for GLOBAL_DIGEST settings)
  const { data: users } = await supabase.from('users').select('id, email, work_context')

  if (!users || users.length === 0) {
    return NextResponse.json({ message: 'No users' })
  }

  for (const user of users) {
    try {
      // Parse global digest settings
      const settingsMatch = user.work_context?.match(/---GLOBAL_DIGEST---\n([\s\S]+)$/)
      if (!settingsMatch) continue

      const settings = JSON.parse(settingsMatch[1])
      if (!settings.master_enabled) continue

      // Load brands with digest enabled
      const { data: brands } = await supabase
        .from('brands')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)

      // STEP 1: AI News
      let aiNewsSection = null
      if (settings.ai_news_enabled) {
        const keywords = (settings.ai_news_keywords ?? 'agent,AI,MCP').split(',').map((k: string) => k.trim().toLowerCase())

        const sourceTexts = await Promise.allSettled(
          AI_NEWS_SOURCES.map(url => fetchPageText(url))
        )

        const combinedText = sourceTexts
          .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled' && !!r.value)
          .map(r => r.value!)
          .join('\n---\n')
          .slice(0, 6000)

        if (combinedText.length > 100) {
          const result = await generateText({
            model: gateway('anthropic/claude-sonnet-4'),
            system: `You summarise AI/tech news for a marketing agency owner who builds with Next.js, Vercel AI SDK, Supabase, and Claude. Return JSON array: [{"headline":"...","summary":"one line, why it matters","url":"source if known"}]. Max 8 items. Focus on: ${keywords.join(', ')}. Australian English.`,
            prompt: `Today's scraped content:\n${combinedText}`,
          })

          try {
            const match = result.text.match(/\[[\s\S]*\]/)
            if (match) {
              const items = JSON.parse(match[0])
              aiNewsSection = { title: 'AI Agent News', items }
            }
          } catch { /* parse failure */ }
        }
      }

      // STEP 2: Competitor Watch
      const competitorSections: { brandName: string; brandEmoji: string; competitors: { name: string; changes: string | null }[] }[] = []

      if (brands) {
        for (const brand of brands as Brand[]) {
          // Check if this brand has competitor_watch enabled
          const digestMatch = brand.extra_context?.match(/---DIGEST_SETTINGS---\n([\s\S]+)$/)
          let brandDigest = { competitor_watch: false }
          if (digestMatch) {
            try { brandDigest = JSON.parse(digestMatch[1]) } catch { /* */ }
          }

          if (!brandDigest.competitor_watch) continue

          const activeComps = (brand.competitors ?? []).filter(c => c.is_active !== false)
          if (activeComps.length === 0) continue

          const compResults: { name: string; changes: string | null }[] = []

          for (const comp of activeComps) {
            const pagesToCheck = comp.watch_pages?.length ? comp.watch_pages : ['/']
            let changed = false
            let newHash = ''

            for (const page of pagesToCheck) {
              const fullUrl = comp.url.replace(/\/$/, '') + page
              const text = await fetchPageText(fullUrl)
              if (text) {
                newHash = hashContent(text)
                if (comp.last_snapshot_hash && newHash !== comp.last_snapshot_hash) {
                  changed = true
                }
              }
            }

            if (changed) {
              // Summarise what changed
              const changeResult = await generateText({
                model: gateway('anthropic/claude-sonnet-4'),
                system: `You detect website changes for competitive intelligence. Given the competitor name and their page content, briefly describe what seems new or changed. One sentence. Australian English.`,
                prompt: `Competitor: ${comp.name} (${comp.url}). Change detected on their site.`,
              })
              compResults.push({ name: comp.name, changes: changeResult.text })
            } else {
              compResults.push({ name: comp.name, changes: null })
            }

            // Update hash in the competitor array
            if (newHash) {
              comp.last_snapshot_hash = newHash
              comp.last_checked_at = new Date().toISOString()
            }
          }

          // Save updated hashes back to brand
          await supabase.from('brands').update({
            competitors: brand.competitors,
          }).eq('id', brand.id)

          const emoji = brand.compliance_flags?.ahpra ? '💊' : brand.niche.includes('skin') ? '🧴' : '📋'
          competitorSections.push({
            brandName: brand.name,
            brandEmoji: emoji,
            competitors: compResults,
          })
        }
      }

      // STEP 3: "What Am I Missing"
      let whatAmIMissing: string | null = null
      if (settings.what_am_i_missing && brands && brands.length > 0) {
        const brandList = (brands as Brand[]).map(b => `${b.name} (${b.niche})`).join(', ')
        const missingResult = await generateText({
          model: gateway('anthropic/claude-sonnet-4'),
          system: `You are a strategic AI advisor. Given the user's portfolio of brands, identify 2-3 emerging trends, tools, or opportunities they might not be tracking. Be specific and actionable. Australian English.`,
          prompt: `Portfolio: ${brandList}. Stack: Next.js, Vercel, Supabase, Claude, Resend. What trends or opportunities should they be watching that they might not know about?`,
        })
        whatAmIMissing = missingResult.text
      }

      // STEP 4: Compose + Send
      const html = buildDailyIntelHtml({
        date,
        aiNews: aiNewsSection,
        competitorSections,
        whatAmIMissing,
      })

      const recipients = [user.email, ...(settings.recipients ?? '').split(',').map((e: string) => e.trim()).filter(Boolean)]

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'NRS Agency <noreply@notrealsmart.com.au>',
        to: recipients,
        subject: `Daily Intel — ${date}`,
        html,
      })

      // STEP 5: Audit log
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'daily_intel_sent',
        entity_type: 'digest',
        detail: {
          ai_news_items: aiNewsSection?.items.length ?? 0,
          competitor_brands: competitorSections.length,
          changes_detected: competitorSections.reduce((sum, s) => sum + s.competitors.filter(c => c.changes).length, 0),
          what_am_i_missing: !!whatAmIMissing,
          recipients,
        },
        cost_cents: 0,
      })
    } catch (error) {
      console.error(`[daily-intel] Failed for user ${user.id}:`, error)
    }
  }

  return NextResponse.json({ message: 'Digest sent', date })
}
