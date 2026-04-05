'use client'

import Link from 'next/link'
import { PenLine, CalendarDays, Video, Palette, Target, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { StrategyBrief } from './StrategyBrief'

const ROOM_CARDS = [
  {
    icon: Video,
    colour: 'bg-red-500/15 text-red-400',
    title: 'Create a Video',
    description: 'AI presenter, edit yourself, or bulk import. HeyGen + OpenClaw + Canva.',
    href: '/agency/studio/video',
  },
  {
    icon: Palette,
    colour: 'bg-purple-500/15 text-purple-400',
    title: 'Design in Canva',
    description: 'Create graphics with AI, browse templates, or upload your own.',
    href: '/agency/studio/design',
  },
  {
    icon: PenLine,
    colour: 'bg-blue-500/15 text-blue-400',
    title: 'Write a Post',
    description: 'AI writes it, you edit, or both. Live platform previews.',
    href: '/agency/studio/post',
  },
  {
    icon: Target,
    colour: 'bg-amber-500/15 text-amber-400',
    title: 'Run a Campaign',
    description: 'Director convenes all departments. Full multi-channel plan.',
    href: '/agency/studio/campaign',
  },
  {
    icon: Repeat,
    colour: 'bg-emerald-500/15 text-emerald-400',
    title: 'Repurpose Content',
    description: 'Turn one piece into posts, clips, blogs, and newsletters.',
    href: '/agency/studio/repurpose',
  },
  {
    icon: CalendarDays,
    colour: 'bg-orange-500/15 text-orange-400',
    title: 'Fill My Calendar',
    description: 'AI fills gaps based on your strategy. Drag and drop.',
    href: '#calendar',
  },
]

export function CreateHub() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

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
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 space-y-3"
            >
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
            </Link>
          )
        })}
      </div>
    </div>
  )
}
