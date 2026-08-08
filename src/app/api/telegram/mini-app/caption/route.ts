/**
 * Save a caption the owner corrected by hand.
 *
 * The only way to fix a wrong word was to ask the Director to rewrite the
 * post — which came back different in three other places, so a one-word
 * correction cost the whole caption. Typing the fix is quicker than describing
 * it, and it is the only way to be certain the change is the one that was
 * wanted.
 *
 * This edits the PROPOSAL, not a published post. Nothing here can reach a
 * social account: approving is still a separate, deliberate step.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'
import { userSafeError } from '@/lib/errors/user-safe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })

  const body = (await request.json().catch(() => null)) as
    | { init_data?: unknown; output_id?: unknown; caption?: unknown }
    | null

  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const outputId = typeof body?.output_id === 'string' ? body.output_id : ''
  const caption = typeof body?.caption === 'string' ? body.caption : ''

  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })
  if (!outputId) return NextResponse.json({ error: 'output_id required' }, { status: 400 })
  if (!caption.trim()) {
    return NextResponse.json({ error: 'A caption cannot be emptied. Delete the draft instead.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context?.activeSession) {
    return NextResponse.json({ error: 'Choose a project first.' }, { status: 409 })
  }

  // Scoped to the project in play, so a proposal belonging to another brand
  // cannot be edited by id from here.
  const { data: existing } = await admin
    .from('outputs')
    .select('id, metadata, is_approved')
    .eq('id', outputId)
    .eq('user_id', context.actorUserId)
    .eq('brand_id', context.activeSession.projectId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'That draft is not available in this project.' }, { status: 404 })
  }

  if (existing.is_approved) {
    return NextResponse.json(
      { error: 'That one has already been approved and filed. Edit it in Review, or ask for a fresh draft.' },
      { status: 409 },
    )
  }

  const meta = (existing.metadata ?? {}) as Record<string, unknown>

  const { error } = await admin
    .from('outputs')
    .update({
      content: caption,
      metadata: {
        ...meta,
        // Worth recording: a caption the owner rewrote by hand is the clearest
        // signal there is of what the model got wrong.
        edited_by_owner: true,
        edited_at: new Date().toISOString(),
      },
    })
    .eq('id', outputId)

  if (error) {
    return NextResponse.json(
      { error: userSafeError('mini-app-caption', error, 'That change could not be saved. Nothing was altered.') },
      { status: 500 },
    )
  }

  return NextResponse.json({ saved: true })
}
