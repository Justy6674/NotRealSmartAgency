import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Brand } from '@/types/database'

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
          <Link key={brand.id} href={`/agency/brands/${brand.slug}`}>
            <Card className="p-4 space-y-2 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between">
                <h2 className="font-medium">{brand.name}</h2>
                {(brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    Regulated
                  </Badge>
                )}
              </div>
              {brand.tagline && (
                <p className="text-sm text-muted-foreground">{brand.tagline}</p>
              )}
              <p className="text-xs text-muted-foreground">{brand.niche}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
