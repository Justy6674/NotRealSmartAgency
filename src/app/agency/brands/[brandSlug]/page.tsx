import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BrandProfileForm } from '@/components/agency/BrandProfileForm'
import type { Brand } from '@/types/database'

interface Props {
  params: Promise<{ brandSlug: string }>
}

export default async function BrandEditPage({ params }: Props) {
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
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">{brand.name}</h1>
      <BrandProfileForm brand={brand as Brand} />
    </div>
  )
}
