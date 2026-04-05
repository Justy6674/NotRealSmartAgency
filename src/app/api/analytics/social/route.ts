import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts, fetchMixpostReports, friendlyProvider } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const period = searchParams.get('period') ?? '7_days'

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const accounts = await fetchMixpostAccounts()
  if (!accounts) {
    return NextResponse.json({ configured: false })
  }

  // Fetch user's brands for mapping
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('user_id', user.id)

  if (!brands?.length) {
    return NextResponse.json({ configured: false })
  }

  const brandMap = mapAccountsToBrandsRaw(accounts, brands)
  const brandAccounts = brandMap.get(brandId)

  if (!brandAccounts?.length) {
    return NextResponse.json({ configured: true, platforms: {} })
  }

  // Fetch reports for each account belonging to this brand
  const platforms: Record<string, { metrics: Record<string, unknown> }> = {}

  const reportResults = await Promise.allSettled(
    brandAccounts.map(async (account) => {
      const report = await fetchMixpostReports(account.id, period)
      return { account, report }
    })
  )

  let hasError = false

  for (const result of reportResults) {
    if (result.status === 'fulfilled' && result.value.report) {
      const { account, report } = result.value
      const platformName = friendlyProvider(account.provider)
      platforms[platformName] = {
        metrics: report.metrics ?? {},
      }
    } else if (result.status === 'rejected') {
      hasError = true
    }
  }

  // If we got some platforms, return them. If all failed, indicate the error.
  if (Object.keys(platforms).length === 0 && hasError) {
    return NextResponse.json({
      configured: true,
      error: 'Analytics not available',
    })
  }

  return NextResponse.json({ configured: true, platforms })
}
