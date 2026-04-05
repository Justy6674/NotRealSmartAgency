import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addMixpostPostToQueue } from '@/lib/mixpost/client'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { postId } = await params
  const success = await addMixpostPostToQueue(postId)

  if (!success) {
    return NextResponse.json({ error: 'Failed to add post to queue' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
