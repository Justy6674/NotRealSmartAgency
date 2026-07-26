'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAgencyStore } from '@/stores/agency-store'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import type { Brand } from '@/types/database'
import { Bot } from 'lucide-react'
import { WelcomeScreen } from './WelcomeScreen'
import { getFriendlyError } from '@/lib/errors/friendly-messages'
import { MarketingDNABar } from './MarketingDNABar'

interface ChatInterfaceProps {
  conversationId?: string
}

interface MixpostBrandSocial {
  platform: string
  accountName: string
  provider: string
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [brand, setBrandLocal] = useState<Brand | null>(null)
  const [mixpostSocials, setMixpostSocials] = useState<Record<string, MixpostBrandSocial[]>>({})
  const { activeBrandId, activeAgentType, setConversation, restoreContext } = useAgencyStore()

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

  // Fetch Mixpost connected accounts (cached endpoint, light call)
  const mixpostFetched = useRef(false)
  useEffect(() => {
    if (mixpostFetched.current) return
    mixpostFetched.current = true
    fetch('/api/mixpost/accounts')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.brandMapping) setMixpostSocials(data.brandMapping)
      })
      .catch(() => {})
  }, [])

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

  // Director greeting: pre-load a static assistant message (no API call, no fake user bubble)
  const greetApplied = useRef<string | null>(null)
  useEffect(() => {
    if (conversationId || !brand || !activeBrandId) return
    if (pendingHandled.current) return
    if (greetApplied.current === brand.id) return
    if (messages.length > 0) return

    greetApplied.current = brand.id

    // Build a greeting that shows what the Director knows about this brand
    const lines: string[] = [`Hey! Here's what I know about **${brand.name}**:\n`]

    // What we know
    if (brand.website_url) lines.push(`**Website:** ${brand.website_url} — scanned`)
    if (brand.github_url) lines.push(`**Codebase:** ${brand.github_context ? 'Synced from GitHub' : brand.github_url}`)
    if (brand.description) lines.push(`**What you do:** ${brand.description}`)
    if (brand.products_services?.length) {
      lines.push(`**Products:** ${brand.products_services.map(p => p.name).join(', ')}`)
    }
    if (brand.target_audience?.demographics) {
      lines.push(`**Audience:** ${brand.target_audience.demographics}`)
    }
    if (brand.tone_of_voice?.formality) {
      lines.push(`**Voice:** ${brand.tone_of_voice.formality}${brand.tone_of_voice.humour !== 'none' ? `, ${brand.tone_of_voice.humour} humour` : ''}`)
    }
    if (brand.content_pillars?.length) {
      lines.push(`**Content pillars:** ${brand.content_pillars.join(', ')}`)
    }
    if (brand.compliance_flags?.ahpra || brand.compliance_flags?.tga) {
      const flags = [brand.compliance_flags.ahpra && 'AHPRA', brand.compliance_flags.tga && 'TGA'].filter(Boolean).join(' + ')
      lines.push(`**Compliance:** ${flags}`)
    }
    // Social profiles: prefer Mixpost connected accounts, fall back to brand social_urls
    const brandMixpost = mixpostSocials[brand.id]
    if (brandMixpost?.length) {
      const platforms = [...new Set(brandMixpost.map(s => s.platform))]
      lines.push(`**Socials:** ${platforms.join(', ')} (connected via Mixpost)`)
    } else if (brand.social_urls && Object.keys(brand.social_urls).length > 0) {
      lines.push(`**Socials:** ${Object.keys(brand.social_urls).join(', ')}`)
    }

    // Channel strategy
    const cs = brand.channel_strategy
    const hasChannels = cs?.channels && Object.keys(cs.channels).length > 0
    if (hasChannels) {
      const channels = Object.entries(cs!.channels!)
        .filter(([, pct]) => pct > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([ch, pct]) => `${ch} ${pct}%`)
        .join(', ')
      lines.push(`**Marketing DNA:** ${channels}`)
    }

    // Guided onboarding — instead of listing missing items, guide the user
    const hasSocials = (brandMixpost?.length ?? 0) > 0 || (brand.social_urls && Object.keys(brand.social_urls).length > 0)
    const hasDNA = brand.brand_dna_constraints && Object.keys(brand.brand_dna_constraints).length > 0

    // Count what's set up vs what's missing
    const setupDone = [
      brand.description,
      brand.products_services?.length,
      brand.target_audience?.demographics,
      hasSocials,
      hasChannels,
      hasDNA,
      brand.competitors?.length,
    ].filter(Boolean).length
    const setupTotal = 7

    if (setupDone < 3) {
      // Brand is mostly empty — start guided setup
      lines.push(`\nLet's get you set up — it'll take 2 minutes.\n`)
      lines.push(`**First question:** Where are your customers? Pick the platforms that matter most — Instagram, TikTok, LinkedIn, Facebook, YouTube — and I'll build your marketing strategy around them.`)
    } else if (!hasChannels) {
      // Brand has basics but no marketing strategy
      lines.push(`\nYou're almost set up. One thing I need to start creating content:\n`)
      lines.push(`**Where should I focus?** Which platforms matter most for ${brand.name}? For example: "TikTok and Instagram" or "LinkedIn mainly". I'll set your Marketing DNA and everything I create will follow it.`)
    } else if (!hasDNA) {
      // Has strategy but no brand voice rules
      lines.push(`\nYour marketing strategy is set. One more thing to protect your brand:\n`)
      lines.push(`**What should ${brand.name} never say?** Any words or phrases that don't fit your brand? Any rules about how you communicate? This helps me keep your voice consistent across everything.`)
    } else {
      // Fully set up — show what they can do
      lines.push(`\nYou're all set. I can:`)
      lines.push(`- **Write content** for your platforms`)
      lines.push(`- **Fill your calendar** for the next 2 weeks`)
      lines.push(`- **Run a full campaign** (type /campaign)`)
      lines.push(`- **Design graphics** in Canva`)
      lines.push(`- **Plan videos** with scripts, shot lists, captions and production briefs`)
      lines.push(`- **Scan competitors** and find gaps`)
      lines.push(`\nWhat would you like to work on?`)
    }

    const greeting = lines.join('\n')

    // Handle bare brands differently
    let finalGreeting: string
    if (!brand.description && !brand.products_services?.length && !brand.website_url) {
      finalGreeting = `Hey! Tell me about ${brand.name} — what do you do and who are your customers?`
    } else {
      finalGreeting = greeting
    }

    // Insert as a pre-loaded assistant message — NOT sent through the API
    setMessages([{
      id: `greet-${brand.id}`,
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: finalGreeting }],
    }])
  }, [brand, activeBrandId, conversationId, messages.length, setMessages])

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

  // Auto-scroll on new messages + refetch brand after assistant replies (strategy may have changed)
  const prevMsgCount = useRef(messages.length)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    // If a new assistant message arrived, refetch brand data (channel strategy / signature may have changed)
    if (messages.length > prevMsgCount.current && messages[messages.length - 1]?.role === 'assistant') {
      fetchBrand()
    }
    prevMsgCount.current = messages.length
  }, [messages, fetchBrand])

  const handleSend = async (text: string, images?: { data: string; mimeType: string }[]) => {
    if (!activeBrandId) return // Guard: don't send without a brand

    if (images?.length) {
      // Multimodal message: text + file parts (AI SDK v6 FileUIPart format)
      const files = images.map(img => ({
        type: 'file' as const,
        mediaType: img.mimeType,
        url: `data:${img.mimeType};base64,${img.data}`,
      }))
      await sendMessage({ text: text || 'What do you see in this image?', files })
    } else {
      await sendMessage({ text })
    }

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
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {!activeBrandId ? 'Pick a brand from the sidebar, or tell me about your business.' : ''}
            </p>
          </div>
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

      {/* No brand selected — first-time user greeting */}
      {!activeBrandId && messages.length === 0 && (
        <div className="mx-4 mb-2 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-foreground">
            Hey! I&apos;m your marketing team. Pick a brand from the sidebar, or tell me about your business and I&apos;ll set everything up.
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
                  regenerate()
                }}
                className="shrink-0 rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Try again
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

      {/* Marketing DNA Bar — shows channel strategy for the active brand */}
      {brand && <MarketingDNABar strategy={brand.channel_strategy} brandName={brand.name} />}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        brand={brand}
        agentType={activeAgentType}
        showChips={messages.length === 0}
      />
    </div>
  )
}
