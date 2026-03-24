'use client'

import { ExternalLink, Github } from 'lucide-react'
import { QuickActions } from './QuickActions'
import { ComplianceBadge } from './ComplianceBadge'
import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS } from '@/types/database'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

interface WelcomeScreenProps {
  brand?: Brand | null
  onAction: (message: string) => void
}

const STAGE_LABELS: Record<string, string> = {
  idea: 'Idea Stage',
  mvp: 'MVP',
  launch: 'Just Launched',
  growth: 'Growth',
  scale: 'Scaling',
  mature: 'Mature',
}

export function WelcomeScreen({ brand, onAction }: WelcomeScreenProps) {
  const { activeAgentType } = useAgencyStore()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      {/* Agent identity */}
      <div className="flex flex-col items-center gap-3 text-center">
        <AgentAvatar agentType={activeAgentType} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {AGENT_LABELS[activeAgentType]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeAgentType === 'overall'
              ? 'I oversee all departments. How can I help?'
              : 'What would you like to work on?'}
          </p>
        </div>
        {!brand && (
          <p className="text-xs text-muted-foreground">
            Select a brand from the sidebar to get started.
          </p>
        )}
      </div>

      {/* Brand summary card */}
      {brand && (
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {/* Brand logo */}
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold shrink-0"
                style={{ background: 'oklch(0.25 0.01 240)', color: 'oklch(0.7 0.01 240)' }}
              >
                {brand.name.charAt(0)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {brand.name}
              </p>
              {brand.tagline && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {brand.tagline}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {brand.niche && <span>{brand.niche}</span>}
                {brand.business_stage && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                    {STAGE_LABELS[brand.business_stage] ?? brand.business_stage}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {brand.github_url && (
                <a
                  href={brand.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                  aria-label="GitHub repo"
                >
                  <Github className="h-3.5 w-3.5" />
                </a>
              )}
              {brand.website_url && (
                <a
                  href={brand.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                  aria-label={`Visit ${brand.name} website`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Compliance pills */}
          {(brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <ComplianceBadge
                ahpra={brand.compliance_flags.ahpra}
                tga={brand.compliance_flags.tga}
              />
            </div>
          )}
        </div>
      )}

      {/* Quick action chips */}
      <QuickActions brand={brand} onAction={onAction} />
    </div>
  )
}
