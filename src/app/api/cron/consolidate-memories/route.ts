export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { previewMemoryConsolidation } from '@/lib/memory/maintenance'

/**
 * GET /api/cron/consolidate-memories
 *
 * Safe consolidation has deliberately become a review pass. The old job
 * deleted "similar" memory rows and aged conversation rows, which could erase
 * a product correction or brand decision. This reports bounded candidates in
 * a resumable maintenance row; a future curator may action reviewed items.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const result = await previewMemoryConsolidation(createAdminClient())
  const code = result.status === 'failed' ? 500 : 200
  return NextResponse.json({
    message: result.status === 'failed'
      ? 'Memory consolidation preview could not run.'
      : 'Memory consolidation preview complete. No memories were deleted.',
    runId: result.runId,
    status: result.status,
    stats: result.stats,
  }, { status: code })
}
