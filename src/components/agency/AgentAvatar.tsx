'use client'

import type { AgentType } from '@/types/database'
import {
  UserCircle,
  PenLine,
  Search,
  Megaphone,
  Target,
  Mail,
  TrendingUp,
  Palette,
  Eye,
  Globe,
  ShieldCheck,
  BarChart3,
  Zap,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Icon map — one icon per department
// ---------------------------------------------------------------------------

export const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  overall: UserCircle,
  content: PenLine,
  seo: Search,
  paid_ads: Megaphone,
  strategy: Target,
  email: Mail,
  growth: TrendingUp,
  brand: Palette,
  competitor: Eye,
  website: Globe,
  compliance: ShieldCheck,
  analytics: BarChart3,
  automation: Zap,
  martech: Wrench,
}

// ---------------------------------------------------------------------------
// Colour map — oklch-based badge classes per department
// ---------------------------------------------------------------------------

export const AGENT_COLOURS: Record<AgentType, string> = {
  overall: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  content: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  seo: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/30',
  paid_ads: 'bg-pink-500/15 text-pink-400 ring-pink-500/30',
  strategy: 'bg-orange-500/15 text-orange-400 ring-orange-500/30',
  email: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/30',
  growth: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  brand: 'bg-purple-500/15 text-purple-400 ring-purple-500/30',
  competitor: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
  website: 'bg-teal-500/15 text-teal-400 ring-teal-500/30',
  compliance: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30',
  analytics: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  automation: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  martech: 'bg-stone-500/15 text-stone-400 ring-stone-500/30',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentAvatarProps {
  agentType: AgentType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'h-6 w-6 [&>svg]:h-3 [&>svg]:w-3',
  md: 'h-8 w-8 [&>svg]:h-4 [&>svg]:w-4',
  lg: 'h-12 w-12 [&>svg]:h-6 [&>svg]:w-6',
}

export function AgentAvatar({ agentType, size = 'md', className }: AgentAvatarProps) {
  const Icon = AGENT_ICONS[agentType] ?? UserCircle
  const colours = AGENT_COLOURS[agentType] ?? AGENT_COLOURS.overall
  const isDirector = agentType === 'overall'

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        colours,
        SIZES[size],
        isDirector && 'ring-1',
        className
      )}
    >
      <Icon />
    </div>
  )
}
