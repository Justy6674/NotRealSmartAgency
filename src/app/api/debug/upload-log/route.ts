/**
 * Client-side upload debug log sink.
 *
 * The MediaUploader POSTs one row per breadcrumb as the upload runs.
 * We persist to `audit_log` with action='upload_debug' and entity_type='media_upload_trace'
 * so the admin (me, via scripts/read-upload-trace.mjs) can see exactly which
 * step a browser hung on — without ever asking the user to open DevTools.
 *
 * Fire-and-forget from the client: no response body needed, just 204.
 * Never blocks the upload pipeline — all errors are swallowed and logged.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'

export const runtime = 'nodejs'

const LogSchema = z.object({
  trace_id: z.string().min(1).max(64),
  step: z.string().min(1).max(200),
  data: z.record(z.unknown()).optional(),
  build_sha: z.string().optional(),
  ts: z.number().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = LogSchema.safeParse(body)
    if (!parsed.success) {
      return new NextResponse(null, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse(null, { status: 401 })

    const { trace_id, step, data, build_sha, ts } = parsed.data

    // Best-effort insert — never block
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'upload_debug',
      entity_type: 'media_upload_trace',
      entity_id: trace_id,
      detail: {
        step,
        data: data ?? {},
        build_sha: build_sha ?? 'unknown',
        client_ts: ts ?? Date.now(),
      },
    })

    // Server-side console log too — shows up in Vercel function logs
    console.log(`[upload-debug:${build_sha ?? '?'}:${trace_id}] ${step}`, data ?? '')
  } catch (err) {
    console.error('[upload-debug] log write failed:', err)
  }

  return new NextResponse(null, { status: 204 })
}
