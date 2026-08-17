'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'

interface StudioCardProps {
  title?: string
  subtitle?: string
  /** Director Assist prompt + label — renders amber pill top-right */
  directorAssist?: { prompt: string; label: string }
  /** Show required indicator dot */
  required?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Scent Sell-style card wrapper — consistent white card with optional
 * title header and Director Assist pill. Used throughout the Post Creator.
 */
export function StudioCard({ title, subtitle, directorAssist, required, children, className }: StudioCardProps) {
  return (
    <div className={cn('rounded-xl border p-5', className)} style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}>
      {/* Header row: title left, DirectorAssist right */}
      {(title || directorAssist) && (
        <div className="flex items-start justify-between mb-3">
          <div>
            {title && (
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
                {required !== undefined && (
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    required ? 'bg-red-400' : 'bg-emerald-400'
                  )} />
                )}
              </div>
            )}
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>
            )}
          </div>
          {directorAssist && (
            <button
              type="button"
              onClick={() => sendToDirector(directorAssist.prompt)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colours shrink-0"
              style={{
                background: 'var(--brand-wash)',
                color: 'var(--brand-deep)',
              }}
            >
              <Sparkles className="h-3 w-3" />
              {directorAssist.label}
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
