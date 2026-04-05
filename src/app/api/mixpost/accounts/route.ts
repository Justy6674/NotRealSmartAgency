import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const accounts = await fetchMixpostAccounts()

  if (!accounts) {
    return NextResponse.json({ configured: false, accounts: [], brandMapping: {} })
  }

  // Fetch user's brands for mapping
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')
    .eq('user_id', user.id)

  const brandMapping = brands?.length
    ? mapMixpostAccountsToBrands(accounts, brands)
    : {}

  return NextResponse.json({
    configured: true,
    accounts: accounts.map(a => ({ id: a.id, name: a.name, provider: a.provider })),
    brandMapping,
  })
}
