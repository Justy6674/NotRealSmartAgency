'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles,
  RefreshCw,
  CheckCheck,
  ArrowUp,
  ArrowDown,
  Zap,
  Smile,
  Frown,
  MessageSquare,
  Pen,
  X,
  Search,
  Type,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import { PLATFORM_CHAR_LIMITS } from '@/lib/post-versions'

// ── Command definitions ──────────────────────────────────────────────────────

interface SpotlightCommand {
  id: string
  label: string
  icon: React.ReactNode
  /** Only shown in modify mode */
  modifyOnly?: boolean
  /** Only shown in generate mode */
  generateOnly?: boolean
}

const MODIFY_COMMANDS: SpotlightCommand[] = [
  { id: 'rephrase', label: 'Rephrase', icon: <RefreshCw className="h-4 w-4" />, modifyOnly: true },
  { id: 'fix_grammar', label: 'Fix grammar', icon: <CheckCheck className="h-4 w-4" />, modifyOnly: true },
  { id: 'expand', label: 'Expand', icon: <ArrowUp className="h-4 w-4" />, modifyOnly: true },
  { id: 'shorten', label: 'Shorten', icon: <ArrowDown className="h-4 w-4" />, modifyOnly: true },
  { id: 'simplify', label: 'Simplify', icon: <Type className="h-4 w-4" />, modifyOnly: true },
  { id: 'punchier', label: 'Make punchier', icon: <Zap className="h-4 w-4" />, modifyOnly: true },
  { id: 'hook', label: 'Add a hook', icon: <MessageSquare className="h-4 w-4" />, modifyOnly: true },
  { id: 'friendly', label: 'Friendly tone', icon: <Smile className="h-4 w-4" />, modifyOnly: true },
  { id: 'formal', label: 'Formal tone', icon: <Pen className="h-4 w-4" />, modifyOnly: true },
  { id: 'edgy', label: 'Edgy tone', icon: <Frown className="h-4 w-4" />, modifyOnly: true },
  { id: 'engaging', label: 'Engaging tone', icon: <Sparkles className="h-4 w-4" />, modifyOnly: true },
  { id: 'add_emojis', label: 'Add emojis', icon: <Smile className="h-4 w-4" />, modifyOnly: true },
  { id: 'remove_emojis', label: 'Remove emojis', icon: <X className="h-4 w-4" />, modifyOnly: true },
]

const TONE_OPTIONS = ['Casual', 'Professional', 'Edgy', 'Playful', 'Inspirational', 'Urgent'] as const

// ── Props ────────────────────────────────────────────────────────────────────

export interface AiSpotlightProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caption: string
  brandName: string
  platforms: string[]
  charLimit?: number
}

/**
 * AI Spotlight — a command palette for the caption editor.
 *
 * Two modes:
 * - **Modify** (caption exists): searchable list of rewrite commands
 * - **Generate** (caption empty): generate a fresh caption with optional tone
 *
 * Sends all requests to the Director via sendToDirector().
 */
export function AiSpotlight({
  open,
  onOpenChange,
  caption,
  brandName,
  platforms,
  charLimit,
}: AiSpotlightProps) {
  const [search, setSearch] = useState('')
  const [selectedTone, setSelectedTone] = useState<(typeof TONE_OPTIONS)[number]>('Casual')
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const isModifyMode = caption.trim().length > 0

  // Resolve character limit from the first platform, falling back to prop then 2200
  const resolvedLimit =
    charLimit ??
    (platforms[0] ? PLATFORM_CHAR_LIMITS[platforms[0]] : undefined) ??
    2200

  const platformLabel = platforms.length > 0
    ? platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')
    : 'social media'

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  // Close on click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onOpenChange(false)
    },
    [onOpenChange],
  )

  // ── Modify command dispatch ────────────────────────────────────────────────
  const handleCommand = (cmd: SpotlightCommand) => {
    const prompt = `${cmd.label} this caption for ${brandName} (max ${resolvedLimit} chars for ${platformLabel}):\n\n"${caption}"\n\nReturn ONLY the improved caption text, nothing else.`
    sendToDirector(prompt)
    onOpenChange(false)
  }

  // ── Generate caption dispatch ──────────────────────────────────────────────
  const handleGenerate = () => {
    const prompt = `Write a caption for ${brandName}'s ${platformLabel} post. Tone: ${selectedTone}. Max ${resolvedLimit} chars. Return ONLY the caption text.`
    sendToDirector(prompt)
    onOpenChange(false)
  }

  // Filter commands by search
  const filteredCommands = MODIFY_COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()),
  )

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Search bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !isModifyMode) handleGenerate()
            }}
            placeholder={isModifyMode ? 'Search commands...' : 'Generate a caption...'}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colours"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode badge */}
        <div className="px-4 pt-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              isModifyMode
                ? 'bg-amber-500/15 text-amber-500'
                : 'bg-primary/15 text-primary',
            )}
          >
            <Wand2 className="h-3 w-3" />
            {isModifyMode ? 'Modify caption' : 'Generate caption'}
          </span>
        </div>

        {/* Command list or generate UI */}
        <div className="max-h-72 overflow-y-auto px-2 py-2">
          {isModifyMode ? (
            filteredCommands.length > 0 ? (
              filteredCommands.map(cmd => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => handleCommand(cmd)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground/90 hover:bg-muted transition-colours"
                >
                  <span className="text-amber-500">{cmd.icon}</span>
                  {cmd.label}
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                No commands match &quot;{search}&quot;
              </p>
            )
          ) : (
            <div className="space-y-3 px-2 py-2">
              <p className="text-xs text-muted-foreground">
                Choose a tone, then press Generate to have the Director write a caption for{' '}
                <strong>{brandName}</strong> on {platformLabel}.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TONE_OPTIONS.map(tone => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setSelectedTone(tone)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colours',
                      selectedTone === tone
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                    )}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colours"
              >
                <Sparkles className="h-4 w-4" />
                Generate caption
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            {isModifyMode ? 'Click a command to send to the Director' : 'Esc to close'}
          </p>
        </div>
      </div>
    </div>
  )
}
