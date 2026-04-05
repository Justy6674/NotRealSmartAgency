'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Users } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { CampaignBrief, type CampaignBriefData, type CampaignDuration } from './CampaignBrief'
import { CampaignTimeline, type TimelineItem } from './CampaignTimeline'
import { DepartmentDeliverable, type DepartmentDeliverableData, type DeliverableStatus } from './DepartmentDeliverable'
import type { AgentType } from '@/types/database'

// The 6 departments that contribute to a campaign
const CAMPAIGN_DEPARTMENTS: { agentType: AgentType; title: string; brief: string }[] = [
  {
    agentType: 'strategy',
    title: 'Strategy & Timeline',
    brief: 'Timeline, milestones, success metrics, 30/60/90 plan alignment',
  },
  {
    agentType: 'content',
    title: 'Content & Copy',
    brief: 'Social posts, blog articles, scripts, messaging framework',
  },
  {
    agentType: 'seo',
    title: 'SEO & Keywords',
    brief: 'Keyword targets, landing page optimisation, topic clusters',
  },
  {
    agentType: 'email',
    title: 'Email Marketing',
    brief: 'Nurture sequence, launch announcement, re-engagement',
  },
  {
    agentType: 'paid_ads',
    title: 'Paid Advertising',
    brief: 'Ad copy, targeting, budget allocation, platform selection',
  },
  {
    agentType: 'compliance',
    title: 'Compliance Review',
    brief: 'AHPRA/TGA review of all campaign materials',
  },
]

interface CampaignPlannerRoomProps {
  brandName: string | null
}

export function CampaignPlannerRoom({ brandName }: CampaignPlannerRoomProps) {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  const [submittedBrief, setSubmittedBrief] = useState<CampaignBriefData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deliverables, setDeliverables] = useState<DepartmentDeliverableData[]>(
    CAMPAIGN_DEPARTMENTS.map(dept => ({
      agentType: dept.agentType,
      title: dept.title,
      content: null,
      status: 'pending' as DeliverableStatus,
    }))
  )
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])

  const handleBriefSubmit = useCallback((brief: CampaignBriefData) => {
    setSubmittedBrief(brief)
    setIsSubmitting(true)

    // Mark all deliverables as generating
    setDeliverables(prev =>
      prev.map(d => ({ ...d, status: 'generating' as DeliverableStatus, content: null }))
    )

    // Build strategy-enriched message for the Director
    const strategyHint = strategyContext?.agentContext ?? ''
    const audienceInfo = brief.audience ? `Target audience: ${brief.audience}. ` : ''

    const message = [
      `Plan a full campaign for ${brandName ?? 'this brand'}: "${brief.name}".`,
      ``,
      `Goal: ${brief.goal}`,
      `Duration: ${brief.duration.replace('_', ' ')}.`,
      audienceInfo,
      ``,
      `Convene a meeting with Strategy, Content, SEO, Email, Paid Ads, and Compliance.`,
      `Each department should provide:`,
      `- Strategy: timeline with phases, milestones, success metrics`,
      `- Content: post themes, blog topics, scripts needed`,
      `- SEO: keyword targets, landing page recommendations`,
      `- Email: sequences, subject lines, send schedule`,
      `- Paid Ads: ad copy, targeting, budget split, platform recommendations`,
      `- Compliance: flag any regulatory risks (AHPRA/TGA if applicable)`,
      ``,
      strategyHint ? `${strategyHint}` : '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)

    // After sending, reset submitting state (the chat panel handles the response)
    setTimeout(() => setIsSubmitting(false), 2000)
  }, [brandName, strategyContext])

  function handleGenerateAll() {
    if (!submittedBrief || !brandName) return
    sendToDirector(
      `For the "${submittedBrief.name}" campaign for ${brandName}, ` +
      `generate ALL content assets across every department. ` +
      `Create the actual posts, emails, ad copy, and blog drafts. Save everything to the output library.`
    )
  }

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to plan a campaign.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Brief input */}
      {!submittedBrief && (
        <CampaignBrief onSubmit={handleBriefSubmit} isSubmitting={isSubmitting} />
      )}

      {/* After brief submitted: timeline + department cards */}
      {submittedBrief && (
        <>
          {/* Campaign header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">{submittedBrief.name}</h2>
              <p className="text-xs text-muted-foreground">{submittedBrief.goal}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSubmittedBrief(null)
                  setDeliverables(CAMPAIGN_DEPARTMENTS.map(dept => ({
                    agentType: dept.agentType,
                    title: dept.title,
                    content: null,
                    status: 'pending' as DeliverableStatus,
                  })))
                  setTimelineItems([])
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                New campaign
              </button>
              <button
                onClick={handleGenerateAll}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate All
              </button>
            </div>
          </div>

          {/* Timeline */}
          <CampaignTimeline
            duration={submittedBrief.duration}
            items={timelineItems}
            campaignName={submittedBrief.name}
          />

          {/* Department cards */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Department Plans</h3>
              <span className="text-[10px] text-muted-foreground">
                {deliverables.filter(d => d.status === 'complete').length}/{deliverables.length} complete
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {deliverables.map(deliverable => (
                <DepartmentDeliverable
                  key={deliverable.agentType}
                  deliverable={deliverable}
                  campaignName={submittedBrief.name}
                  brandName={brandName ?? 'this brand'}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
