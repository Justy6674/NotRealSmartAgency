export const maxDuration = 30

import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'
import { runComplianceFilter } from '@/lib/agents/compliance-filter'
import type { ComplianceFlags, BrandDNAConstraints } from '@/types/database'

const CheckSchema = z.object({
  content: z.string().min(1),
  brandId: z.string().uuid().optional(),
})

/**
 * POST /api/compliance-check
 *
 * Runs AHPRA/TGA compliance + brand voice check on content.
 * If brandId provided, fetches brand's compliance_flags and brand_dna.
 * Otherwise uses a basic check (no brand-specific rules).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = CheckSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { content, brandId } = parsed.data

  let complianceFlags: ComplianceFlags = { ahpra: false, tga: false, tga_categories: [] }
  let brandDNA: BrandDNAConstraints | undefined

  if (brandId) {
    const { data: brand } = await supabase
      .from('brands')
      .select('compliance_flags, brand_dna')
      .eq('id', brandId)
      .single()

    if (brand) {
      complianceFlags = (brand.compliance_flags as ComplianceFlags) ?? complianceFlags
      brandDNA = (brand.brand_dna as BrandDNAConstraints) ?? undefined
    }
  }

  try {
    const result = await runComplianceFilter(content, complianceFlags, brandDNA)

    return NextResponse.json({
      ...result,
      checked_at: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Compliance check failed' },
      { status: 500 }
    )
  }
}
