'use client'

import { useState } from 'react'
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

function getToolLabel(toolName: string, args: Record<string, unknown>, state: string): string {
  // For delegation, show which department is working
  if (toolName === 'delegate_to_agent' && args?.agentType) {
    const deptName = AGENT_LABELS[args.agentType as AgentType] ?? args.agentType
    return state === 'result'
      ? `${deptName} completed`
      : `${deptName} is working on this...`
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

export function ToolCallDisplay({ toolName, args, result, state }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false)
  const label = getToolLabel(toolName, args, state)

  return (
    <div className="rounded-lg border bg-background/50 text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground hover:text-foreground"
      >
        {state === 'result' ? (
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
              <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
