import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BrandSettings } from '@/components/agency/BrandSettings'
import type { Brand } from '@/types/database'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ brandSlug: string }>
}

export default async function BrandSettingsPage({ params }: Props) {
  const { brandSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', brandSlug)
    .single()

  if (!brand) notFound()

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        {brand.logo_url ? (
          <img src={brand.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
        ) : (
          <span
            className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold"
            style={{ background: 'oklch(0.25 0.01 240)', color: 'oklch(0.7 0.01 240)' }}
          >
            {brand.name.charAt(0)}
          </span>
        )}
        <h1 className="text-xl font-bold">{brand.name}</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {brand.business_stage}
        </span>
      </div>
      <BrandSettings brand={brand as Brand} />
    </div>
  )
}
