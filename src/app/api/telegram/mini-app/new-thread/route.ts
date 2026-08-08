/**
 * Finish this piece of work and start the next.
 *
 * Nothing is deleted. What was decided is written into the brand's memory
 * first, so the Director still knows it tomorrow, and only then is the line
 * drawn across the screen. Everything above the line stays in the database
 * exactly as it was — the conversation IS the record of what was agreed, and
 * clearing a screen is not a reason to lose it.
 *
 * Saving before clearing is the whole point of the order. Clear first and a
 * failure to save loses the thread with nothing to show for it.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'
import { setThreadStart, readThreadStart } from '@/lib/telegram/thread-boundary'
import { extractSessionMemory } from '@/lib/memory/session-memory'
import { userSafeError } from '@/lib/errors/user-safe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) {
    return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { init_data?: unknown } | null
  const auth = validateTelegramMiniAppInitData(
    typeof body?.init_data === 'string' ? body.init_data : '',
    config.botToken,
  )
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context?.activeSession) {
    return NextResponse.json({ error: 'Choose a project first.' }, { status: 409 })
  }

  const brandId = context.activeSession.projectId
  const userId = context.actorUserId

  const { data: brand } = await admin
    .from('brands').select('name, slug').eq('id', brandId).maybeSingle()
  if (!brand?.slug) {
    return NextResponse.json({ error: 'That project could not be read.' }, { status: 404 })
  }

  const since = await readThreadStart(admin, { brandId, brandSlug: brand.slug, userId })

  // What was said since the last line was drawn. Only the owner's own words
  // and the Director's answers — a summary of the pictures would be noise.
  const { data: jobs } = await admin
    .from('mcp_jobs')
    .select('input, result, created_at')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('channel', 'telegram')
    .eq('status', 'done')
    .gte('created_at', new Date(since ?? Date.now() - 7 * 24 * 3600_000).toISOString())
    .order('created_at', { ascending: true })
    .limit(60)

  const turns = (jobs ?? [])
    .map((job) => ({
      asked: typeof job.input?.message === 'string' ? job.input.message.trim() : '',
      answered: typeof job.result?.response === 'string' ? job.result.response.trim() : '',
    }))
    .filter((turn) => turn.asked || turn.answered)

  let saved = false
  if (turns.length > 0) {
    try {
      await extractSessionMemory({
        brandId,
        brandSlug: brand.slug,
        brandName: (brand.name as string) ?? brand.slug,
        userId,
        // The whole thread as one exchange. The extractor pulls the durable
        // facts out; handing it turn-by-turn would relearn the same thing
        // sixty times and cost sixty calls to do it.
        userMessage: turns.map((turn) => turn.asked).filter(Boolean).join('\n'),
        assistantResponse: turns.map((turn) => turn.answered).filter(Boolean).join('\n\n'),
        conversationId: null,
      })
      saved = true
    } catch (error) {
      // Not fatal, but the owner must not be told it was saved when it was
      // not — the reply below reports what actually happened.
      console.error('[new-thread] memory', userSafeError('new-thread', error, 'save failed'))
    }
  }

  const ok = await setThreadStart(admin, { brandId, brandSlug: brand.slug, userId, at: new Date() })
  if (!ok) {
    return NextResponse.json(
      { error: 'Could not start a new one just then. Nothing was lost — try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    started: true,
    turns_saved: saved ? turns.length : 0,
    memory_saved: saved,
    project_name: (brand.name as string) ?? brand.slug,
  })
}
