'use client'

import { useState } from 'react'
import { Check, AlertTriangle, X, Shield, Loader2 } from 'lucide-react'
import type { ComplianceResult } from '@/types/database'

interface ComplianceBadgeProps {
  result: ComplianceResult | null | undefined
  loading?: boolean
  onRecheck?: () => void
  expanded?: boolean
}

export function ComplianceBadge({ result, loading, onRecheck, expanded: defaultExpanded }: ComplianceBadgeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking...
      </span>
    )
  }

  if (!result) {
    return (
      <button
        onClick={onRecheck}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
      >
        <Shield className="h-3 w-3" />
        Not checked
      </button>
    )
  }

  const hasWarnings = result.warnings.length > 0 || result.brand_voice_issues.length > 0
  const hasFails = result.flags.length > 0
  const totalIssues = result.flags.length + result.warnings.length + result.brand_voice_issues.length

  // Determine status
  let status: 'pass' | 'warn' | 'fail'
  if (!result.is_valid || hasFails) status = 'fail'
  else if (hasWarnings) status = 'warn'
  else status = 'pass'

  const styles = {
    pass: {
      bg: 'bg-[oklch(0.72_0.15_145/0.1)]',
      text: 'text-[oklch(0.72_0.15_145)]',
      icon: <Check className="h-3 w-3" />,
      label: 'Compliant',
    },
    warn: {
      bg: 'bg-[oklch(0.78_0.15_80/0.1)]',
      text: 'text-[oklch(0.78_0.15_80)]',
      icon: <AlertTriangle className="h-3 w-3" />,
      label: `${totalIssues} warning${totalIssues !== 1 ? 's' : ''}`,
    },
    fail: {
      bg: 'bg-[oklch(0.65_0.2_25/0.1)]',
      text: 'text-[oklch(0.65_0.2_25)]',
      icon: <X className="h-3 w-3" />,
      label: `${result.flags.length} violation${result.flags.length !== 1 ? 's' : ''}`,
    },
  }

  const s = styles[status]

  return (
    <div className="inline-flex flex-col">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.text} transition-colors hover:opacity-80`}
      >
        {s.icon}
        {s.label}
      </button>

      {expanded && totalIssues > 0 && (
        <div className="mt-1 rounded-lg border border-border bg-card p-2 text-[11px] space-y-1.5 max-w-xs">
          {result.flags.length > 0 && (
            <div>
              <span className="font-medium text-[oklch(0.65_0.2_25)]">Violations:</span>
              <ul className="mt-0.5 space-y-0.5">
                {result.flags.map((f, i) => (
                  <li key={i} className="text-muted-foreground pl-2 border-l-2 border-[oklch(0.65_0.2_25/0.3)]">{f}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div>
              <span className="font-medium text-[oklch(0.78_0.15_80)]">Warnings:</span>
              <ul className="mt-0.5 space-y-0.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-muted-foreground pl-2 border-l-2 border-[oklch(0.78_0.15_80/0.3)]">{w}</li>
                ))}
              </ul>
            </div>
          )}
          {result.brand_voice_issues.length > 0 && (
            <div>
              <span className="font-medium text-[oklch(0.78_0.15_80)]">Brand voice:</span>
              <ul className="mt-0.5 space-y-0.5">
                {result.brand_voice_issues.map((b, i) => (
                  <li key={i} className="text-muted-foreground pl-2 border-l-2 border-[oklch(0.78_0.15_80/0.3)]">{b}</li>
                ))}
              </ul>
            </div>
          )}
          {onRecheck && (
            <button
              onClick={(e) => { e.stopPropagation(); onRecheck() }}
              className="mt-1 text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              Re-check compliance
            </button>
          )}
        </div>
      )}
    </div>
  )
}
