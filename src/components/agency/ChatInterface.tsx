'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAgencyStore } from '@/stores/agency-store'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { Brand } from '@/types/database'
import { Bot, UserCircle } from 'lucide-react'
import { WelcomeScreen } from './WelcomeScreen'
import { getFriendlyError } from '@/lib/errors/friendly-messages'

interface ChatInterfaceProps {
  conversationId?: string
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [brand, setBrandLocal] = useState<Brand | null>(null)
  const { activeBrandId, activeAgentType, setConversation, restoreContext, setAgent } = useAgencyStore()

  // Refs so the transport always reads the LATEST values at send time
  // (not stale values captured when useMemo ran)
  const brandIdRef = useRef(activeBrandId)
  brandIdRef.current = activeBrandId

  // Fetch active brand for welcome screen context
  const fetchBrand = useCallback(() => {
    if (!activeBrandId) {
      setBrandLocal(null)
      return
    }
    fetch('/api/brands')
      .then(r => r.ok ? r.json() : [])
      .then((brands: Brand[]) => {
        const match = brands.find(b => b.id === activeBrandId)
        if (match) setBrandLocal(match)
      })
      .catch(() => {})
  }, [activeBrandId])

  useEffect(() => {
    setBrandLocal(null)
    fetchBrand()
  }, [fetchBrand])

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

  // Clear messages when brand or agent changes (only on new-chat page)
  useEffect(() => {
    if (!conversationId) setMessages([])
  }, [activeBrandId, activeAgentType, conversationId, setMessages])

  // Auto-send pending review message (from "Review Brand" button)
  const pendingHandled = useRef(false)
  useEffect(() => {
    if (pendingHandled.current) return
    const pending = useAgencyStore.getState().pendingReviewMessage
    if (pending && !conversationId && activeBrandId && brand) {
      pendingHandled.current = true
      useAgencyStore.getState().setPendingReviewMessage(null)
      setTimeout(() => handleSend(pending), 200)
    }
  }, [activeBrandId, brand, conversationId])

  // Director auto-greet: when a brand is loaded on a new conversation,
  // auto-send a contextual greeting so the Director speaks first
  const autoGreetSent = useRef<string | null>(null)
  useEffect(() => {
    // Only on new conversations with the Director, when brand is loaded
    if (conversationId || !brand || !activeBrandId) return
    if (activeAgentType !== 'overall') return
    if (pendingHandled.current) return // don't greet if a pending message is queued
    if (autoGreetSent.current === brand.id) return // already greeted this brand
    if (messages.length > 0) return // already has messages

    autoGreetSent.current = brand.id

    // Build a contextual greeting based on what's missing
    const missing: string[] = []
    if (!brand.social_urls || Object.keys(brand.social_urls).length === 0) missing.push('social media profiles')
    if (!brand.competitors || brand.competitors.length === 0) missing.push('competitors')
    if (!brand.products_services || brand.products_services.length === 0) missing.push('products and services')
    if (!brand.tone_of_voice?.keywords?.length) missing.push('brand voice keywords')
    if (!brand.target_audience?.demographics) missing.push('target audience')

    let greetMsg: string
    if (missing.length === 0) {
      greetMsg = `I've looked at ${brand.name} — you're in great shape. Website, GitHub, products, audience, voice — all set. What would you like me to work on first? I could write some social posts, plan a campaign, or fill your content calendar for the next couple of weeks.`
    } else if (missing.length <= 2) {
      greetMsg = `Hey — I've looked at ${brand.name}. Most things are set up, but I'm missing your ${missing.join(' and ')}. Can you tell me those quickly? Then I'll get straight to creating content.`
    } else {
      greetMsg = `Hey — I'm looking at ${brand.name}. I can see your website and some basics, but I'm missing a few things: ${missing.join(', ')}. Want to quickly tell me about these? Just chat naturally — I'll save everything as we go. Or if you'd rather jump straight to creating content, just say the word.`
    }

    setTimeout(() => handleSend(greetMsg), 400)
  }, [brand, activeBrandId, activeAgentType, conversationId, messages.length])

  // Load existing messages AND restore brand/agent when opening a conversation
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    const supabase = createClient()

    // Restore brand + agent from conversation record (no side-effect resets)
    supabase
      .from('conversations')
      .select('brand_id, agent_type')
      .eq('id', conversationId)
      .single()
      .then(({ data: conv }) => {
        if (conv?.brand_id && conv?.agent_type) {
          restoreContext(conv.brand_id, conv.agent_type, conversationId)
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
          <WelcomeScreen brand={brand} onAction={handleSend} onBrandRefresh={fetchBrand} />
        ) : (
          <div className="mx-auto max-w-3xl divide-y divide-border/50">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} onRegenerate={regenerate} />
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
      {error && (() => {
        const friendly = getFriendlyError(error)
        return (
          <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">
            <p className="flex-1 text-sm text-red-400">
              {friendly.message}
            </p>
            {friendly.actionType === 'retry' && (
              <button
                onClick={() => {
                  if (!activeBrandId) return
                  clearError()
                  regenerate()
                }}
                disabled={!activeBrandId}
                className="shrink-0 rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
              >
                {friendly.action ?? 'Retry'}
              </button>
            )}
            {friendly.actionType === 'login' && (
              <a
                href="/login"
                className="shrink-0 rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                {friendly.action ?? 'Log in'}
              </a>
            )}
            {friendly.actionType === 'director' && (
              <button
                onClick={() => {
                  clearError()
                  useAgencyStore.getState().setAgent('overall')
                }}
                className="shrink-0 rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                {friendly.action ?? 'Ask the Director'}
              </button>
            )}
            <button
              onClick={() => clearError()}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Dismiss
            </button>
          </div>
        )
      })()}

      {/* Back to Director safety net */}
      {activeAgentType !== 'overall' && (
        <div className="mx-4 mb-1 flex justify-center">
          <button
            onClick={() => setAgent('overall')}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <UserCircle className="h-3 w-3" />
            Not sure? Ask the Director
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  )
}
