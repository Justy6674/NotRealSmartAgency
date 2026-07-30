'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { SendHorizontal, Plus, Paperclip, X } from 'lucide-react'
import type { AgentType, Brand } from '@/types/database'
import { useAgencyStore } from '@/stores/agency-store'
import { filterCommands, type SlashCommand } from '@/lib/slash-commands'

interface ChatInputProps {
  onSend: (text: string, images?: { data: string; mimeType: string }[]) => void
  isLoading: boolean
  placeholder?: string
  brand?: Brand | null
  agentType?: AgentType
  showChips?: boolean
}

/** Read a File as base64 data (no data: prefix) */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:image/...;base64, prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Contextual quick chips — short labels, not full prompts
const AGENT_CHIPS: Record<string, { label: string; message: string }[]> = {
  overall: [
    { label: 'Write a post', message: 'Write me a social media post for my brand.' },
    { label: 'Fill my calendar', message: 'Fill my content calendar for the next 2 weeks.' },
    { label: 'Review my brand', message: 'Review my brand and tell me what I should focus on.' },
    { label: 'Upload a video', message: 'I want to upload a video and turn it into content.' },
  ],
  content: [
    { label: 'Social posts', message: 'Write social posts for my brand this week.' },
    { label: 'Blog article', message: 'Write a blog article for my brand.' },
    { label: 'Landing page copy', message: 'Write landing page copy for my main offer.' },
    { label: 'Email copy', message: 'Write an email marketing sequence for my brand.' },
  ],
  seo: [
    { label: 'Keyword research', message: 'Research the best keywords for my brand.' },
    { label: 'SEO audit', message: 'Audit my website for SEO issues.' },
    { label: 'AI search visibility', message: 'How visible is my brand in AI search results?' },
    { label: 'Topic clusters', message: 'Build topic clusters for my content strategy.' },
  ],
  paid_ads: [
    { label: 'Google Ads copy', message: 'Write Google Ads copy for my brand.' },
    { label: 'Meta ads', message: 'Create a Facebook and Instagram ad set for my brand.' },
    { label: 'Ad budget split', message: 'How should I split my ad budget across platforms?' },
    { label: 'TikTok ads', message: 'Write TikTok ad scripts for my brand.' },
  ],
  strategy: [
    { label: 'Campaign plan', message: 'Plan a multi-channel marketing campaign for my brand.' },
    { label: 'Go-to-market', message: 'Build a go-to-market plan for my product launch.' },
    { label: 'Growth roadmap', message: 'Create a 90-day growth roadmap for my brand.' },
    { label: 'Pricing strategy', message: 'Help me define my pricing strategy.' },
  ],
  email: [
    { label: 'Welcome sequence', message: 'Build a welcome email sequence for new subscribers.' },
    { label: 'Newsletter', message: 'Write this week\'s newsletter for my audience.' },
    { label: 'Re-engagement', message: 'Write a re-engagement email for inactive customers.' },
    { label: 'Check my inbox', message: 'Check my inbox for important customer emails.' },
  ],
  growth: [
    { label: 'Find partners', message: 'Help me find potential partners for my brand.' },
    { label: 'Referral program', message: 'Design a referral program for my customers.' },
    { label: 'Outreach emails', message: 'Draft partnership outreach emails.' },
    { label: 'PR campaign', message: 'Plan a PR campaign to get media coverage.' },
  ],
  brand: [
    { label: 'Brand voice', message: 'Help me define my brand voice and tone.' },
    { label: 'Brand guidelines', message: 'Create brand guidelines I can share with others.' },
    { label: 'Content pillars', message: 'Define my content pillars and messaging framework.' },
    { label: 'Visual identity', message: 'Generate brand visuals and imagery for my brand.' },
  ],
  competitor: [
    { label: 'SWOT analysis', message: 'Run a SWOT analysis against my competitors.' },
    { label: 'Scan competitors', message: 'Scan my competitors\' websites and tell me what they\'re doing.' },
    { label: 'Market gaps', message: 'Find gaps in the market I can exploit.' },
    { label: 'Battle cards', message: 'Create battle cards comparing me to my top competitors.' },
  ],
  website: [
    { label: 'CRO audit', message: 'Audit my website for conversion rate improvements.' },
    { label: 'Page copy', message: 'Rewrite a page on my website to convert better.' },
    { label: 'UX review', message: 'Review my website UX and suggest improvements.' },
    { label: 'Hero section', message: 'Write a better hero section for my homepage.' },
  ],
  compliance: [
    { label: 'Review content', message: 'Check this content for AHPRA and TGA compliance.' },
    { label: 'Audit claims', message: 'Audit my website for non-compliant health claims.' },
    { label: 'Safe language', message: 'Rewrite this using compliant language.' },
    { label: 'Social check', message: 'Check my social media posts for compliance issues.' },
  ],
  analytics: [
    { label: 'How am I doing?', message: 'Show me my marketing performance summary.' },
    { label: 'What\'s working?', message: 'Analyse what content is working best and why.' },
    { label: 'Monthly report', message: 'Generate a monthly marketing report.' },
    { label: 'Campaign ROI', message: 'Calculate the ROI on my recent campaigns.' },
  ],
  automation: [
    { label: 'Lead workflow', message: 'Design an automated lead nurture workflow.' },
    { label: 'Zapier flows', message: 'Suggest Zapier automations for my marketing stack.' },
    { label: 'Chatbot flow', message: 'Design a chatbot flow for my website.' },
    { label: 'Scan my repo', message: 'Scan my GitHub repo and suggest improvements.' },
  ],
  video: [
    { label: 'Write a script', message: 'Write a video script for my brand.' },
    { label: 'Process a video', message: 'I have a video to process into content.' },
    { label: 'Repurpose video', message: 'Repurpose my latest video into clips, posts, and a blog.' },
    { label: 'Storyboard', message: 'Create a storyboard for a product demo video.' },
  ],
}

