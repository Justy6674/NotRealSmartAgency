/**
 * Auto-populate proforma sections from existing brand data.
 *
 * Runs on first access — seeds the proforma so agents have something to work with
 * immediately, rather than starting from a blank slate.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand } from '@/types/database'
import { PROFORMA_SECTIONS } from './sections'

interface SectionSeed {
  section_key: string
  section_title: string
  section_data: Record<string, unknown>
  rag_status: string
  review_cadence: string
}

function buildSeedData(brand: Brand): SectionSeed[] {
  const seeds: SectionSeed[] = []

  for (const section of PROFORMA_SECTIONS) {
    const data: Record<string, unknown> = {}
    let rag: string = 'unknown'

    switch (section.key) {
      case 'executive_snapshot':
        data.brand_name = brand.name
        data.tagline = brand.tagline ?? null
        data.niche = brand.niche
        data.business_stage = brand.business_stage
        data.marketing_status = brand.marketing_status ?? 'unknown'
        data.website = brand.website_url ?? null
        if (brand.description) data.summary = brand.description
        rag = brand.description ? 'amber' : 'red'
        break

      case 'client_profile':
        data.brand_name = brand.name
        data.owner = null // filled by Director
        data.business_stage = brand.business_stage
        data.niche = brand.niche
        if (brand.description) data.description = brand.description
        rag = 'amber'
        break

      case 'brand_fundamentals':
        data.name = brand.name
        data.tagline = brand.tagline ?? null
        data.tone_of_voice = brand.tone_of_voice ?? {}
        data.brand_colours = brand.brand_colours ?? {}
        data.content_pillars = brand.content_pillars ?? []
        rag = brand.tagline && brand.content_pillars?.length ? 'green' : 'amber'
        break

      case 'audience':
        if (brand.target_audience) {
          data.demographics = brand.target_audience.demographics ?? null
          data.pain_points = brand.target_audience.pain_points ?? []
          data.desires = brand.target_audience.desires ?? []
        }
        rag = brand.target_audience?.demographics ? 'amber' : 'red'
        break

      case 'market_context':
        data.niche = brand.niche
        data.business_stage = brand.business_stage
        rag = 'red' // needs research
        break

      case 'compliance_profile':
        data.ahpra = brand.compliance_flags?.ahpra ?? false
        data.tga = brand.compliance_flags?.tga ?? false
        data.tga_categories = brand.compliance_flags?.tga_categories ?? []
        rag = (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) ? 'amber' : 'green'
        break

      case 'business_goals':
        rag = 'red' // needs user input
        break

      case 'funnel_map':
        rag = 'red'
        break

      case 'channel_website':
        data.url = brand.website_url ?? null
        data.github_url = brand.github_url ?? null
        rag = brand.website_url ? 'amber' : 'red'
        break

      case 'channel_seo':
        rag = 'red'
        break

      case 'channel_social':
        data.profiles = brand.social_urls ?? {}
        rag = Object.keys(brand.social_urls ?? {}).length > 0 ? 'amber' : 'red'
        break

      case 'channel_paid':
        rag = 'red'
        break

      case 'channel_email':
        rag = 'red'
        break

      case 'content_creative':
        data.content_pillars = brand.content_pillars ?? []
        data.video_preferences = brand.video_preferences ?? {}
        rag = brand.content_pillars?.length ? 'amber' : 'red'
        break

      case 'competitors':
        if (brand.competitors?.length) {
          data.competitors = brand.competitors.map(c => ({
            name: c.name,
            url: c.url,
            category: c.category ?? 'direct',
            why: c.why ?? c.notes ?? null,
          }))
        }
        rag = brand.competitors?.length ? 'amber' : 'red'
        break

      case 'kpi_dashboard':
        rag = 'red'
        break

      case 'gaps_opportunities':
        rag = 'red'
        break

      case 'wins_losses':
        data.wins = []
        data.losses = []
        data.learnings = []
        rag = 'unknown'
        break

      case 'risk_register':
        data.risks = []
        if (brand.compliance_flags?.ahpra) {
          data.risks = [{ risk: 'AHPRA advertising compliance', severity: 'high', mitigation: 'All content reviewed by compliance agent' }]
        }
        rag = brand.compliance_flags?.ahpra ? 'amber' : 'unknown'
        break

      case 'decision_log':
        data.decisions = []
        rag = 'unknown'
        break

      case 'thirty_sixty_ninety':
        rag = 'red'
        break
    }

    seeds.push({
      section_key: section.key,
      section_title: section.title,
      section_data: data,
      rag_status: rag,
      review_cadence: section.cadence,
    })
  }

  return seeds
}

/**
 * Ensure the brand has proforma sections. If none exist, seed them from brand data.
 * Returns the sections (either existing or newly created).
 */
export async function ensureProforma(
  supabase: SupabaseClient,
  brand: Brand
): Promise<Array<{
  section_key: string
  section_title: string
  section_data: Record<string, unknown>
  rag_status: string
  review_cadence: string
  updated_at: string
  last_reviewed_at: string | null
}>> {
  // Check if proforma already exists
  const { data: existing, error } = await supabase
    .from('brand_proforma_sections')
    .select('section_key, section_title, section_data, rag_status, review_cadence, updated_at, last_reviewed_at')
    .eq('brand_id', brand.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[proforma] Failed to fetch proforma sections:', error)
    return []
  }

  if (existing && existing.length > 0) {
    return existing
  }

  // First time — seed from brand data
  const seeds = buildSeedData(brand)
  const rows = seeds.map(s => ({
    brand_id: brand.id,
    ...s,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('brand_proforma_sections')
    .insert(rows)
    .select('section_key, section_title, section_data, rag_status, review_cadence, updated_at, last_reviewed_at')

  if (insertError) {
    console.error('[proforma] Failed to seed proforma:', insertError)
    return []
  }

  return inserted ?? []
}
