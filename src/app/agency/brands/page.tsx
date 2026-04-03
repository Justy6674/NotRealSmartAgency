export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Brand } from '@/types/database'
import { BrandCard } from '@/components/agency/BrandCard'

export default async function BrandsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brands } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Brands</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(brands as Brand[] | null)?.map((brand) => (
          <BrandCard key={brand.id} brand={brand} />
        ))}
      </div>
    </div>
  )
}
