'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SendHorizontal } from 'lucide-react'

interface ChatInputProps {
  onSend: (text: string) => void
  isLoading: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  isLoading,
  placeholder = 'What would you like to create?',
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

  return (
    <div className="border-t bg-background p-4">
      <div className="relative flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none rounded-xl border bg-muted/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
        <Button
          type="button"
          size="icon"
          disabled={!input.trim() || isLoading}
          onClick={handleSend}
          className="h-10 w-10 shrink-0 rounded-xl"
        >
          <SendHorizontal className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Shift + Enter for new line. AI outputs should be reviewed before publishing.
      </p>
    </div>
  )
}
