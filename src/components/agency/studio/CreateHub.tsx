'use client'

import Link from 'next/link'
import { PenLine, CalendarDays, Video, Palette, Target, Repeat, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { StrategyBrief } from './StrategyBrief'
import { sendToDirector } from '@/lib/chat-dispatch'

interface CardDef {
  icon: typeof Video
  colour: string
  title: string
  description: string
  buildMessage: (brand: string, context: string) => string
}

const ROOM_CARDS: CardDef[] = [
  {
    icon: Video,
    colour: 'bg-red-500/15 text-red-400',
    title: 'Create a Video',
    description: 'AI presenter, edit yourself, or bulk import. HeyGen + OpenClaw + Canva.',
    buildMessage: (brand, ctx) =>
      `I want to create a video for ${brand}.\n${ctx}\nWhat type of video should we make? Suggest 2-3 options with platform, style, and topic — then I'll pick one and you generate it.`,
  },
  {
    icon: Palette,
    colour: 'bg-purple-500/15 text-purple-400',
    title: 'Design in Canva',
    description: 'Create graphics with AI, browse templates, or upload your own.',
    buildMessage: (brand, ctx) =>
      `I need a graphic design for ${brand}.\n${ctx}\nWhat should we design? Suggest 2-3 concepts with platform, style, and layout — then ask which one I prefer before generating.`,
  },
  {
    icon: PenLine,
    colour: 'bg-blue-500/15 text-blue-400',
    title: 'Write a Post',
    description: 'AI writes it, you edit, or both. Live platform previews.',
    buildMessage: (brand, ctx) =>
      `Write a social media post for ${brand}.\n${ctx}\nWhich platform needs content most right now? Write the post, show me a preview, and let me approve before scheduling.`,
  },
  {
    icon: Target,
    colour: 'bg-amber-500/15 text-amber-400',
    title: 'Run a Campaign',
    description: 'Director convenes all departments. Full multi-channel plan.',
    buildMessage: (brand, ctx) =>
      `I want to run a marketing campaign for ${brand}.\n${ctx}\nSuggest a campaign concept, target platforms, timeline, and content pieces. Walk me through it step by step.`,
  },
  {
    icon: Repeat,
    colour: 'bg-emerald-500/15 text-emerald-400',
    title: 'Repurpose Content',
    description: 'Turn one piece into posts, clips, blogs, and newsletters.',
    buildMessage: (brand, ctx) =>
      `I have content I want to repurpose across platforms for ${brand}.\n${ctx}\nAsk me what content to repurpose, then create versions for each connected platform.`,
  },
  {
    icon: CalendarDays,
    colour: 'bg-orange-500/15 text-orange-400',
    title: 'Fill My Calendar',
    description: 'AI fills gaps based on your strategy. Drag and drop.',
    buildMessage: (brand, ctx) =>
      `Fill my content calendar for the next 2 weeks for ${brand}.\n${ctx}\nCreate a mix of content types across my connected platforms. Show me the calendar plan before scheduling anything.`,
  },
]

export function CreateHub() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  const brandName = data.brand?.name
  const agentContext = strategyContext?.agentContext ?? ''
  const hasBrand = !!brandName

  if (!activeBrandId) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Select a brand from the sidebar to start creating content.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <StrategyBrief context={strategyContext} />
      <div>
        <h2 className="text-lg font-semibold text-foreground">Create Content</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a workspace. AI helps, you control.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROOM_CARDS.map(card => {
          const Icon = card.icon
          return (
            <button
              key={card.title}
              type="button"
              disabled={!hasBrand}
              onClick={() => {
                if (hasBrand) {
                  sendToDirector(card.buildMessage(brandName!, agentContext))
                }
              }}
              className={cn(
                'group relative rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 space-y-3',
                !hasBrand && 'opacity-50 cursor-not-allowed hover:border-border hover:bg-card',
              )}
            >
              <MessageSquare className="absolute top-3 right-3 h-3.5 w-3.5 text-white/40" />
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.colour)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-6 text-center">
        <p className="text-[10px] text-muted-foreground mb-2">Prefer detailed creation tools?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/agency/studio/video" className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">Video Room</Link>
          <Link href="/agency/studio/design" className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">Design Room</Link>
          <Link href="/agency/studio/post" className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">Post Composer</Link>
          <Link href="/agency/studio/repurpose" className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">Repurpose</Link>
          <Link href="/agency/studio/campaign" className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">Campaign</Link>
        </div>
      </div>
    </div>
  )
}
