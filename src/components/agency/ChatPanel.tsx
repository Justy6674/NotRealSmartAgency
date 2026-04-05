'use client'

import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAgencyStore } from '@/stores/agency-store'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { AgentAvatar } from './AgentAvatar'
import { AGENT_LABELS } from '@/types/database'
import { MessageCircle, Minus, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatPanel() {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    activeBrandId,
    activeConversationId,
    chatPanelOpen,
    chatPanelMinimised,
    pendingReviewMessage,
    setChatPanelOpen,
    setChatPanelMinimised,
    setConversation,
    setPendingReviewMessage,
  } = useAgencyStore()

  // Always Director — the user never switches agents
  const activeAgentType = 'overall' as const

  // Check if we're on a full chat page (all hooks must be ABOVE this check)
  const isFullChatPage = pathname?.startsWith('/agency/chat')

  // Track the conversation ID for this panel
  const [panelConversationId, setPanelConversationId] = useState<string | null>(null)

  // Refs so the transport always reads latest values
  const brandIdRef = useRef(activeBrandId)
  brandIdRef.current = activeBrandId
  const convIdRef = useRef(panelConversationId)
  convIdRef.current = panelConversationId

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          get brandId() { return brandIdRef.current },
          agentType: activeAgentType,
          get conversationId() { return convIdRef.current },
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

  // Load the most recent conversation and its messages when brand changes
  useEffect(() => {
    if (!activeBrandId) {
      setMessages([])
      setPanelConversationId(null)
      return
    }

    // Fetch most recent conversation for this brand
    const params = new URLSearchParams({ brandId: activeBrandId })
    fetch(`/api/conversations?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then(async (convs: Array<{ id: string; agent_type: string }>) => {
        // Find most recent Director conversation
        const latest = convs.find(c => c.agent_type === 'overall') ?? convs[0]
        if (!latest) {
          setMessages([])
          setPanelConversationId(null)
          return
        }

        setPanelConversationId(latest.id)

        // Load its messages
        const msgRes = await fetch(`/api/conversations/${latest.id}/messages`)
        if (!msgRes.ok) return
        const msgs = await msgRes.json()
        if (Array.isArray(msgs) && msgs.length > 0) {
          // Convert DB messages to useChat format
          const chatMessages = msgs.map((m: { id: string; role: string; content: string; created_at?: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            parts: [{ type: 'text' as const, text: m.content }],
            createdAt: m.created_at ? new Date(m.created_at) : new Date(),
          }))
          setMessages(chatMessages)
        }
      })
      .catch(() => {
        setMessages([])
        setPanelConversationId(null)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrandId])

  // Also sync if the store's activeConversationId changes (e.g. from sidebar click)
  useEffect(() => {
    if (activeConversationId && activeConversationId !== panelConversationId) {
      setPanelConversationId(activeConversationId)
      // Load messages for this conversation
      fetch(`/api/conversations/${activeConversationId}/messages`)
        .then(r => r.ok ? r.json() : [])
        .then((msgs: Array<{ id: string; role: string; content: string }>) => {
          if (Array.isArray(msgs) && msgs.length > 0) {
            setMessages(msgs.map((m: { id: string; role: string; content: string; created_at?: string }) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              parts: [{ type: 'text' as const, text: m.content }],
              createdAt: m.created_at ? new Date(m.created_at) : new Date(),
            })))
          }
        })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  const handleSend = useCallback(async (text: string) => {
    if (!activeBrandId) return
    await sendMessage({ text })

    // Create conversation on first message if no conversation exists
    if (activeBrandId && !panelConversationId) {
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
        setPanelConversationId(conv.id)
        setConversation(conv.id)
      }
    }
  }, [activeBrandId, activeAgentType, panelConversationId, sendMessage, setConversation])

  // Ref to always have latest handleSend
  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend

  // Auto-send pending review message — expand panel if minimised
  useEffect(() => {
    if (!pendingReviewMessage || !activeBrandId) return

    // Ensure panel is open and expanded
    if (!chatPanelOpen) setChatPanelOpen(true)
    if (chatPanelMinimised) setChatPanelMinimised(false)

    const msg = pendingReviewMessage
    setPendingReviewMessage(null)

    // Delay to let the panel render/expand, use ref for latest handleSend
    const timer = setTimeout(() => {
      handleSendRef.current(msg)
    }, 500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReviewMessage])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Don't render on the full chat pages — AFTER all hooks
  if (isFullChatPage) return null

  return (
    <>
      {/* Toggle pill — visible when panel is closed (mobile only, or desktop when closed) */}
      {!chatPanelOpen && (
        <button
          onClick={() => setChatPanelOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
        >
          <MessageCircle className="h-4 w-4" />
          Chat
        </button>
      )}

      {/* Panel — inline on desktop (part of layout flow), fixed overlay on mobile */}
      <div
        className={cn(
          'flex flex-col border-l bg-background transition-all duration-200 ease-in-out',
          // Desktop: inline flow, shrink to width
          'hidden md:flex',
          chatPanelOpen
            ? chatPanelMinimised ? 'w-[380px] h-auto' : 'w-[380px] h-full'
            : 'w-0 overflow-hidden border-l-0',
        )}
      >
        {/* Header — always visible, acts as expand trigger when minimised */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 border-b px-3 py-2.5',
            chatPanelMinimised && 'cursor-pointer hover:bg-muted/50'
          )}
          onClick={chatPanelMinimised ? () => setChatPanelMinimised(false) : undefined}
        >
          <AgentAvatar agentType={activeAgentType} size="sm" />
          <span className="flex-1 text-sm font-medium text-foreground">
            {AGENT_LABELS[activeAgentType]}
          </span>

          {/* Minimise / Expand button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setChatPanelMinimised(!chatPanelMinimised)
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {chatPanelMinimised ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span className="sr-only">
              {chatPanelMinimised ? 'Expand chat panel' : 'Minimise chat panel'}
            </span>
          </button>
        </div>

        {/* Body — hidden when minimised */}
        {!chatPanelMinimised && (
          <>
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
          </>
        )}
      </div>

      {/* Desktop toggle — thin vertical bar when panel is closed */}
      {!chatPanelOpen && (
        <button
          onClick={() => setChatPanelOpen(true)}
          className="hidden md:flex h-full w-10 shrink-0 items-center justify-center border-l bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Open chat"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      )}

      {/* Mobile: fixed overlay panel */}
      {chatPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setChatPanelOpen(false)}
          />
          <div
            className={cn(
              'fixed right-0 top-0 z-40 flex w-full flex-col border-l bg-background shadow-xl md:hidden',
              chatPanelMinimised ? 'h-auto' : 'h-screen',
            )}
          >
            <div
              className={cn('flex shrink-0 items-center gap-2 border-b px-3 py-2.5', chatPanelMinimised && 'cursor-pointer')}
              onClick={chatPanelMinimised ? () => setChatPanelMinimised(false) : undefined}
            >
              <AgentAvatar agentType={activeAgentType} size="sm" />
              <span className="flex-1 text-sm font-medium text-foreground">{AGENT_LABELS[activeAgentType]}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setChatPanelOpen(false) }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
            {!chatPanelMinimised && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-3">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                      <AgentAvatar agentType={activeAgentType} size="lg" />
                      <p className="text-sm font-medium text-foreground">{AGENT_LABELS[activeAgentType]}</p>
                      <p className="text-xs text-muted-foreground">Ask me anything about your brand.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {messages.map((message) => (<ChatMessage key={message.id} message={message} />))}
                    </div>
                  )}
                </div>
                <ChatInput onSend={handleSend} isLoading={isLoading} placeholder="Ask your agent..." agentType={activeAgentType} showChips={messages.length === 0} />
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
