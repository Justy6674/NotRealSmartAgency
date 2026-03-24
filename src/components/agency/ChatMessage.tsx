'use client'

import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import Markdown from 'react-markdown'
import { ToolCallDisplay } from './ToolCallDisplay'
import { MessageActions } from './MessageActions'
import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS } from '@/types/database'
import { useAgencyStore } from '@/stores/agency-store'
import type { UIMessage } from 'ai'

interface ChatMessageProps {
  message: UIMessage
  onRegenerate?: () => void
}

export function ChatMessage({ message, onRegenerate }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const { activeAgentType } = useAgencyStore()

  // Extract full text content for action buttons
  const textContent = message.parts
    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n') ?? ''

  const showActions = !isUser && textContent.length > 100

  return (
    <div className={cn('flex gap-3 py-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex flex-col items-center gap-1">
          <AgentAvatar agentType={activeAgentType} size="md" />
        </div>
      )}

      <div className={cn('max-w-[80%] space-y-2', isUser ? '' : '')}>
        {/* Agent name label for assistant messages */}
        {!isUser && (
          <p className="text-xs font-medium text-muted-foreground">
            {AGENT_LABELS[activeAgentType]}
          </p>
        )}

        <div
          className={cn(
            isUser
              ? 'rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground'
              : 'rounded-2xl rounded-bl-md bg-muted px-4 py-2.5'
          )}
        >
          {message.parts?.map((part, i) => {
            if (part.type === 'text') {
              return (
                <div key={i} className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{part.text}</Markdown>
                </div>
              )
            }
            // Tool invocation parts in v6 have type starting with 'tool-'
            if (part.type.startsWith('tool-')) {
              const toolPart = part as { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown }
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

        {/* Action bar for substantial assistant messages */}
        {showActions && (
          <MessageActions content={textContent} onRegenerate={onRegenerate} />
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
