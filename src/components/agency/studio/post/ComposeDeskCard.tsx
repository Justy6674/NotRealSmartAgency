'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const SHADOW =
  '0 1px 2px oklch(0.2 0.02 240 / 0.05), 0 8px 24px -16px oklch(0.2 0.02 240 / 0.28)'

interface ComposeDeskCardProps {
  /** Card header row — 12.5px semibold, hairline under */
  header?: ReactNode
  /** Right side of header (counts, links) */
  headerRight?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** No inner padding — editor cards fill edge-to-edge */
  flush?: boolean
}

/**
 * One `.card` from dept-social.html — not a nested shadcn Card stack.
 */
export function ComposeDeskCard({
  header,
  headerRight,
  children,
  className,
  bodyClassName,
  flush,
}: ComposeDeskCardProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-[12px] border', className)}
      style={{
        borderColor: 'var(--line, oklch(0.915 0.007 240))',
        background: 'var(--panel, oklch(1 0 0))',
        boxShadow: SHADOW,
      }}
    >
      {header ? (
        <div
          className="flex items-center gap-[9px] px-[15px] py-[11px]"
          style={{ borderBottom: '1px solid var(--line-soft, oklch(0.950 0.005 240))' }}
        >
          <div className="min-w-0 flex-1 text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
            {header}
          </div>
          {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? undefined : 'p-[15px]', bodyClassName)}>{children}</div>
    </div>
  )
}
