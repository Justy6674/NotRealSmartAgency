'use client'

import { cn } from '@/lib/utils'
import { User, Bot } from 'lucide-react'
import { ToolCallDisplay } from './ToolCallDisplay'
import type { UIMessage } from 'ai'

interface ChatMessageProps {
  message: UIMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3 py-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] space-y-2',
          isUser
            ? 'rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground'
            : 'rounded-2xl rounded-bl-md bg-muted px-4 py-2.5'
        )}
      >
        {message.parts?.map((part, i) => {
          if (part.type === 'text') {
            return (
              <div key={i} className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {part.text}
              </div>
            )
          }
          // Tool invocation parts in v6 have type starting with 'tool-'
          if (part.type.startsWith('tool-')) {
            const toolPart = part as { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown }
            // Extract tool name from the type (format: "tool-{toolName}")
            const toolName = part.type.replace(/^tool-/, '')
            return (
              <ToolCallDisplay
                key={i}
                toolName={toolName}
                args={(toolPart.input as Record<string, unknown>) ?? {}}
                result={toolPart.state === 'result' ? toolPart.output : undefined}
                state={toolPart.state}
              />
            )
          }
          return null
        })}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
