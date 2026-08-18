'use client'

import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import Markdown from 'react-markdown'
import { ToolCallDisplay } from './ToolCallDisplay'
import { MessageActions } from './MessageActions'
import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS } from '@/types/database'
import { useAgencyStore } from '@/stores/agency-store'
import { hasInlineCards, parseInlineCards } from './inline/parseInlineCards'
import { PostPreviewCard } from './inline/PostPreviewCard'
import { AnalyticsSummaryCard } from './inline/AnalyticsSummaryCard'
import { CalendarWeekCard } from './inline/CalendarWeekCard'
import { BrandSavedCard } from './inline/BrandSavedCard'
import type { UIMessage } from 'ai'

interface ChatMessageProps {
  message: UIMessage
  onRegenerate?: () => void
  /** Brand-paper styling for the Director rail */
  variant?: 'default' | 'rail'
}

function RichTextContent({ text, variant }: { text: string; variant: 'default' | 'rail' }) {
  const proseClass =
    variant === 'rail'
      ? 'prose prose-sm max-w-none [&_*]:text-[var(--ink)]'
      : 'prose prose-sm dark:prose-invert max-w-none'

  if (!hasInlineCards(text)) {
    return (
      <div className={proseClass}>
        <Markdown>{text}</Markdown>
      </div>
    )
  }

  const segments = parseInlineCards(text)

  return (
    <div className="space-y-2">
      {segments.map((segment, i) => {
        switch (segment.type) {
          case 'markdown':
            return (
              <div key={i} className={proseClass}>
                <Markdown>{segment.content}</Markdown>
              </div>
            )
          case 'post_preview':
            return <PostPreviewCard key={i} {...segment.data} />
          case 'analytics_summary':
            return <AnalyticsSummaryCard key={i} {...segment.data} />
          case 'calendar_week':
            return <CalendarWeekCard key={i} {...segment.data} />
          case 'brand_saved':
            return <BrandSavedCard key={i} {...segment.data} />
          default:
            return null
        }
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChatMessage({ message, onRegenerate, variant = 'default' }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const { activeAgentType } = useAgencyStore()
  const isRail = variant === 'rail'

  // Extract full text content for action buttons
  const textContent = message.parts
    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n') ?? ''

  const showActions = !isUser && textContent.length > 100

  // Drop a text part that repeats the one before it.
  //
  // A message can carry several text parts, and when a step boundary lands
  // mid-answer the model sometimes restates the sentence it just finished. Both
  // parts render, so the user reads the same question twice in one bubble and
  // reasonably concludes the agent is broken.
  //
  // Only exact repeats of the immediately preceding text are dropped — a message
  // that legitimately says the same short thing twice with anything in between
  // still renders in full.
  const parts = message.parts?.filter((part, i, all) => {
    if (part.type !== 'text') return true
    const previous = all[i - 1]
    if (!previous || previous.type !== 'text') return true
    return (previous as { text: string }).text.trim() !== (part as { text: string }).text.trim()
  })

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
          <p
            className={cn('text-xs font-medium', !isRail && 'text-muted-foreground')}
            style={isRail ? { color: 'var(--ink-3)' } : undefined}
          >
            {AGENT_LABELS[activeAgentType]}
          </p>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser ? 'rounded-br-md' : 'rounded-bl-md',
            !isRail && isUser && 'bg-primary text-primary-foreground',
            !isRail && !isUser && 'bg-muted',
          )}
          style={
            isRail
              ? isUser
                ? {
                    background: 'var(--brand-deep)',
                    color: 'var(--brand-ink)',
                  }
                : {
                    background: 'var(--panel-2)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line-soft)',
                  }
              : undefined
          }
        >
          {parts?.map((part, i) => {
            if (part.type === 'text') {
              return <RichTextContent key={i} text={part.text} variant={variant} />
            }
            // Tool invocation parts in v6 have type starting with 'tool-'
            if (part.type.startsWith('tool-')) {
              const toolPart = part as { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown }
              const toolName = part.type.replace(/^tool-/, '')
              // If there's any text part AFTER this tool call, the tool has finished
              // (the AI continued speaking, meaning the tool completed)
              const hasTextAfter = parts?.slice(i + 1).some(p => p.type === 'text' && (p as { text: string }).text.trim().length > 0)

              // "Finished" is not "worked". This inferred-completion rule was
              // painting a green tick on every tool the agent spoke after —
              // including a save that had just been rejected by the database.
              // The interface asserted success the agent had not earned, which
              // is how a failed save reached the user as "Saved to your outputs
              // library". A tool that reported a failure must look like one.
              const output = toolPart.output as { saved?: boolean; error?: unknown; success?: boolean } | undefined
              const reportedFailure = Boolean(
                output && typeof output === 'object' &&
                (output.error !== undefined || output.saved === false || output.success === false),
              )

              const effectiveState = reportedFailure ? 'error' : hasTextAfter ? 'result' : toolPart.state
              return (
                <ToolCallDisplay
                  key={i}
                  toolName={toolName}
                  args={(toolPart.input as Record<string, unknown>) ?? {}}
                  result={
                    effectiveState === 'error'
                      ? toolPart.output          // pass the failure through so it can be read
                      : effectiveState === 'result'
                        ? (toolPart.output ?? true)
                        : undefined
                  }
                  state={effectiveState}
                />
              )
            }
            return null
          })}
        </div>

        {/* Action bar for substantial assistant messages */}
        {showActions && (
          <MessageActions content={textContent} onRegenerate={onRegenerate} variant={variant} />
        )}
      </div>

      {isUser && (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={
            isRail
              ? { background: 'var(--panel-2)', color: 'var(--ink-3)' }
              : undefined
          }
        >
          <User className={cn('h-4 w-4', !isRail && 'text-muted-foreground')} />
        </div>
      )}
    </div>
  )
}
