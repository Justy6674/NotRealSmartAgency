'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { AGENT_LABELS } from '@/types/database'
import { AgentAvatar } from './AgentAvatar'
import { ComplianceBadge } from './ComplianceBadge'
import { useEffect, useState } from 'react'
import type { Brand } from '@/types/database'

export function AgencyHeader() {
  const { activeBrandId, activeAgentType } = useAgencyStore()
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    if (!activeBrandId) {
      setBrand(null)
      return
    }

    // Fetch via API (server-side auth) — not direct Supabase client
    fetch('/api/brands')
      .then(r => r.ok ? r.json() : [])
      .then((brands: Brand[]) => {
        const match = brands.find(b => b.id === activeBrandId)
        setBrand(match ?? null)
      })
      .catch(() => setBrand(null))
  }, [activeBrandId])

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
      {/* Brand logo — always visible at far left */}
      {brand && (
        <div className="flex items-center gap-2 shrink-0">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="h-6 w-6 rounded object-cover" />
          ) : (
            <span
              className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold"
              style={{ background: 'oklch(0.25 0.01 240)', color: 'oklch(0.7 0.01 240)' }}
            >
              {brand.name.charAt(0)}
            </span>
          )}
          <span className="text-sm font-medium text-foreground">{brand.name}</span>
        </div>
      )}

      {brand && <span className="text-muted-foreground/30">|</span>}

      {/* Agent identity */}
      <AgentAvatar agentType={activeAgentType} size="sm" />
      <span className="text-sm text-muted-foreground">
        {AGENT_LABELS[activeAgentType]}
      </span>

      {/* Compliance badges */}
      {brand && (
        <ComplianceBadge
          ahpra={brand.compliance_flags?.ahpra}
          tga={brand.compliance_flags?.tga}
        />
      )}

      {/* Business stage pill */}
      {brand?.business_stage && (
        <span className="ml-auto hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
          {brand.business_stage}
        </span>
      )}
    </div>
  )
}
