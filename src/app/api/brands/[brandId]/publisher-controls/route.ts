import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { JUSTIN_OWNER_EMAIL, publisherTransportOf } from '@/lib/publishers/transport'
import { resumeLinkedBrandPosting } from '@/lib/publishers/billing-pause'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'

export const dynamic = 'force-dynamic'

async function justinOwnsBrand(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | undefined,
  brandId: string,
) {
  if (email !== JUSTIN_OWNER_EMAIL) return null
  const { data: brand } = await supabase
    .from('brands')
    .select('id, user_id, social_urls')
    .eq('id', brandId)
    .eq('user_id', userId)
    .maybeSingle()
  return brand
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { brandId } = await params
  const brand = await justinOwnsBrand(supabase, user.id, user.email, brandId)
  if (!brand) return NextResponse.json({ canControl: false })

  return NextResponse.json({
    canControl: true,
    transport: publisherTransportOf(brand.social_urls),
    linked: !!zernioProfileIdFromSocialUrls(brand.social_urls),
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { brandId } = await params
  const brand = await justinOwnsBrand(supabase, user.id, user.email, brandId)
  if (!brand) return NextResponse.json({ error: 'Not available.' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as {
    publisher_transport?: string
    resume?: boolean
  }

  if (body.resume === true) {
    await resumeLinkedBrandPosting()
    return NextResponse.json({ ok: true, resumed: true })
  }

  if (body.publisher_transport === 'zernio' || body.publisher_transport === 'mixpost') {
    const urls = (brand.social_urls as Record<string, unknown> | null) ?? {}
    const { error } = await supabase
      .from('brands')
      .update({ social_urls: { ...urls, publisher_transport: body.publisher_transport } })
      .eq('id', brandId)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Could not save that setting.' }, { status: 500 })
    return NextResponse.json({ ok: true, transport: body.publisher_transport })
  }

  return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
}
