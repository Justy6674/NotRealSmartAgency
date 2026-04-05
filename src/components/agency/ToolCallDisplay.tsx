'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Wrench, ChevronDown, ChevronRight, Loader2, Check, Users } from 'lucide-react'
import { AGENT_LABELS } from '@/types/database'
import type { AgentType } from '@/types/database'

interface ToolCallDisplayProps {
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  state: string
}

const TOOL_LABELS: Record<string, string> = {
  save_output: 'Saving to output library',
  word_count: 'Checking word/character count',
  delegate_to_agent: 'Delegating to specialist',
  scan_website: 'Scanning website',
  scan_github: 'Reading GitHub repository',
  scan_social: 'Checking social media',
  marketing_audit: 'Running marketing audit',
  browse_page: 'Browsing page in detail',
  generate_image: 'Generating image',
  send_email: 'Sending email',
  read_gmail: 'Searching Gmail',
  generate_slides: 'Creating presentation',
  create_task: 'Creating task',
  request_approval: 'Requesting approval',
  handoff_to_department: 'Handing off to specialist',
  convene_meeting: 'Convening team meeting',
  web_search: 'Searching the web',
  design_graphic: 'Designing in Canva',
  export_design: 'Exporting design',
  create_video: 'Creating video',
  fill_calendar: 'Filling content calendar',
  write_blog: 'Writing blog article',
  write_ads: 'Writing ad copy',
  write_email_campaign: 'Writing email campaign',
  deep_competitor_scan: 'Deep scanning competitor',
  manage_posts: 'Managing posts',
  analyse_voice: 'Analysing brand voice',
  repurpose_content: 'Repurposing content',
  process_media: 'Processing media',
  query_outputs: 'Searching past work',
  query_analytics: 'Pulling analytics',
  query_calendar: 'Checking calendar',
  read_proforma: 'Reading marketing proforma',
  update_proforma: 'Updating proforma',
  save_brand_info: 'Saving brand info',
}

/** Agent personality names — shown to user during delegation */
const AGENT_PERSONALITIES: Record<string, { name: string; colour: string }> = {
  content: { name: 'The Storyteller', colour: 'bg-teal-500/10 text-teal-400' },
  seo: { name: 'The Search Scientist', colour: 'bg-blue-500/10 text-blue-400' },
  paid_ads: { name: 'The Performance Marketer', colour: 'bg-orange-500/10 text-orange-400' },
  strategy: { name: 'The Strategist', colour: 'bg-purple-500/10 text-purple-400' },
  email: { name: 'The Relationship Builder', colour: 'bg-pink-500/10 text-pink-400' },
  growth: { name: 'The Growth Hacker', colour: 'bg-green-500/10 text-green-400' },
  brand: { name: 'The Brand Guardian', colour: 'bg-amber-500/10 text-amber-400' },
  competitor: { name: 'The Intelligence Analyst', colour: 'bg-red-500/10 text-red-400' },
  website: { name: 'The Conversion Architect', colour: 'bg-cyan-500/10 text-cyan-400' },
  compliance: { name: 'The Regulatory Shield', colour: 'bg-yellow-500/10 text-yellow-500' },
  analytics: { name: 'The Data Translator', colour: 'bg-indigo-500/10 text-indigo-400' },
  automation: { name: 'The Systems Architect', colour: 'bg-slate-500/10 text-slate-400' },
  video: { name: 'The Visual Director', colour: 'bg-violet-500/10 text-violet-400' },
}

// ─── Real-Time Delegation Progress ─────────────────────────────────────────
//
// Polls agent_registry.status to detect ACTUAL completion instead of fake timers.
// The AgentWorker sets status='working' on start and status='idle' on finish.
// This is the Anthropic pattern: terminal state (idle/completed) = done.

