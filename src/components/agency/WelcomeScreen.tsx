'use client'

import { ExternalLink } from 'lucide-react'
import { QuickActions } from './QuickActions'
import { ComplianceBadge } from './ComplianceBadge'
import type { Brand } from '@/types/database'

interface WelcomeScreenProps {
  brand?: Brand | null
  onAction: (message: string) => void
}

export function WelcomeScreen({ brand, onAction }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      {/* Heading */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          What would you like to work on?
        </h1>
        {!brand && (
          <p className="mt-2 text-sm text-muted-foreground">
            Select a brand from the sidebar to get started.
          </p>
        )}
      </div>

      {/* Brand summary card */}
      {brand && (
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {brand.name}
              </p>
              {brand.tagline && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {brand.tagline}
                </p>
              )}
              {brand.niche && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {brand.niche}
                </p>
              )}
            </div>
            {brand.website_url && (
              <a
                href={brand.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                aria-label={`Visit ${brand.name} website`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Visit site</span>
              </a>
            )}
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
