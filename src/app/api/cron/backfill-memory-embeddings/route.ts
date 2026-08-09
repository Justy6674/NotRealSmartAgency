export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { backfillMemoryEmbeddings } from '@/lib/memory/maintenance'

/**
 * GET /api/cron/backfill-memory-embeddings
 *
 * Processes one small, resumable batch only. It is intentionally opt-in: this
 * repair invokes the configured embedding provider, so it must not begin a
 * 7k-row paid operation merely because an app deploy happened.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  if (process.env.NRS_MEMORY_BACKFILL_ENABLED !== 'true') {
    return NextResponse.json({
      error: 'Memory embedding repair is disabled until NRS_MEMORY_BACKFILL_ENABLED=true is explicitly configured.',
    }, { status: 409 })
  }

  const result = await backfillMemoryEmbeddings(createAdminClient())
  const code = result.status === 'failed' ? 500 : 200
  return NextResponse.json({
    message: result.status === 'failed'
      ? 'Memory embedding repair could not run.'
      : 'Memory embedding repair batch complete. Existing vectors and memory content were not changed.',
    runId: result.runId,
    status: result.status,
    stats: result.stats,
  }, { status: code })
}
