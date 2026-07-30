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
    // The column is brand_dna_constraints. Asking for `brand_dna` failed the
    // whole select, so `brand` came back null and the check ran with the flags
    // off — for every regulated project. The Creator showed a green tick that
    // meant nothing had been checked.
    const { data: brand, error } = await supabase
      .from('brands')
      .select('compliance_flags, brand_dna_constraints')
      .eq('id', brandId)
      .single()

    if (error || !brand) {
      // Silently falling back to "no rules apply" is what hid the original
      // fault. A check that could not read its own rules is not a pass.
      return NextResponse.json(
        {
          error: 'Could not read this project’s rules, so nothing was checked. Try again shortly.',
        },
        { status: 503 },
      )
    }

    complianceFlags = (brand.compliance_flags as ComplianceFlags) ?? complianceFlags
    brandDNA = (brand.brand_dna_constraints as BrandDNAConstraints) ?? undefined
  }

  try {
    const result = await runComplianceFilter(content, complianceFlags, brandDNA)

    return NextResponse.json({
      ...result,
      checked_at: new Date().toISOString(),
      // Whether this review is worth recording against a post. The board
      // treats a regulated post with no recorded review as needing sign-off,
      // and nothing was stamping it, so everything scheduled read as
      // unreviewed regardless of whether it had been checked here.
      recordable: result.isValid && result.checkCompleted,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Compliance check failed' },
      { status: 500 }
    )
  }
}
