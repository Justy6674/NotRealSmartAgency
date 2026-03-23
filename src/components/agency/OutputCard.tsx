'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OUTPUT_LABELS } from '@/types/database'
import type { Output } from '@/types/database'

interface OutputCardProps {
  output: Output & { brands?: { name: string; slug: string } }
}

export function OutputCard({ output }: OutputCardProps) {
  const label = OUTPUT_LABELS[output.output_type] ?? output.output_type

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium line-clamp-1">{output.title}</h3>
        <Badge variant="outline" className="shrink-0 text-xs">
          {label}
        </Badge>
      </div>
      {output.brands && (
        <p className="text-xs text-muted-foreground">{output.brands.name}</p>
      )}
      <p className="text-xs text-muted-foreground line-clamp-3">
        {output.content}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {new Date(output.created_at).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
    </Card>
  )
}