function DelegationProgress({ agentType, isComplete }: { agentType: string; isComplete: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  const [agentDone, setAgentDone] = useState(false)
  const personality = AGENT_PERSONALITIES[agentType]

  const effectiveComplete = isComplete || agentDone

  // Elapsed timer
  useEffect(() => {
    if (effectiveComplete) return
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [effectiveComplete])

  // Poll agent_registry for real completion signal
  useEffect(() => {
    if (isComplete) return

    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/agents?type=${agentType}`)
        if (!res.ok) return
        const data = await res.json()
        // Agent registry returns status: 'working' | 'idle' | 'paused'
        const agent = Array.isArray(data) ? data[0] : data
        if (agent && agent.status === 'idle' && elapsed > 3) {
          // Agent has returned to idle AFTER we started (elapsed > 3s prevents false positives)
          if (!cancelled) setAgentDone(true)
        }
      } catch {
        // Ignore polling errors
      }
    }

    // Poll every 3 seconds
    const interval = setInterval(poll, 3000)
    // Also poll immediately after 5 seconds
    const initialPoll = setTimeout(poll, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearTimeout(initialPoll)
    }
  }, [agentType, isComplete, elapsed])

  // Dynamic progress bar — fills based on elapsed time, caps at 95% until complete
  const maxExpectedSeconds = 90
  const progressPct = effectiveComplete
    ? 100
    : Math.min(95, Math.round((elapsed / maxExpectedSeconds) * 100))

  return (
    <div className="mt-2 space-y-2">
      {/* Agent personality header */}
      {personality && (
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', personality.colour)}>
            {personality.name}
          </span>
          {!effectiveComplete && (
            <span className="text-[10px] text-muted-foreground/60">{elapsed}s</span>
          )}
          {effectiveComplete && (
            <span className="text-[10px] text-emerald-500 font-medium">Done</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-out',
            effectiveComplete ? 'bg-emerald-500' : 'bg-blue-400'
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Status text */}
      <div className="flex items-center gap-2 text-xs">
        {effectiveComplete ? (
          <>
            <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            <span className="text-emerald-500 font-medium">Complete</span>
          </>
        ) : elapsed < 5 ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
            <span className="text-foreground">Loading context & preparing...</span>
          </>
        ) : elapsed < 20 ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
            <span className="text-foreground">Working on it...</span>
          </>
        ) : elapsed < 60 ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
            <span className="text-foreground">Deep work in progress — writing detailed output...</span>
          </>
        ) : (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-amber-400 shrink-0" />
            <span className="text-amber-400">Complex task — nearly there...</span>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Meeting Progress ───────────────────────────────────────────────────────

function MeetingProgress({ departments, isComplete }: { departments: string[]; isComplete: boolean }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (isComplete) return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [isComplete])

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span className="font-medium">
          {isComplete ? `${departments.length} agents delivered` : `${departments.length} agents working in parallel`}
        </span>
        {!isComplete && (
          <span className="text-[10px] text-muted-foreground/60">{elapsed}s</span>
        )}
      </div>
      <div className="space-y-1 ml-1">
        {departments.map((dept, i) => {
          const personality = AGENT_PERSONALITIES[dept]
          const isLast = i === departments.length - 1
          const prefix = isLast ? '└─' : '├─'
          return (
            <div key={dept} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted-foreground/40 shrink-0">{prefix}</span>
              {isComplete ? (
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
              )}
              {personality ? (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', personality.colour)}>
                  {personality.name}
                </span>
              ) : (
                <span className="text-foreground">{AGENT_LABELS[dept as AgentType] ?? dept}</span>
              )}
              <span className="text-muted-foreground/50 text-[10px]">
                {isComplete ? 'done' : 'working...'}
              </span>
            </div>
          )
        })}
      </div>
      {isComplete && (
        <div className="flex items-center gap-2 text-xs mt-1">
          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="text-emerald-500 font-medium">All agents delivered</span>
        </div>
      )}
    </div>
  )
}

// ─── Meeting Result Renderer ────────────────────────────────────────────────

interface MeetingResult {
  type: 'meeting'
  brief: string
  departments: { department: string; name: string; result: string; costCents: number }[]
  errors?: { department: string; error: string }[]
  totalCostCents: number
}

function MeetingResultDisplay({ data }: { data: MeetingResult }) {
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept)
      else next.add(dept)
      return next
    })
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="text-xs text-muted-foreground">
        {data.departments.length} departments contributed
      </div>
      {data.departments.map(({ department, name, result }) => {
        const personality = AGENT_PERSONALITIES[department]
        return (
        <div key={department} className="rounded-md border border-border overflow-hidden">
          <button
            onClick={() => toggleDept(department)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted/50 transition-colors"
          >
            {expandedDepts.has(department) ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            {personality ? (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', personality.colour)}>
                {personality.name}
              </span>
            ) : (
              <span>{name}</span>
            )}
            <span className="text-muted-foreground/50 ml-auto text-[10px]">
              {result.length.toLocaleString()} chars
            </span>
          </button>
          {expandedDepts.has(department) && (
            <div className="border-t px-3 py-2 text-xs whitespace-pre-wrap text-muted-foreground max-h-96 overflow-y-auto">
              {result}
            </div>
          )}
        </div>
        )
      })}
      {data.errors && data.errors.length > 0 && (
        <div className="text-xs text-red-400">
          {data.errors.map(e => `${e.department}: ${e.error}`).join('; ')}
        </div>
      )}
    </div>
  )
}

// ─── Tool Label Logic ───────────────────────────────────────────────────────

function getToolLabel(toolName: string, args: Record<string, unknown>, state: string): string {
  // For delegation, show agent personality name
  if (toolName === 'delegate_to_agent' && args?.agentType) {
    const personality = AGENT_PERSONALITIES[args.agentType as string]
    const name = personality?.name ?? AGENT_LABELS[args.agentType as AgentType] ?? args.agentType
    return state === 'result'
      ? `${name} delivered`
      : `${name} is working...`
  }

  // For meeting, show agent count with personality
  if (toolName === 'convene_meeting' && args?.departments) {
    const depts = args.departments as string[]
    const count = depts.length
    return state === 'result'
      ? `${count} agents delivered`
      : `${count} agents working in parallel...`
  }

  // For handoff, show target department
  if (toolName === 'handoff_to_department' && args?.targetDepartment) {
    const deptName = AGENT_LABELS[args.targetDepartment as AgentType] ?? args.targetDepartment
    return `Handing off to ${deptName}`
  }

  // For scan tools, show the URL
  if ((toolName === 'scan_website' || toolName === 'browse_page') && args?.url) {
    return state === 'result'
      ? `Scanned ${args.url}`
      : `Scanning ${args.url}...`
  }

  // For web search, show the query
  if (toolName === 'web_search' && args?.query) {
    const q = String(args.query).slice(0, 60)
    return state === 'result'
      ? `Search complete: "${q}"`
      : `Searching: "${q}"...`
  }

  return TOOL_LABELS[toolName] ?? toolName
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ToolCallDisplay({ toolName, args, result, state }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false)
  const label = getToolLabel(toolName, args, state)
  const isDelegation = toolName === 'delegate_to_agent'
  const isMeeting = toolName === 'convene_meeting'
  const isComplete = state === 'result' || result !== undefined

  return (
    <div className="rounded-lg border bg-background/50 text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground hover:text-foreground"
      >
        {isComplete ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        )}
        <Wrench className="h-3.5 w-3.5" />
        <span className="flex-1 text-xs">{label}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Delegation progress — polls real agent status */}
      {isDelegation && (
        <div className="px-3 pb-2">
          <DelegationProgress
            agentType={String(args?.agentType ?? '')}
            isComplete={isComplete}
          />
        </div>
      )}

      {/* Meeting progress — shows all departments working simultaneously */}
      {isMeeting ? (
        !isComplete ? (
          <div className="px-3 pb-2">
            <MeetingProgress
              departments={(args?.departments as string[]) ?? []}
              isComplete={isComplete}
            />
          </div>
        ) : result && (result as MeetingResult).type === 'meeting' ? (
          <div className="px-3 pb-2">
            <MeetingResultDisplay data={result as MeetingResult} />
          </div>
        ) : null
      ) : null}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div>
            <span className="text-[10px] text-muted-foreground/60">Input</span>
            <pre className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {result !== undefined && result !== null && (
            <div>
              <span className="text-[10px] text-muted-foreground/60">Output</span>
              <pre className="mt-0.5 text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {typeof result === 'string'
                  ? (result as string).slice(0, 2000)
                  : JSON.stringify(result, null, 2).slice(0, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
