'use client'

import { Sparkles } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { sendToDirector } from '@/lib/chat-dispatch'
import { sectionForPath } from '@/components/agency/shell/nav-sections'

/**
 * Honest empty state for a section that is designed, visible, and not
 * connected yet. A plausible table of zeros would look finished and be a lie.
 */
export function DepartmentNotReady({
  title,
  body,
  ask,
}: {
  title: string
  body: string
  ask?: string
}) {
  const prompt = ask ?? `Help me set up ${title.replace(/ — not set up$/, '')} for this business.`

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto mt-8 max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <button
          type="button"
          onClick={() => sendToDirector(prompt)}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask the Director instead
        </button>
      </div>
    </div>
  )
}

export function DepartmentNotReadyForPath() {
  const pathname = usePathname() ?? ''
  const section = sectionForPath(pathname)
  const label = section?.label ?? 'This section'

  return (
    <DepartmentNotReady
      title={`${label} — not set up`}
      body="This screen is here on purpose so you can see where it will live. It is not connected yet, so nothing on it is a number about your business."
    />
  )
}
