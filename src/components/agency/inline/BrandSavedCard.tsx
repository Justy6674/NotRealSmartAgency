'use client'

import { CheckCircle2, Plus } from 'lucide-react'

interface BrandSavedCardProps {
  action: 'created' | 'updated'
  brand_name: string
  fields: string[]
}

export function BrandSavedCard({ action, brand_name, fields }: BrandSavedCardProps) {
  return (
    <div className="my-2 max-w-md rounded-xl border border-green-500/20 bg-green-500/5 p-4">
      <div className="flex items-center gap-2">
        {action === 'created' ? (
          <Plus className="h-4 w-4 text-green-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
        <span className="text-sm font-medium text-foreground">
          {action === 'created' ? 'Brand created' : 'Brand updated'}: {brand_name}
        </span>
      </div>
      {fields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fields.map((field) => (
            <span
              key={field}
              className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400"
            >
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
