'use client'

import { Activity } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import type { AgentActivityEntry } from '@/hooks/useStudioData'
import type { AgentType } from '@/types/database'
import { AGENT_COLOURS } from '@/components/agency/AgentAvatar'

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

const ACTION_LABELS: Record<string, string> = {
  delegation_completed: 'completed a task',
  output_saved: 'saved content',
  scan_completed: 'finished scanning',
  task_created: 'created a task',
  task_completed: 'completed a task',
  chat_completed: 'responded',
  approval_requested: 'requested approval',
  heartbeat_completed: 'ran autonomously',
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface AgentActivityCardProps {
  agentActivity: AgentActivityEntry[]
}

export function AgentActivityCard({ agentActivity }: AgentActivityCardProps) {
  const { setChatPanelOpen, setPendingReviewMessage } = useAgencyStore()

  if (agentActivity.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-foreground">Agent Activity</h3>
        </div>
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-2">Your agents are ready — start a conversation to put them to work.</p>
          <button
            onClick={() => {
              setChatPanelOpen(true)
              setPendingReviewMessage('What should we work on today?')
            }}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Get started
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-foreground">Agent Activity</h3>
      </div>

      <div className="space-y-2">
        {agentActivity.slice(0, 6).map(entry => {
          const agentType = entry.agent_type as AgentType
          const personality = AGENT_PERSONALITIES[agentType] ?? agentType
          const colours = AGENT_COLOURS[agentType] ?? AGENT_COLOURS.overall
          const badgeClasses = colours.split(' ').slice(0, 2).join(' ')
          const action = ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, ' ')

          return (
            <div key={entry.id} className="flex items-center gap-2">
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeClasses}`}>
                {personality}
              </span>
              <span className="text-xs text-foreground/70 flex-1 min-w-0 truncate">
                {action}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {timeAgo(entry.created_at)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
