'use client'

import { useEffect, useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { createClient } from '@/lib/supabase/client'
import type { Brand } from '@/types/database'
import { cn } from '@/lib/utils'
import { Building2, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function BrandSelector() {
  const [brands, setBrands] = useState<Brand[]>([])
  const { activeBrandId, setBrand } = useAgencyStore()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('brands')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setBrands(data as Brand[])
          if (!activeBrandId && data.length > 0) {
            setBrand(data[0].id)
          }
        }
      })
  }, [activeBrandId, setBrand])

  const activeBrand = brands.find((b) => b.id === activeBrandId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="h-9 gap-2 px-3 text-sm font-medium" />
        }
      >
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[160px] truncate">
          {activeBrand?.name ?? 'Select brand'}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {brands.map((brand) => (
          <DropdownMenuItem
            key={brand.id}
            onClick={() => setBrand(brand.id)}
            className={cn(
              'flex flex-col items-start gap-0.5',
              brand.id === activeBrandId && 'bg-primary/5'
            )}
          >
            <span className="font-medium">{brand.name}</span>
            {brand.tagline && (
              <span className="text-xs text-muted-foreground">{brand.tagline}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
