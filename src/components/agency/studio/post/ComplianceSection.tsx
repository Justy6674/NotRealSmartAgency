'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComplianceResult {
  isValid: boolean
  flags: string[]
  warnings: string[]
  brandVoiceIssues: string[]
}

interface ComplianceSectionProps {
  caption: string
  brandName: string
  isHealthBrand: boolean
  onResult?: (result: ComplianceResult | null) => void
}

export function ComplianceSection({ caption, brandName, isHealthBrand, onResult }: ComplianceSectionProps) {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ComplianceResult | null>(null)
  const [healthClaims, setHealthClaims] = useState(isHealthBrand)

  // Auto-check when caption changes (debounced)
  const runCheck = useCallback(async () => {
    if (!caption || caption.length < 10) {
      setResult(null)
      onResult?.(null)
      return
    }
    if (!healthClaims) {
      // Quick local check for obvious issues
      const flags: string[] = []
      const warnings: string[] = []
      if (caption.includes('guaranteed')) warnings.push('Contains "guaranteed" — may be problematic')
      if (caption.includes('100%')) warnings.push('Contains "100%" — avoid absolute claims')
      const localResult = { isValid: true, flags, warnings, brandVoiceIssues: [] }
      setResult(localResult)
      onResult?.(localResult)
      return
    }

    setChecking(true)
    try {
      // Call compliance filter via API
      const res = await fetch('/api/compliance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: caption, ahpra: true, tga: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setResult(data)
        onResult?.(data)
      }
    } catch {
      // Fail open — don't block on network errors
      const fallback = { isValid: true, flags: [], warnings: ['Compliance check unavailable'], brandVoiceIssues: [] }
      setResult(fallback)
      onResult?.(fallback)
    } finally {
      setChecking(false)
    }
  }, [caption, healthClaims, onResult])

  useEffect(() => {
    const timer = setTimeout(runCheck, 1500) // 1.5s debounce
    return () => clearTimeout(timer)
  }, [runCheck])

  const hasFlags = (result?.flags?.length ?? 0) > 0
  const hasWarnings = (result?.warnings?.length ?? 0) > 0
  const hasVoiceIssues = (result?.brandVoiceIssues?.length ?? 0) > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Compliance</h3>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {checking && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {!checking && result && (
            result.isValid && !hasFlags ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-400">
                <XCircle className="h-3.5 w-3.5" /> Issues found
              </span>
            )
          )}
        </div>
      </div>

      {/* Health claims toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={healthClaims}
          onChange={e => setHealthClaims(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-xs text-muted-foreground">
          This post contains health claims (AHPRA/TGA check)
        </span>
      </label>

      {/* Results */}
      {result && (hasFlags || hasWarnings || hasVoiceIssues) && (
        <div className="space-y-2">
          {result.flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{flag}</p>
            </div>
          ))}
          {result.warnings.map((warn, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">{warn}</p>
            </div>
          ))}
          {result.brandVoiceIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
              <p className="text-xs text-purple-300">{issue}</p>
            </div>
          ))}
        </div>
      )}

      {!caption && (
        <p className="text-[10px] text-muted-foreground/60">Write a caption to run compliance checks.</p>
      )}
    </div>
  )
}
