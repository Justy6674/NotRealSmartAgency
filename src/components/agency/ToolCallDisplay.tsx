'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Wrench, ChevronDown, Loader2, Check } from 'lucide-react'

interface ToolCallDisplayProps {
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  state: string
}

const TOOL_LABELS: Record<string, string> = {
  save_output: 'Saving to output library',
  word_count: 'Checking word/character count',
  scan_website: 'Scanning website...',
  scan_github: 'Scanning GitHub repository...',
  scan_social: 'Checking social media presence...',
  marketing_audit: 'Running marketing audit...',
}

export function ToolCallDisplay({ toolName, args, result, state }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false)
  const label = TOOL_LABELS[toolName] ?? toolName

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
