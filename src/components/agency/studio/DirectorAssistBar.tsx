'use client'

import { Sparkles } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'

export interface DirectorAssistButton {
  /** Plain language label: "Fill my week" */
  label: string
  /** Full prompt sent to Director — must include brand context + tool hints */
  prompt: string
}

interface DirectorAssistBarProps {
  /** Brand name injected into display. Bar hidden when empty/null. */
  brandName: string | null | undefined
  /** 2-3 macro action buttons for this page */
  buttons: DirectorAssistButton[]
}

/**
 * DirectorAssistBar — reusable amber bar placed at the top of each Studio page.
 *
 * Provides macro-level Director Assist buttons (page-level actions like
 * "Fill my week", "What's working?", "Review all drafts"). Each button
 * sends a contextual prompt to the Director via sendToDirector() which
 * auto-opens the chat panel and triggers a full Director response using
 * all available knowledge (proforma, memories, brand DNA, past outputs,
 * social analytics, compliance rules).
 *
 * Individual per-item buttons (e.g. "Fix this post", "Describe this media")
 * call sendToDirector() directly from their parent components — they don't
 * use this bar.
 *
 * Visual style matches the existing StudioCard directorAssist pill pattern
 * from src/components/agency/studio/post/StudioCard.tsx.
 */
export function DirectorAssistBar({ brandName, buttons }: DirectorAssistBarProps) {
  if (!brandName) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-amber-400 shrink-0">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium">Director</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            onClick={() => sendToDirector(button.prompt)}
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colours shrink-0"
          >
            <Sparkles className="h-3 w-3" />
            {button.label}
          </button>
        ))}
      </div>
    </div>
  )
}