const DEFAULT_CHIPS = AGENT_CHIPS.overall

export function ChatInput({
  onSend,
  isLoading,
  placeholder = 'How can I help you today?',
  brand,
  agentType,
  showChips = false,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashResults, setSlashResults] = useState<SlashCommand[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { activeBrandId } = useAgencyStore()

  // A row on the board arrives here as text he can read and change before it
  // is sent. Sending it for him would take the decision away at the moment he
  // asked to look at it.
  useEffect(() => {
    const pending = useAgencyStore.getState().pendingComposerText
    if (!pending) return
    useAgencyStore.getState().setPendingComposerText(null)
    setInput(pending)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(pending.length, pending.length)
    })
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  // Slash command detection
  useEffect(() => {
    if (input.startsWith('/')) {
      const results = filterCommands(input)
      setSlashResults(results)
      setShowSlashMenu(results.length > 0)
      setSelectedIndex(0)
    } else {
      setShowSlashMenu(false)
      setSlashResults([])
    }
  }, [input])

  // Scroll selected item into view
  useEffect(() => {
    if (!showSlashMenu || !dropdownRef.current) return
    const items = dropdownRef.current.querySelectorAll('[data-slash-item]')
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, showSlashMenu])

  const selectCommand = useCallback((cmd: SlashCommand) => {
    setInput('')
    setShowSlashMenu(false)
    setSlashResults([])
    onSend(cmd.message)
  }, [onSend])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type.startsWith('image/'))) {
      setSelectedFile(file)
    }
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if ((!trimmed && !selectedFile) || isLoading || isUploading) return

    if (selectedFile && activeBrandId) {
      const isImage = selectedFile.type.startsWith('image/')

      if (isImage) {
        // Images: convert to base64 and send as multimodal message (AI sees the image)
        setIsUploading(true)
        try {
          const base64 = await readFileAsBase64(selectedFile)
          onSend(trimmed || '', [{ data: base64, mimeType: selectedFile.type }])
          setSelectedFile(null)
          setInput('')
        } catch {
          onSend(`I tried to attach ${selectedFile.name} but something went wrong. Please try again.`)
          setSelectedFile(null)
          setInput('')
        } finally {
          setIsUploading(false)
        }
        return
      }

      // Video/audio: upload to media pipeline as before
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('brandId', activeBrandId)
        const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData })

        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          onSend(`I tried to upload ${selectedFile.name} but got an error: ${err.error || 'Upload failed'}`)
          setSelectedFile(null)
          setInput('')
          setIsUploading(false)
          return
        }

        const mediaItem = await uploadRes.json()
        const fileType = selectedFile.type.startsWith('video/') ? 'video' : 'audio'

        const fileMsg = trimmed
          ? `${trimmed} [Uploaded ${fileType}: ${selectedFile.name}, media_item_id: ${mediaItem.id}]`
          : `I've uploaded a ${fileType}: ${selectedFile.name}. Process this and create content from it. [media_item_id: ${mediaItem.id}]`

        onSend(fileMsg)
        setSelectedFile(null)
        setInput('')
      } catch {
        onSend(`I tried to upload ${selectedFile.name} but something went wrong. Please try again.`)
        setSelectedFile(null)
        setInput('')
      } finally {
        setIsUploading(false)
      }
      return
    }

    if (trimmed) {
      onSend(trimmed)
      setInput('')
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) setSelectedFile(file)
        return
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && slashResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % slashResults.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + slashResults.length) % slashResults.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        selectCommand(slashResults[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashMenu(false)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        selectCommand(slashResults[selectedIndex])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const chips = agentType ? (AGENT_CHIPS[agentType] ?? DEFAULT_CHIPS) : DEFAULT_CHIPS

  return (
    <div className="border-t bg-background px-4 py-3">
      {/* Main input -- large, inviting, Claude-style */}
      <div className="mx-auto max-w-3xl">
        <div
          className={`relative rounded-2xl border bg-muted/30 shadow-sm transition-all focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/20 ${dragOver ? 'border-primary border-dashed ring-2 ring-primary/30' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Slash command dropdown — positioned above the input */}
          {showSlashMenu && slashResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg"
            >
              <div className="mb-1.5 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Commands
              </div>
              {slashResults.map((cmd, i) => (
                <button
                  key={cmd.command}
                  type="button"
                  data-slash-item
                  onClick={() => selectCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    i === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                >
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                    {cmd.command}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {cmd.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {cmd.description}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {cmd.category}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* File attachment preview */}
          {selectedFile && (
            <div className="mx-4 mt-3 mb-1 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
              {selectedFile.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
              ) : (
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{selectedFile.name}</span>
              <span className="shrink-0 text-muted-foreground">
                ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
              </span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {/* Drag overlay hint */}
          {dragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-primary/5">
              <p className="text-sm font-medium text-primary">Drop file here</p>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading || isUploading}
            className="w-full resize-none rounded-2xl bg-transparent px-4 pb-12 pt-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
          />
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          {/* Bottom bar inside the input box */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg p-2 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                title="Attach file"
              >
                <Plus className="h-4 w-4" />
              </button>
              {/* Slash hint — visible when input is empty */}
              {!input && (
                <span className="select-none pl-1 text-[11px] text-muted-foreground/40">
                  Type <kbd className="rounded border border-border/50 bg-muted/50 px-1 py-0.5 font-mono text-[10px]">/</kbd> for shortcuts
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={(!input.trim() && !selectedFile) || isLoading || isUploading}
              onClick={handleSend}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
            >
              {isUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Quick action chips — shown when no messages */}
        {showChips && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => onSend(chip.message)}
                disabled={isLoading}
                className="rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
          Shift + Enter for new line. AI outputs should be reviewed before publishing.
          {' '}<a href="https://help.notrealsmart.com.au" target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary underline">Help Centre</a>
        </p>
      </div>
    </div>
  )
}
