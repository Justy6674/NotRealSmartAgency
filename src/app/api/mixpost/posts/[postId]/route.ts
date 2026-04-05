import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchMixpostPost,
  updateMixpostPost,
  deleteMixpostPost,
} from '@/lib/mixpost/client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { postId } = await params
  const post = await fetchMixpostPost(postId)

  if (!post) {
    return NextResponse.json({ error: 'Post not found or Mixpost unavailable' }, { status: 404 })
  }

  return NextResponse.json(post)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { postId } = await params
  const body = await request.json()
  const success = await updateMixpostPost(postId, body)

  if (!success) {
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { postId } = await params
  const success = await deleteMixpostPost(postId)

  if (!success) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
