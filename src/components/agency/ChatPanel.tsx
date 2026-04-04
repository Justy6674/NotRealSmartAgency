'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAgencyStore } from '@/stores/agency-store'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS } from '@/types/database'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatPanel() {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    activeBrandId,
    chatPanelOpen,
    setChatPanelOpen,
    setConversation,
  } = useAgencyStore()

  // Always Director — the user never switches agents
  const activeAgentType = 'overall' as const

  // Check if we're on a full chat page (all hooks must be ABOVE this check)
  const isFullChatPage = pathname?.startsWith('/agency/chat')

  // Ref so the transport always reads latest brandId
  const brandIdRef = useRef(activeBrandId)
  brandIdRef.current = activeBrandId

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          get brandId() { return brandIdRef.current },
          agentType: activeAgentType,
          conversationId: null,
        },
      }),
    [activeAgentType]
  )

  const { messages, sendMessage, setMessages, status, error, clearError } = useChat({
    transport,
    onError: (err) => {
      console.error('[chat-panel] Stream error:', err.message)
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Clear messages when brand or agent changes
  useEffect(() => {
    setMessages([])
  }, [activeBrandId, activeAgentType, setMessages])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async (text: string) => {
    if (!activeBrandId) return
    await sendMessage({ text })

    // Create conversation on first message
    if (activeBrandId && messages.length === 0) {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          agentType: activeAgentType,
          title: text.slice(0, 80),
        }),
      })
      const conv = await res.json()
      if (conv?.id) {
        setConversation(conv.id)
      }
    }
  }, [activeBrandId, activeAgentType, messages.length, sendMessage, setConversation])

  // Don't render on the full chat pages — AFTER all hooks
  if (isFullChatPage) return null

  return (
    <>
      {/* Toggle pill — visible when panel is closed */}
      {!chatPanelOpen && (
        <button
          onClick={() => setChatPanelOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="h-4 w-4" />
          Chat
        </button>
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-40 flex h-screen w-[380px] flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-in-out',
          chatPanelOpen ? 'translate-x-0' : 'translate-x-full',
          // Mobile: full width
          'max-md:w-full'
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
          <AgentAvatar agentType={activeAgentType} size="sm" />
          <span className="flex-1 text-sm font-medium text-foreground">
            {AGENT_LABELS[activeAgentType]}
          </span>

          {/* Close button */}
          <button
            onClick={() => setChatPanelOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close chat panel</span>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <AgentAvatar agentType={activeAgentType} size="lg" />
              <p className="text-sm font-medium text-foreground">
                {AGENT_LABELS[activeAgentType]}
              </p>
              {!activeBrandId ? (
                <p className="text-xs text-amber-400">
                  Select a brand from the sidebar to start chatting.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ask me anything about your brand.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3 py-4">
                  <AgentAvatar agentType={activeAgentType} size="sm" />
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <p className="flex-1 text-xs text-red-400">
              Something went wrong. Please try again.
            </p>
            <button
              onClick={() => clearError()}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          placeholder="Ask your agent..."
          agentType={activeAgentType}
          showChips={messages.length === 0}
        />
      </div>

      {/* Backdrop on mobile when panel is open */}
      {chatPanelOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setChatPanelOpen(false)}
        />
      )}
    </>
  )
}
