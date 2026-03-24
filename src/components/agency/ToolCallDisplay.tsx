'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Wrench, ChevronDown, Loader2, Check } from 'lucide-react'
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
  web_search: 'Searching the web',
}

// ─── Delegation Progress Steps ──────────────────────────────────────────────

const DELEGATION_STEPS: Record<string, { label: string; delay: number }[]> = {
  content: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing compliance rules', delay: 2000 },
    { label: 'Researching topic', delay: 5000 },
    { label: 'Writing content', delay: 10000 },
    { label: 'Checking word count & formatting', delay: 22000 },
    { label: 'Finalising output', delay: 35000 },
  ],
  seo: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Analysing current SEO', delay: 2000 },
    { label: 'Researching keywords', delay: 6000 },
    { label: 'Building recommendations', delay: 15000 },
    { label: 'Finalising audit', delay: 28000 },
  ],
  paid_ads: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing compliance rules', delay: 2000 },
    { label: 'Analysing target audience', delay: 5000 },
    { label: 'Writing ad copy variants', delay: 12000 },
    { label: 'Building campaign structure', delay: 22000 },
    { label: 'Finalising output', delay: 32000 },
  ],
  strategy: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Analysing market position', delay: 3000 },
    { label: 'Evaluating competitors', delay: 8000 },
    { label: 'Building strategy', delay: 16000 },
    { label: 'Finalising recommendations', delay: 28000 },
  ],
  email: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing compliance rules', delay: 2000 },
    { label: 'Planning email sequence', delay: 5000 },
    { label: 'Writing email copy', delay: 10000 },
    { label: 'Optimising subject lines', delay: 22000 },
    { label: 'Finalising sequence', delay: 30000 },
  ],
  competitor: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Identifying competitors', delay: 3000 },
    { label: 'Analysing positioning', delay: 8000 },
    { label: 'Comparing pricing', delay: 15000 },
    { label: 'Building SWOT analysis', delay: 22000 },
    { label: 'Finalising report', delay: 30000 },
  ],
  compliance: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Checking AHPRA requirements', delay: 2000 },
    { label: 'Checking TGA requirements', delay: 6000 },
    { label: 'Scanning for violations', delay: 12000 },
    { label: 'Assessing risk levels', delay: 20000 },
    { label: 'Finalising compliance report', delay: 28000 },
  ],
  _default: [
    { label: 'Loading brand context', delay: 0 },
    { label: 'Reviewing requirements', delay: 2000 },
    { label: 'Researching', delay: 6000 },
    { label: 'Building output', delay: 14000 },
    { label: 'Finalising', delay: 26000 },
  ],
}

function DelegationProgress({ agentType, isComplete }: { agentType: string; isComplete: boolean }) {
  const [currentStep, setCurrentStep] = useState(0)
  const steps = DELEGATION_STEPS[agentType] ?? DELEGATION_STEPS._default

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
      {isComplete && (
        <div className="flex items-center gap-2 text-xs">
          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="text-emerald-500 font-medium">Complete</span>
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
