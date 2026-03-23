'use client'

import { Label } from '@/components/ui/label'
import { PROFESSION_LABELS, type ProfessionType } from '@/types/database'

interface ProfessionSelectorProps {
  value: ProfessionType
  onChange: (value: ProfessionType) => void
}

export function ProfessionSelector({ value, onChange }: ProfessionSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="profession">Profession Type</Label>
      <select
        id="profession"
        value={value}
        onChange={(e) => onChange(e.target.value as ProfessionType)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {Object.entries(PROFESSION_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
