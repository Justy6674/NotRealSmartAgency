'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Search } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  no_marketing: { label: 'No Marketing', className: 'bg-red-500/10 text-red-500' },
  early_stage: { label: 'Early Stage', className: 'bg-amber-500/10 text-amber-500' },
  needs_strategy: { label: 'Needs Strategy', className: 'bg-amber-500/10 text-amber-500' },
  active: { label: 'Active', className: 'bg-green-500/10 text-green-500' },
  scaling: { label: 'Scaling', className: 'bg-emerald-500/10 text-emerald-500' },
}

export function BrandCard({ brand }: { brand: Brand }) {
  const router = useRouter()
  const { setBrand, setPendingReviewMessage } = useAgencyStore()
  const [reviewing, setReviewing] = useState(false)

  const statusBadge = STATUS_BADGES[brand.marketing_status]

  const handleReview = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setReviewing(true)

    try {
      const res = await fetch(`/api/brands/${brand.id}/review`, { method: 'POST' })
      if (!res.ok) throw new Error('Review failed')

      const { firstMessage } = await res.json()
      setBrand(brand.id)
      setPendingReviewMessage(firstMessage)
      router.push('/agency/chat')
    } catch {
      setReviewing(false)
    }
  }

  return (
    <Link href={`/agency/brands/${brand.slug}`}>
      <Card className="p-4 space-y-2 hover:bg-muted/50 transition-colors flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{brand.name}</h2>
          <div className="flex gap-1.5 shrink-0">
            {statusBadge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            )}
            {(brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) && (
              <Badge variant="outline" className="text-xs text-amber-600">
                Regulated
              </Badge>
            )}
          </div>
        </div>
        {brand.tagline && (
          <p className="text-sm text-muted-foreground">{brand.tagline}</p>
        )}
        <p className="text-xs text-muted-foreground">{brand.niche}</p>

        <div className="pt-2 mt-auto">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleReview}
            disabled={reviewing}
          >
            {reviewing ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Scanning...</>
            ) : (
              <><Search className="h-3.5 w-3.5 mr-1.5" /> Review Brand</>
            )}
          </Button>
        </div>
      </Card>
    </Link>
  )
}
