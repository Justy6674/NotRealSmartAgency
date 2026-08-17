import { NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { createClient } from '@/lib/supabase/server'

const Body = z.object({
  action: z.enum(['on_site', 'dismiss']),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id } = await context.params
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: existing, error: readError } = await supabase
    .from('outputs')
    .select('id, metadata, output_type')
    .eq('id', id)
    .single()

  if (readError || !existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }
  if (existing.output_type !== 'blog_article') {
    return NextResponse.json({ error: 'Not a blog post' }, { status: 400 })
  }

  const metadata = {
    ...((existing.metadata as Record<string, unknown> | null) ?? {}),
    ...(parsed.data.action === 'on_site'
      ? {
          blog_handover: 'on_site',
          published_on_site_at: new Date().toISOString(),
        }
      : { blog_handover: 'dismissed' }),
  }

  const { error } = await supabase.from('outputs').update({ metadata }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
