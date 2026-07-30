'use client'

export const dynamic = 'force-dynamic'

import { MacroBoard } from '@/components/agency/macro/MacroBoard'

export default function BoardPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <MacroBoard />
    </div>
  )
}
