/**
 * Never serve Telegram a stale copy of the Mini App.
 *
 * Telegram's in-app browser caches this page hard, and it does not reload on
 * reopening. Fixes shipped hours earlier kept coming back reported as still
 * broken — a header removed at 14:43 was still on screen at 18:03, and the
 * only cure was force-quitting Telegram, which nobody should have to know.
 */

import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function TelegramLayout({ children }: { children: ReactNode }) {
  return children
}
