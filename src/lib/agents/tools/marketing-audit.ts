import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand, ProjectScan } from '@/types/database'

export function createMarketingAuditTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Compile a full marketing audit for the current brand by pulling together the brand profile, website scan, social media presence, competitor list, content pillars, and compliance flags. Use this as a starting point for any strategic review, brand health check, or when the user asks for an overall assessment of their marketing. After this tool returns data, write the narrative audit yourself.',
    inputSchema: z.object({
      include_website: z
        .boolean()
        .optional()
        .describe('Include the most recent website scan results (default: true)'),
      include_social: z
        .boolean()
        .optional()
        .describe('Include the most recent social media scan results (default: true)'),
      include_competitors: z
        .boolean()
        .optional()
        .describe('Include the competitor list from the brand profile (default: true)'),
    }),
    execute: async ({ include_website = true, include_social = true, include_competitors = true }) => {
      // Fetch brand profile
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single<Brand>()

      if (brandError || !brand) {
        return {
          error: 'Could not load brand profile',
          suggestion: 'Make sure your brand is set up correctly before running a marketing audit.',
        }
      }

      // Fetch all project_scans for this brand
      const { data: scans } = await supabase
        .from('project_scans')
        .select('*')
        .eq('brand_id', brandId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      const allScans = (scans ?? []) as ProjectScan[]

      // Find most recent scan of each type
      const latestWebsite = include_website
        ? allScans.find((s) => s.scan_type === 'website' && s.status === 'completed') ?? null
        : null
      const latestSocial = include_social
        ? allScans.find((s) => s.scan_type === 'social' && s.status === 'completed') ?? null
        : null

      const audit = {
        brand: {
          name: brand.name,
          tagline: brand.tagline,
          description: brand.description,
          niche: brand.niche,
          website_url: brand.website_url,
          tone_of_voice: brand.tone_of_voice,
          target_audience: brand.target_audience,
          brand_colours: brand.brand_colours,
          extra_context: brand.extra_context,
        },
        websiteScan: latestWebsite ? latestWebsite.results : null,
        socialPresence: latestSocial ? latestSocial.results : null,
        competitors: include_competitors ? brand.competitors : null,
        contentPillars: brand.content_pillars,
        complianceFlags: brand.compliance_flags,
        scanHistory: {
          total: allScans.length,
          types: [...new Set(allScans.map((s) => s.scan_type))],
          lastScanAt: allScans[0]?.created_at ?? null,
        },
      }

      await supabase.from('project_scans').insert({
        brand_id: brandId,
        user_id: userId,
        scan_type: 'marketing_audit',
        status: 'completed',
        results: audit,
        error: null,
      })

      return audit
    },
  })
}
