'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { AGENT_COLOURS } from '@/components/agency/AgentAvatar'
import type { AgentType } from '@/types/database'

const AGENT_PERSONALITIES: Record<string, string> = {
  overall: 'The Director',
  content: 'The Storyteller',
  seo: 'The Search Scientist',
  paid_ads: 'The Performance Marketer',
  strategy: 'The Strategist',
  email: 'The Relationship Builder',
  growth: 'The Growth Hacker',
  brand: 'The Brand Guardian',
  competitor: 'The Intelligence Analyst',
  website: 'The Conversion Architect',
  compliance: 'The Regulatory Shield',
  analytics: 'The Data Translator',
  automation: 'The Systems Architect',
  video: 'The Visual Director',
}

export type DeliverableStatus = 'pending' | 'generating' | 'complete'

export interface DepartmentDeliverableData {
  agentType: AgentType
  title: string
  content: string | null
  status: DeliverableStatus
}

interface DepartmentDeliverableProps {
  deliverable: DepartmentDeliverableData
  campaignName: string
  brandName: string
}

export function DepartmentDeliverable({ deliverable, campaignName, brandName }: DepartmentDeliverableProps) {
  const [expanded, setExpanded] = useState(deliverable.status === 'complete')
  const personality = AGENT_PERSONALITIES[deliverable.agentType] ?? deliverable.agentType
  const colours = AGENT_COLOURS[deliverable.agentType] ?? AGENT_COLOURS.overall
  const badgeClasses = colours.split(' ').slice(0, 2).join(' ')

  function handleGenerateAssets() {
    sendToDirector(
      `For the "${campaignName}" campaign for ${brandName}, ` +
      `generate the ${deliverable.title.toLowerCase()} deliverables. ` +
      `Focus on what the ${personality} department recommended. Create the actual content assets.`
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Agent badge */}
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', badgeClasses)}>
          {personality}
        </span>

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-foreground">{deliverable.title}</span>

        {/* Status indicator */}
        {deliverable.status === 'pending' && (
          <span className="text-[10px] text-muted-foreground">Pending</span>
        )}
        {deliverable.status === 'generating' && (
          <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
        )}
        {deliverable.status === 'complete' && (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        )}

        {/* Expand chevron */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {deliverable.content ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {deliverable.content}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No plan generated yet. Click &ldquo;Plan Campaign&rdquo; above to convene all departments.
            </p>
          )}

          {/* Generate assets button */}
          {deliverable.status === 'complete' && (
            <button
              onClick={handleGenerateAssets}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate assets
            </button>
          )}
        </div>
      )}
    </div>
  )
}
