'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { AGENT_LABELS } from '@/types/database'
import { AgentAvatar } from './AgentAvatar'
import { ComplianceBadge } from './ComplianceBadge'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Brand } from '@/types/database'

export function AgencyHeader() {
  const { activeBrandId, activeAgentType } = useAgencyStore()
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    if (!activeBrandId) {
      setBrand(null)
      return
    }
    const supabase = createClient()
    supabase
      .from('brands')
      .select('*')
      .eq('id', activeBrandId)
      .single()
      .then(({ data }) => {
        if (data) setBrand(data as Brand)
      })
  }, [activeBrandId])

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      <AgentAvatar agentType={activeAgentType} size="sm" />
      <span className="text-sm font-medium text-foreground">
        {AGENT_LABELS[activeAgentType]}
      </span>
      {brand && (
        <>
          <span className="text-muted-foreground/50">|</span>
          <span className="text-sm text-muted-foreground">{brand.name}</span>
          <ComplianceBadge
            ahpra={brand.compliance_flags?.ahpra}
            tga={brand.compliance_flags?.tga}
          />
        </>
      )}
    </div>
  )
}
