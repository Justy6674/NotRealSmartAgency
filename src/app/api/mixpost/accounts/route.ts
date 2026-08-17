import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands, mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { brandIsPublisherLinked } from '@/lib/studio/social-read-source'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const brandId = new URL(request.url).searchParams.get('brandId')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')
    .eq('user_id', user.id)

  // A linked brand must never receive Mixpost's workspace. The owner-facing
  // hook should not call this route for those brands; this is the backstop
  // if it does, or if brandId is present on an old client.
  if (brandId) {
    const brand = brands?.find((row) => row.id === brandId)
    if (!brand) {
      return NextResponse.json({ configured: false, accounts: [], brandMapping: {} })
    }
    if (brandIsPublisherLinked(brand.social_urls)) {
      return NextResponse.json({ configured: true, accounts: [], brandMapping: {} })
    }
  }

  const accounts = await fetchMixpostAccounts()

  if (!accounts) {
    return NextResponse.json({ configured: false, accounts: [], brandMapping: {} })
  }

  const brandMapping = brands?.length
    ? mapMixpostAccountsToBrands(accounts, brands)
    : {}

  if (brandId) {
    const scoped = brands?.length
      ? (mapAccountsToBrandsRaw(accounts, brands).get(brandId) ?? [])
      : []
    return NextResponse.json({
      configured: true,
      accounts: scoped.map((a) => ({
        id: a.id,
        name: a.name,
        username: a.username,
        provider: a.provider,
        media_url: a.media_url,
      })),
      brandMapping: { [brandId]: brandMapping[brandId] ?? [] },
    })
  }

  return NextResponse.json({
    configured: true,
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name,
      username: a.username,
      provider: a.provider,
      media_url: a.media_url,
    })),
    brandMapping,
  })
}
