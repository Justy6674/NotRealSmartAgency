'use client'

import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ComplianceBadgeProps {
  ahpra?: boolean
  tga?: boolean
}

export function ComplianceBadge({ ahpra, tga }: ComplianceBadgeProps) {
  if (!ahpra && !tga) return null

  const labels: string[] = []
  if (ahpra) labels.push('AHPRA')
  if (tga) labels.push('TGA')

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    >
      <ShieldCheck className="h-3 w-3" />
      {labels.join(' + ')} Compliance Active
    </Badge>
  )
}
