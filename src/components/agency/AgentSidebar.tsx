'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { AgentType } from '@/types/database'
import {
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
} from 'lucide-react'

const AGENTS: { type: AgentType; label: string; icon: React.ElementType; description: string }[] = [
  { type: 'content', label: 'Content & Copy', icon: PenLine, description: 'Social, blogs, landing pages' },
  { type: 'seo', label: 'SEO', icon: Search, description: 'Keywords, topics, on-page' },
  { type: 'paid_ads', label: 'Paid Ads', icon: Megaphone, description: 'Meta, Google, LinkedIn, TikTok' },
  { type: 'strategy', label: 'Strategy', icon: Target, description: 'Campaigns, GTM, launches' },
  { type: 'email', label: 'Email', icon: Mail, description: 'Sequences, EDMs, newsletters' },
  { type: 'growth', label: 'Growth', icon: TrendingUp, description: 'Referrals, PR, partnerships' },
  { type: 'brand', label: 'Brand', icon: Palette, description: 'Voice, pillars, positioning' },
  { type: 'competitor', label: 'Competitors', icon: Eye, description: 'Analysis, gaps, SWOT' },
  { type: 'website', label: 'Website', icon: Globe, description: 'Copy, UX, conversion' },
  { type: 'compliance', label: 'Compliance', icon: ShieldCheck, description: 'AHPRA, TGA checks' },
]

export function AgentSidebar() {
  const { activeAgentType, setAgent } = useAgencyStore()

  return (
    <aside className="hidden md:flex w-56 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Departments
        </span>
      </div>
      <ScrollArea className="flex-1 py-2">
        {AGENTS.map(({ type, label, icon: Icon, description }) => (
          <button
            key={type}
            onClick={() => setAgent(type)}
            className={cn(
              'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
              activeAgentType === type
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className={cn('text-sm', activeAgentType === type && 'font-medium')}>
                {label}
              </p>
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            </div>
          </button>
        ))}
      </ScrollArea>
    </aside>
  )
}
