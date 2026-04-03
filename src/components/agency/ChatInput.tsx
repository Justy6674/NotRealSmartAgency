'use client'

import { useState, useRef, useEffect } from 'react'
import { SendHorizontal, Plus, Paperclip, Mic } from 'lucide-react'
import type { AgentType, Brand } from '@/types/database'

interface ChatInputProps {
  onSend: (text: string) => void
  isLoading: boolean
  placeholder?: string
  brand?: Brand | null
  agentType?: AgentType
  showChips?: boolean
}

// Contextual quick chips — short labels, not full prompts
const AGENT_CHIPS: Record<string, { label: string; message: string }[]> = {
  overall: [
    { label: 'Write a post', message: 'Write me a social media post for my brand.' },
    { label: 'Fill my calendar', message: 'Fill my content calendar for the next 2 weeks.' },
    { label: 'Review my brand', message: 'Review my brand and tell me what I should focus on.' },
    { label: 'Upload a video', message: 'I want to upload a video and turn it into content.' },
  ],
  content: [
    { label: 'Social posts', message: 'Write social posts for my brand.' },
    { label: 'Blog article', message: 'Write a blog article for my brand.' },
    { label: 'Email copy', message: 'Write email marketing copy for my brand.' },
  ],
  seo: [
    { label: 'Keyword research', message: 'Research keywords for my brand.' },
    { label: 'SEO audit', message: 'Audit my website for SEO issues.' },
  ],
  video: [
    { label: 'Write a script', message: 'Write a video script for my brand.' },
    { label: 'Process a video', message: 'I have a video to process into content.' },
  ],
}

const DEFAULT_CHIPS = [
  { label: 'Write a post', message: 'Write me a social media post.' },
  { label: 'Create content', message: 'Help me create marketing content.' },
  { label: 'Get advice', message: 'What should I focus on for marketing?' },
]

export function ChatInput({
  onSend,
  isLoading,
  placeholder = 'How can I help you today?',
  brand,
  agentType,
  showChips = false,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const chips = agentType ? (AGENT_CHIPS[agentType] ?? DEFAULT_CHIPS) : DEFAULT_CHIPS

  return (
    <div className="border-t bg-background px-4 py-3">
      {/* Main input — large, inviting, Claude-style */}
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-2xl border bg-muted/30 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading}
            className="w-full resize-none rounded-2xl bg-transparent px-4 pb-12 pt-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
          />
          {/* Bottom bar inside the input box */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                title="Attach file"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              disabled={!input.trim() || isLoading}
              onClick={handleSend}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick action chips — shown when no messages */}
        {showChips && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => onSend(chip.message)}
                disabled={isLoading}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
          Shift + Enter for new line. AI outputs should be reviewed before publishing.
        </p>
      </div>
    </div>
  )
}
