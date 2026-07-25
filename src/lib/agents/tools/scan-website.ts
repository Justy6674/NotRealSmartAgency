import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/agents/audit'
import {
  renderWebsiteEvidence,
  type RenderedWebsiteScanResult,
} from './rendered-website-scan'

async function persistScreenshotArtifact(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  scan: RenderedWebsiteScanResult,
): Promise<{ url: string; mediaItemId: string } | null> {
  if (!scan.screenshot_base64) return null

  const screenshot = Buffer.from(scan.screenshot_base64, 'base64')
  if (!screenshot.length || screenshot.length > 1_500_000) return null

  const storagePath = `${userId}/${brandId}/website-audits/${scan.trace_id}.png`
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, screenshot, { contentType: 'image/png', upsert: false })
  if (uploadError) return null

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)
  const { data: mediaItem, error: mediaError } = await supabase
    .from('media_items')
    .insert({
      user_id: userId,
      brand_id: brandId,
      file_url: urlData.publicUrl,
      file_name: `website-audit-${scan.trace_id}.png`,
      file_type: 'image/png',
      file_size_bytes: screenshot.byteLength,
      transcription_status: 'transcribed',
      source_type: 'screenshot',
      tags: ['website-audit', 'rendered-evidence'],
      metadata: {
        trace_id: scan.trace_id,
        source_url: scan.url,
        evidence_source: scan.evidence_source,
      },
    })
    .select('id')
    .single()

  if (mediaError || !mediaItem?.id) {
    await supabase.storage.from('media').remove([storagePath])
    return null
  }

  return { url: urlData.publicUrl, mediaItemId: mediaItem.id }
}

/**
 * Core rendered scan logic. Every NRS entry point uses this single evidence
 * source; callers receive facts and explicit unknowns, never a raw HTML guess.
 */
export async function scanWebsiteCore(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  url: string,
  focus?: string,
  traceId?: string,
) {
  const rendered = await renderWebsiteEvidence(url)
  if ('error' in rendered) {
    await supabase.from('project_scans').insert({
      brand_id: brandId,
      user_id: userId,
      scan_type: 'website',
      status: 'failed',
      results: { schema_version: 'nrs.rendered_website_scan.v1', evidence_source: 'rendered_browser', url, focus: focus ?? 'general' },
      error: rendered.error,
    })
    await logAudit({
      supabase,
      userId,
      action: 'rendered_website_scan',
      entityType: 'website_scan',
      detail: { outcome: 'failed', trace_id: traceId ?? null, reason: rendered.error },
    })
    return rendered
  }

  const scan: RenderedWebsiteScanResult = traceId && rendered.trace_id !== traceId
    ? { ...rendered, trace_id: traceId }
    : rendered
  const screenshot = await persistScreenshotArtifact(supabase, userId, brandId, scan)
  const { screenshot_base64, ...scanWithoutBinary } = scan
  const results = {
    ...scanWithoutBinary,
    focus: focus ?? 'general',
    screenshot: screenshot ? { media_item_id: screenshot.mediaItemId, url: screenshot.url } : null,
  }

  await supabase.from('project_scans').insert({
    brand_id: brandId,
    user_id: userId,
    scan_type: 'website',
    // The renderer did finish; `results.status` preserves whether its evidence
    // is partial so downstream marketing audits can still use what was observed.
    status: 'completed',
    results,
    error: scan.status === 'partial' ? scan.warnings.join(' ') : null,
  })
  await logAudit({
    supabase,
    userId,
    action: 'rendered_website_scan',
    entityType: 'website_scan',
    entityId: scan.trace_id,
    detail: {
      outcome: scan.status,
      trace_id: scan.trace_id,
      page_count: scan.pages.length,
      screenshot_saved: Boolean(screenshot),
      warning_count: scan.warnings.length,
    },
  })

  return results
}

export function createScanWebsiteTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Render and inspect a public website in a real browser. Returns observed visible copy, metadata, headings, calls to action, forms, linked same-origin pages, and explicit unknowns. Use this before making website, messaging, SEO, conversion, or compliance recommendations.',
    inputSchema: z.object({
      url: z.string().url().describe('The public website URL to render and inspect (for example https://example.com.au).'),
      focus: z
        .enum(['general', 'seo', 'compliance', 'messaging'])
        .optional()
        .describe('Optional focus to guide the evidence summary.'),
    }),
    execute: async ({ url, focus }) => scanWebsiteCore(supabase, userId, brandId, url, focus),
  })
}
