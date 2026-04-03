'use client'

import { ExternalLink, Github, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
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

const MARKETING_LABELS: Record<string, string> = {
  unknown: 'Not assessed',
  no_marketing: 'No marketing presence',
  early_stage: 'Early stage',
  needs_strategy: 'Needs strategy',
  active: 'Active',
  scaling: 'Scaling',
}

// ─── Brand Intelligence Briefing ────────────────────────────────────────────

function BrandBriefing({ brand, onAction }: { brand: Brand; onAction: (msg: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Auto-sync GitHub if repo URL exists but context hasn't been pulled
  const autoSyncGithub = async () => {
    if (!brand.github_url || brand.github_context || syncing) return
    setSyncing(true)
    try {
      await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brand.id }),
      })
    } catch { /* ignore */ }
    setSyncing(false)
  }

  // What we know vs what's missing
  const hasWebsite = !!brand.website_url
  const hasGithub = !!brand.github_url
  const hasGithubContext = !!brand.github_context
  const hasSocials = brand.social_urls && Object.keys(brand.social_urls).length > 0
  const hasCompetitors = brand.competitors && brand.competitors.length > 0
  const hasProducts = brand.products_services && brand.products_services.length > 0
  const hasTone = brand.tone_of_voice && brand.tone_of_voice.keywords?.length > 0
  const hasAudience = brand.target_audience && brand.target_audience.demographics
  const hasPillars = brand.content_pillars && brand.content_pillars.length > 0
  const hasVideoPrefs = brand.video_preferences && Object.keys(brand.video_preferences).length > 0
  const hasMarketingNotes = !!brand.marketing_notes
  const marketingStatus = brand.marketing_status ?? 'unknown'

  const knownCount = [hasWebsite, hasGithub, hasSocials, hasCompetitors, hasProducts, hasTone, hasAudience, hasPillars].filter(Boolean).length
  const totalChecks = 8
  const completeness = Math.round((knownCount / totalChecks) * 100)

  return (
    <div className="w-full max-w-lg space-y-3">
      {/* Brand header card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
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
            <p className="truncate font-semibold text-foreground">{brand.name}</p>
            {brand.tagline && <p className="mt-0.5 text-sm text-muted-foreground">{brand.tagline}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {brand.niche && <span>{brand.niche}</span>}
              {brand.business_stage && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  {STAGE_LABELS[brand.business_stage] ?? brand.business_stage}
                </span>
              )}
              {marketingStatus !== 'unknown' && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  marketingStatus === 'no_marketing' ? 'bg-red-500/10 text-red-500' :
                  marketingStatus === 'active' || marketingStatus === 'scaling' ? 'bg-green-500/10 text-green-500' :
                  'bg-amber-500/10 text-amber-500'
                }`}>
                  {MARKETING_LABELS[marketingStatus]}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {brand.github_url && (
              <a href={brand.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary"><Github className="h-3.5 w-3.5" /></a>
            )}
            {brand.website_url && (
              <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>
            )}
          </div>
        </div>

        {(brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ComplianceBadge ahpra={brand.compliance_flags.ahpra} tga={brand.compliance_flags.tga} />
          </div>
        )}

        {hasMarketingNotes && (
          <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">{brand.marketing_notes}</p>
        )}
      </div>

      {/* Intelligence briefing — expandable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
      >
        <span className="font-medium">What I know about your brand</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${completeness >= 75 ? 'text-green-500' : completeness >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
            {completeness}% complete
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
          {/* Checklist of what we know */}
          <div className="grid gap-1.5">
            <KnowItem ok={hasWebsite} label="Website" detail={brand.website_url} />
            <KnowItem ok={hasGithub} label="GitHub repo" detail={hasGithubContext ? 'Synced' : syncing ? 'Syncing...' : brand.github_url ? 'Not synced yet' : undefined} />
            {hasGithub && !hasGithubContext && !syncing && (
              <button onClick={autoSyncGithub} className="ml-5 text-[10px] text-primary hover:underline">Sync now</button>
            )}
            <KnowItem ok={hasSocials} label="Social profiles" detail={hasSocials ? Object.keys(brand.social_urls!).join(', ') : undefined} />
            <KnowItem ok={hasCompetitors} label="Competitors" detail={hasCompetitors ? `${brand.competitors!.length} tracked` : undefined} />
            <KnowItem ok={hasProducts} label="Products & services" detail={hasProducts ? `${brand.products_services!.length} listed` : undefined} />
            <KnowItem ok={hasTone} label="Brand voice & tone" detail={hasTone ? `${brand.tone_of_voice.formality}, ${brand.tone_of_voice.humour} humour` : undefined} />
            <KnowItem ok={!!hasAudience} label="Target audience" detail={hasAudience ? brand.target_audience.demographics : undefined} />
            <KnowItem ok={hasPillars} label="Content pillars" detail={hasPillars ? brand.content_pillars!.join(', ') : undefined} />
            {hasVideoPrefs && <KnowItem ok={true} label="Video preferences" detail={brand.video_preferences.presenter_style ?? 'Configured'} />}
          </div>

          {/* What's missing — actionable */}
          {completeness < 100 && (
            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Missing — fill these in Brand Settings for better results:</p>
              {!hasSocials && <MissingItem label="Social media URLs" />}
              {!hasCompetitors && <MissingItem label="Competitors" />}
              {!hasProducts && <MissingItem label="Products & services" />}
              {!hasTone && <MissingItem label="Brand voice & tone" />}
              {!hasAudience && <MissingItem label="Target audience" />}
              {!hasPillars && <MissingItem label="Content pillars" />}
            </div>
          )}

          {/* Quick fill action */}
          {completeness < 75 && (
            <button
              onClick={() => onAction(`I need help setting up my brand profile for ${brand.name}. Ask me questions about my target audience, brand voice, competitors, and products so you can fill in the gaps.`)}
              className="w-full text-xs rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-primary hover:bg-primary/10 transition-colors"
            >
              Help me fill in the gaps — ask me questions
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function KnowItem({ ok, label, detail }: { ok: boolean; label: string; detail?: string | null }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
      <span className={ok ? 'text-foreground' : 'text-muted-foreground/60'}>{label}</span>
      {detail && <span className="text-muted-foreground truncate ml-auto max-w-[200px]">{detail}</span>}
    </div>
  )
}

function MissingItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-amber-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{label}</span>
    </div>
  )
}

// ─── Main WelcomeScreen ─────────────────────────────────────────────────────

export function WelcomeScreen({ brand, onAction }: WelcomeScreenProps) {
  const { activeAgentType } = useAgencyStore()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
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

      {/* Brand intelligence briefing */}
      {brand && <BrandBriefing brand={brand} onAction={onAction} />}

      {/* Quick action chips */}
      <QuickActions brand={brand} agentType={activeAgentType} onAction={onAction} />
    </div>
  )
}
