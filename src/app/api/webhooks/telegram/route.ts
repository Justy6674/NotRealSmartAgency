import { NextResponse } from 'next/server'
import { TELEGRAM_CHANNEL_STATUS } from '@/lib/telegram/telegram-channel-status'

export const runtime = 'nodejs'

/**
 * Fail closed. Telegram must not enumerate projects, retrieve memory, create
 * jobs or send Director output until channel pairing is backed by explicit
 * project grants. Returning 200 prevents Telegram from retrying private input.
 */
export async function POST() {
  return NextResponse.json({ received: true, status: TELEGRAM_CHANNEL_STATUS })
}
