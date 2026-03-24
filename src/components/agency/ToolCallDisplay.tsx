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
  delegate_to_agent: 'Delegating to department',
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
  handoff_to_department: 'Handing off to department',
  convene_meeting: 'Convening department meeting',
  web_search: 'Searching the web',
}

// ─── Delegation Progress Steps ──────────────────────────────────────────────

const DELEGATION_STEPS: Record<string, { label: string; delay: number }[]> = {
  content: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing compliance rules', delay: 2000 },
    { label: 'Researching topic', delay: 6000 },
    { label: 'Writing content', delay: 14000 },
    { label: 'Reviewing draft', delay: 28000 },
    { label: 'Checking word count & formatting', delay: 42000 },
    { label: 'Applying brand voice', delay: 56000 },
    { label: 'Finalising output', delay: 70000 },
  ],
  seo: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Analysing current SEO', delay: 3000 },
    { label: 'Researching keywords', delay: 10000 },
    { label: 'Evaluating competitor rankings', delay: 22000 },
    { label: 'Building recommendations', delay: 40000 },
    { label: 'Compiling technical audit', delay: 55000 },
    { label: 'Finalising report', delay: 70000 },
  ],
  paid_ads: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing compliance rules', delay: 2000 },
    { label: 'Analysing target audience', delay: 8000 },
    { label: 'Writing ad copy variants', delay: 18000 },
    { label: 'Building campaign structure', delay: 35000 },
    { label: 'Optimising bidding strategy', delay: 50000 },
    { label: 'Finalising output', delay: 65000 },
  ],
  strategy: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Analysing market position', delay: 4000 },
    { label: 'Evaluating competitors', delay: 12000 },
    { label: 'Building strategy framework', delay: 25000 },
    { label: 'Developing action items', delay: 42000 },
    { label: 'Aligning with brand goals', delay: 56000 },
    { label: 'Finalising recommendations', delay: 70000 },
  ],
  email: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing compliance rules', delay: 2000 },
    { label: 'Planning email sequence', delay: 8000 },
    { label: 'Writing email copy', delay: 18000 },
    { label: 'Crafting subject lines', delay: 35000 },
    { label: 'Optimising send strategy', delay: 50000 },
    { label: 'Finalising sequence', delay: 65000 },
  ],
  competitor: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Identifying competitors', delay: 4000 },
    { label: 'Analysing positioning', delay: 12000 },
    { label: 'Comparing pricing', delay: 25000 },
    { label: 'Building SWOT analysis', delay: 40000 },
    { label: 'Evaluating market gaps', delay: 55000 },
    { label: 'Finalising report', delay: 70000 },
  ],
  compliance: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Checking AHPRA requirements', delay: 3000 },
    { label: 'Checking TGA requirements', delay: 10000 },
    { label: 'Scanning for violations', delay: 20000 },
    { label: 'Assessing risk levels', delay: 35000 },
    { label: 'Cross-referencing guidelines', delay: 52000 },
    { label: 'Finalising compliance report', delay: 68000 },
  ],
  _default: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing requirements', delay: 3000 },
    { label: 'Researching', delay: 10000 },
    { label: 'Building output', delay: 24000 },
    { label: 'Refining details', delay: 42000 },
    { label: 'Quality checking', delay: 56000 },
    { label: 'Finalising', delay: 70000 },
  ],
}

function DelegationProgress({ agentType, isComplete }: { agentType: string; isComplete: boolean }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const steps = DELEGATION_STEPS[agentType] ?? DELEGATION_STEPS._default

  // Elapsed timer
  useEffect(() => {
    if (isComplete) return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [isComplete])

  useEffect(() => {
    if (isComplete) {
      setCurrentStep(steps.length)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < steps.length; i++) {
      timers.push(setTimeout(() => setCurrentStep(i), steps[i].delay))
    }

    return () => timers.forEach(clearTimeout)
  }, [isComplete, steps])

  const lastStepDelay = steps[steps.length - 1]?.delay ?? 0
  const allStepsDone = !isComplete && currentStep >= steps.length - 1
    && elapsed * 1000 > lastStepDelay + 3000

  return (
    <div className="mt-2 space-y-1.5">
      {steps.map((step, i) => {
        const isDone = isComplete || i < currentStep
        const isActive = !isComplete && i === currentStep

        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            {isDone ? (
              <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : isActive ? (
              <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
            ) : (
              <div className="h-3 w-3 rounded-full border border-border shrink-0" />
            )}
            <span className={cn(
              isDone ? 'text-muted-foreground' : isActive ? 'text-foreground' : 'text-muted-foreground/50'
            )}>
              {step.label}
            </span>
          </div>
        )
      })}
      {allStepsDone && (
        <div className="flex items-center gap-2 text-xs">
          <Loader2 className="h-3 w-3 animate-spin text-amber-400 shrink-0" />
          <span className="text-amber-400">Still working... this can take a moment for complex tasks</span>
        </div>
      )}
      {isComplete && (
        <div className="flex items-center gap-2 text-xs">
          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="text-emerald-500 font-medium">Complete</span>
        </div>
      )}
      {!isComplete && elapsed > 0 && (
        <div className="mt-1 text-[10px] text-muted-foreground/60">
          {elapsed}s elapsed
        </div>
      )}
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
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Users className="h-3 w-3" />
        <span>{departments.length} departments in meeting</span>
      </div>
      {departments.map((dept) => {
        const name = AGENT_LABELS[dept as AgentType] ?? dept
        return (
          <div key={dept} className="flex items-center gap-2 text-xs">
            {isComplete ? (
              <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            ) : (
              <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
            )}
            <span className={isComplete ? 'text-muted-foreground' : 'text-foreground'}>
              {name} {isComplete ? '— done' : '— working...'}
            </span>
          </div>
        )
      })}
      {isComplete && (
        <div className="flex items-center gap-2 text-xs mt-1">
          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="text-emerald-500 font-medium">Meeting complete</span>
        </div>
      )}
      {!isComplete && elapsed > 0 && (
        <div className="mt-1 text-[10px] text-muted-foreground/60">
          {elapsed}s elapsed — departments working in parallel
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
      {data.departments.map(({ department, name, result }) => (
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
            <Check className="h-3 w-3 text-emerald-500 shrink-0" />
            <span>{name}</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-normal">
              {result.length.toLocaleString()} chars
            </span>
          </button>
          {expandedDepts.has(department) && (
            <div className="border-t px-3 py-2 text-xs whitespace-pre-wrap text-muted-foreground max-h-96 overflow-y-auto">
              {result}
            </div>
          )}
        </div>
      ))}
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
  // For delegation, show which department is working
  if (toolName === 'delegate_to_agent' && args?.agentType) {
    const deptName = AGENT_LABELS[args.agentType as AgentType] ?? args.agentType
    return state === 'result'
      ? `${deptName} completed`
      : `${deptName} is working...`
  }

  // For meeting, show department count
  if (toolName === 'convene_meeting' && args?.departments) {
    const depts = args.departments as string[]
    const count = depts.length
    return state === 'result'
      ? `Meeting complete — ${count} departments`
      : `Meeting in progress — ${count} departments...`
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
  const isComplete = state === 'result'

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

      {/* Delegation progress steps — always visible during delegation */}
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

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Input</p>
            <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Result</p>
              <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground max-h-60 overflow-y-auto">
                {typeof result === 'object' && result !== null && 'result' in (result as Record<string, unknown>)
                  ? String((result as Record<string, unknown>).result).slice(0, 2000)
                  : JSON.stringify(result, null, 2).slice(0, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
