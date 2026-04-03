'use client'

import { useState, useRef, useEffect } from 'react'
import { SendHorizontal, Plus, Paperclip, Mic, X } from 'lucide-react'
import type { AgentType, Brand } from '@/types/database'
import { useAgencyStore } from '@/stores/agency-store'

interface ChatInputProps {
  onSend: (text: string) => void
  isLoading: boolean
  placeholder?: string
  brand?: Brand | null
  agentType?: AgentType
  showChips?: boolean
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { activeBrandId } = useAgencyStore()

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
    // Reset so the same file can be re-selected
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
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('brandId', activeBrandId)
        const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData })

        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          // Send the error as a message so the agent can respond
          onSend(`I tried to upload ${selectedFile.name} but got an error: ${err.error || 'Upload failed'}`)
          setSelectedFile(null)
          setInput('')
          setIsUploading(false)
          return
        }

        const mediaItem = await uploadRes.json()
        const fileType = selectedFile.type.startsWith('video/') ? 'video'
          : selectedFile.type.startsWith('audio/') ? 'audio'
          : 'image'

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const chips = agentType ? (AGENT_CHIPS[agentType] ?? DEFAULT_CHIPS) : DEFAULT_CHIPS

  return (
    <div className="border-t bg-background px-4 py-3">
      {/* Main input — large, inviting, Claude-style */}
      <div className="mx-auto max-w-3xl">
        <div
          className={`relative rounded-2xl border bg-muted/30 shadow-sm transition-all focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/20 ${dragOver ? 'border-primary border-dashed ring-2 ring-primary/30' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* File attachment preview */}
          {selectedFile && (
            <div className="mx-4 mt-3 mb-1 flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs">
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
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
        </p>
      </div>
    </div>
  )
}
