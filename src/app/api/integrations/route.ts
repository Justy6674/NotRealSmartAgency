import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v3'
import type { IntegrationProvider } from '@/types/database'

const SaveIntegrationSchema = z.object({
  provider: z.enum(['runway', 'synthesia', 'kling', 'google_veo']),
  api_key: z.string().min(1),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_integrations')
    .select('provider, is_active, updated_at')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const parsed = SaveIntegrationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
  }

  const { provider, api_key } = parsed.data

  const { data, error } = await supabase
    .from('user_integrations')
    .upsert({
      user_id: user.id,
      provider: provider as IntegrationProvider,
      cached_data: { api_key },
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })
    .select('provider, is_active, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
