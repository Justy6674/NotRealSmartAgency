import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { runDirectorJob } from '@/lib/mcp/director-job'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTelegramCommandReply } from '@/lib/telegram/telegram-command'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { dispatchTelegramDirectorRequest } from '@/lib/telegram/nrs-director-dispatch'
import { authoriseTelegramUpdate, type TelegramBrand, type TelegramUpdate } from '@/lib/telegram/nrs-telegram'
import { sendTelegramText } from '@/lib/telegram/telegram-api'

export const runtime = 'nodejs'
export const maxDuration = 600

type TelegramJobRow = {
  status: string
  result: unknown
  error: string | null
}

function getDirectorResponse(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const response = (result as Record<string, unknown>).response
  return typeof response === 'string' && response.trim() ? response : null
}

async function deliverTelegramText(config: NonNullable<ReturnType<typeof getNRSTelegramConfig>>, text: string) {
  await sendTelegramText({
    botToken: config.botToken,
    chatId: config.ownerTelegramChatId,
    text,
  })
}

/**
 * Telegram is a private, owner-only channel into the existing Director job
 * queue. It neither selects a department nor calls publishing tools itself.
 */
export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config) {
    return NextResponse.json({ error: 'Telegram bot is not configured.' }, { status: 503 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid Telegram update.' }, { status: 400 })
  }

  const authorisation = authoriseTelegramUpdate({
    update,
    suppliedSecret: request.headers.get('x-telegram-bot-api-secret-token'),
    expectedSecret: config.webhookSecret,
    owner: { chatId: config.ownerTelegramChatId, userId: config.ownerTelegramUserId },
  })

  if (!authorisation.ok) {
    // A valid Telegram retry for an unsupported update must not keep retrying;
    // an invalid secret is rejected so forged traffic is visible to Telegram.
    return authorisation.reason === 'invalid_secret'
      ? NextResponse.json({ error: 'Invalid webhook secret.' }, { status: 401 })
      : NextResponse.json({ received: true })
  }

  const supabase = createAdminClient()
  const { data: brands, error: brandsError } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('user_id', config.ownerNrsUserId)
    .order('name')

  if (brandsError) {
    console.error('[telegram] failed to load brands:', brandsError.message)
    return NextResponse.json({ received: true })
  }

  const telegramBrands = (brands ?? []) as TelegramBrand[]
  const commandReply = createTelegramCommandReply(authorisation.text, telegramBrands.map((brand) => brand.name))
  if (commandReply) {
    try {
      await deliverTelegramText(config, commandReply)
    } catch (err) {
      console.error('[telegram] command delivery failed:', err)
    }
    return NextResponse.json({ received: true })
  }

  // Telegram retries webhook deliveries. A stored update id prevents a retry
  // from creating a second Director job for the same user message.
  const { data: existingJob, error: existingJobError } = await supabase
    .from('mcp_jobs')
    .select('id')
    .contains('input', { telegram_update_id: update.update_id })
    .maybeSingle()

  if (existingJobError) {
    console.error('[telegram] failed to check duplicate update:', existingJobError.message)
    return NextResponse.json({ received: true })
  }

  if (existingJob) return NextResponse.json({ received: true })

  let jobInput: { brand_id: string; message: string } | null = null
  const dispatch = await dispatchTelegramDirectorRequest({
    text: authorisation.text,
    brands: telegramBrands,
    queueDirectorJob: async ({ brandId, message }) => {
      const { data: job, error: jobError } = await supabase
        .from('mcp_jobs')
        .insert({
          user_id: config.ownerNrsUserId,
          brand_id: brandId,
          job_type: 'director_chat',
          status: 'queued',
          input: {
            brand_id: brandId,
            message,
            channel: 'telegram',
            telegram_update_id: update.update_id,
          },
        })
        .select('id')
        .single()

      if (jobError || !job) throw new Error(jobError?.message ?? 'Failed to queue Director job.')
      jobInput = { brand_id: brandId, message }
      return { jobId: job.id }
    },
  })

  if (dispatch.kind === 'needs_brand') {
    try {
      await deliverTelegramText(config, dispatch.text)
    } catch (err) {
      console.error('[telegram] brand prompt delivery failed:', err)
    }
    return NextResponse.json({ received: true })
  }

  if (!jobInput) {
    console.error('[telegram] queued a job without input:', dispatch.jobId)
    return NextResponse.json({ received: true })
  }

  try {
    await deliverTelegramText(config, `I’m working on ${dispatch.brand.name}. I’ll send the Director’s finished response here.`)
  } catch (err) {
    console.error('[telegram] acknowledgement delivery failed:', err)
  }

  after(async () => {
    try {
      await runDirectorJob(dispatch.jobId, config.ownerNrsUserId, jobInput!)

      const { data: completedJob, error: completedJobError } = await supabase
        .from('mcp_jobs')
        .select('status, result, error')
        .eq('id', dispatch.jobId)
        .single<TelegramJobRow>()

      if (completedJobError || !completedJob) {
        throw new Error(completedJobError?.message ?? 'Director job result was not found.')
      }

      const response = completedJob.status === 'done' ? getDirectorResponse(completedJob.result) : null
      await deliverTelegramText(
        config,
        response ?? 'I couldn’t complete that request. Please try again, or make the marketing request more specific.',
      )
    } catch (err) {
      console.error('[telegram] Director job delivery failed:', err)
      try {
        await deliverTelegramText(config, 'I couldn’t complete that request. Please try again shortly.')
      } catch (deliveryErr) {
        console.error('[telegram] failure message delivery failed:', deliveryErr)
      }
    }
  })

  return NextResponse.json({ received: true })
}
