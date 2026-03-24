'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAgencyStore } from '@/stores/agency-store'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { Brand } from '@/types/database'
import { Bot } from 'lucide-react'
import { WelcomeScreen } from './WelcomeScreen'

interface ChatInterfaceProps {
  conversationId?: string
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [brand, setBrandLocal] = useState<Brand | null>(null)
  const { activeBrandId, activeAgentType, setConversation, setBrand, setAgent } = useAgencyStore()

  // Refs so the transport always reads the LATEST values at send time
  // (not stale values captured when useMemo ran)
  const brandIdRef = useRef(activeBrandId)
  brandIdRef.current = activeBrandId

  // Fetch active brand for compliance badge and context display
  useEffect(() => {
    setBrandLocal(null) // Clear immediately to prevent stale brand showing
    if (!activeBrandId) return
    const supabase = createClient()
    supabase
      .from('brands')
      .select('*')
      .eq('id', activeBrandId)
      .single()
      .then(({ data }) => {
        if (data) setBrandLocal(data as Brand)
      })
  }, [activeBrandId])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          get brandId() { return brandIdRef.current },
          agentType: activeAgentType,
          conversationId: conversationId ?? null,
        },
      }),
    [activeAgentType, conversationId]
  )

  const { messages, sendMessage, setMessages, status, error, regenerate, clearError } = useChat({
    transport,
    onError: (err) => {
      console.error('[chat] Stream error:', err.message)
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Clear messages when brand or agent changes
  useEffect(() => {
    setMessages([])
  }, [activeBrandId, activeAgentType, setMessages])

  // Load existing messages AND restore brand/agent when opening a conversation
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    const supabase = createClient()

    // Restore brand + agent from conversation record
    supabase
      .from('conversations')
      .select('brand_id, agent_type')
      .eq('id', conversationId)
      .single()
      .then(({ data: conv }) => {
        if (conv) {
          if (conv.brand_id) setBrand(conv.brand_id)
          if (conv.agent_type) setAgent(conv.agent_type)
        }
      })

    // Load messages
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(
            data.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              parts: [{ type: 'text' as const, text: m.content }],
            }))
          )
        }
      })
  }, [conversationId, setMessages])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text: string) => {
    if (!activeBrandId) return // Guard: don't send without a brand
    await sendMessage({ text })

    // Create conversation on first message if no conversationId
    if (!conversationId && activeBrandId && messages.length === 0) {
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
        window.history.replaceState(null, '', `/agency/chat/${conv.id}`)
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
        {messages.length === 0 ? (
          <WelcomeScreen brand={brand} onAction={handleSend} />
        ) : (
          <div className="mx-auto max-w-3xl divide-y divide-border/50">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* No brand selected */}
      {!activeBrandId && (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
          <p className="text-sm text-amber-400">
            Select a brand from the sidebar to start chatting.
          </p>
        </div>
      )}

      {/* Error recovery */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">
          <p className="flex-1 text-sm text-red-400">
            Something went wrong — {error.message?.includes('fetch') ? 'network interrupted' : error.message}
          </p>
          <button
            onClick={() => {
              if (!activeBrandId) return
              clearError()
              regenerate()
            }}
            disabled={!activeBrandId}
            className="shrink-0 rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
          >
            Retry
          </button>
          <button
            onClick={() => clearError()}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  )
}
