import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readStockCapability } from '../capability'

export const runtime = 'nodejs'
// Never cached. The whole point is that adding a credential and redeploying
// changes the answer; a cached one would keep the tabs dark after the fix.
export const dynamic = 'force-dynamic'

/**
 * What the media library is allowed to put on the glass.
 *
 * The desk is a client component and cannot read a server-only credential, so
 * it asks. Booleans only — this answers "is it switched on", never "with what",
 * so a signed-in reader learns nothing they could spend.
 *
 * Behind the sign-in like the search itself: the shape of our supplier set is
 * not a stranger's business, and every route in this folder answering the same
 * question the same way is one fewer place to forget the door.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Your session expired. Tap Reload once and sign in again.' },
      { status: 401 },
    )
  }

  return NextResponse.json(readStockCapability())
}
