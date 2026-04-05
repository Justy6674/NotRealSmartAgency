import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pollRemoteUploadStatus } from '@/lib/mixpost/client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await params
  const result = await pollRemoteUploadStatus(id)

  return NextResponse.json(result)
}
