'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ListTodo,
  Users,
  ShieldCheck,
  DollarSign,
  Activity,
  FileText,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'

import { ACTIVE_AGENT_TYPES, AGENT_LABELS } from '@/types/database'
import type { Brand, Conversation, AgentType } from '@/types/database'
import { AGENT_ICONS, AGENT_COLOURS } from '@/components/agency/AgentAvatar'
import { AddBrandDialog } from './AddBrandDialog'

// Badge classes derived from AGENT_COLOURS (just the bg + text parts)
const AGENT_BADGE_CLASSES: Partial<Record<AgentType, string>> = Object.fromEntries(
  Object.entries(AGENT_COLOURS).map(([key, val]) => [
    key,
    val.split(' ').slice(0, 2).join(' '), // e.g. "bg-amber-500/15 text-amber-400"
  ])
)

// ─── Date Grouping Helper ─────────────────────────────────────────────────────

function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const conv of conversations) {
    const date = new Date(conv.updated_at)
    if (date >= today) {
      groups[0].items.push(conv)
    } else if (date >= yesterday) {
      groups[1].items.push(conv)
    } else if (date >= weekAgo) {
      groups[2].items.push(conv)
    } else {
      groups[3].items.push(conv)
    }
  }

  return groups.filter(g => g.items.length > 0)
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProjectSidebarProps {
  onClose?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectSidebar({ onClose }: ProjectSidebarProps) {
  const router = useRouter()
  const {
    activeBrandId,
    activeAgentType,
    activeConversationId,
    setBrand,
    setAgent,
    setConversation,
    selectConversation,
  } = useAgencyStore()

  const [brands, setBrands] = useState<Brand[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [teamExpanded, setTeamExpanded] = useState(true)
  const [showAddBrand, setShowAddBrand] = useState(false)

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands')
      if (!res.ok) {
        console.error('[sidebar] Brand fetch failed:', res.status, res.statusText)
        return
      }
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setBrands(data as Brand[])
        const store = useAgencyStore.getState()
        if (!store.activeBrandId) {
          setBrand((data[0] as Brand).id)
        }
      } else {
        console.warn('[sidebar] No brands returned from API')
      }
    } catch (err) {
      console.error('[sidebar] Brand fetch error:', err)
    }
  }

  // Fetch brands on mount
  useEffect(() => {
    fetchBrands()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch recent conversations when brand changes
  useEffect(() => {
    if (!activeBrandId) return
    const params = new URLSearchParams({ brandId: activeBrandId })
    fetch(`/api/conversations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setConversations((data as Conversation[]).slice(0, 30))
        }
      })
  }, [activeBrandId])

  const handleNewChat = () => {
    setConversation(null)
    setAgent('overall')
    // Force a full page transition even if already on /agency/chat
    window.location.href = '/agency/chat'
    onClose?.()
  }

  const handleSelectConversation = (conv: Conversation) => {
    selectConversation(conv.id, conv.agent_type)
    router.push(`/agency/chat/${conv.id}`)
    onClose?.()
  }

  const handleSelectBrand = (brandId: string) => {
    setBrand(brandId)
    setConversation(null)
    router.push('/agency/chat')
    onClose?.()
  }

  const handleSelectAgent = (agent: AgentType) => {
    setAgent(agent)
    router.push('/agency/chat')
    onClose?.()
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-card overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
        <Image
          src="/Favicon.png"
          alt="NRS Agency"
          width={28}
          height={28}
          className="rounded"
        />
        <span className="text-base font-bold tracking-tight">
          NRS
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            Agency
          </span>
        </span>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* New Chat */}
        <div className="px-3 py-3">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* ── Your Brands ───────────────────────────────────────────────────── */}
        <section className="px-3 pb-2">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Brands
          </p>
          {brands.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No brands yet
            </p>
          ) : (
            <ul className="space-y-0.5">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <button
                    onClick={() => handleSelectBrand(brand.id)}
                    className={cn(
                      'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      brand.id === activeBrandId
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt=""
                        className="h-5 w-5 rounded shrink-0 object-cover mr-2"
                      />
                    ) : (
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold shrink-0 mr-2"
                        style={{ background: 'oklch(0.25 0.01 240)', color: 'oklch(0.7 0.01 240)' }}
                      >
                        {brand.name.charAt(0)}
                      </span>
                    )}
                    <span className="truncate">{brand.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setShowAddBrand(true)}
            className="mt-1.5 flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            Add Brand
          </button>
          {showAddBrand && (
            <AddBrandDialog onClose={() => { setShowAddBrand(false); fetchBrands() }} />
          )}
        </section>

        <div className="mx-3 my-1 h-px bg-border" />

        {/* ── Recent Chats (grouped by date) ──────────────────────────────── */}
        <section className="px-3 py-2">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Chats
          </p>
          {conversations.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {activeBrandId ? 'No conversations yet' : 'Select a brand to see chats'}
            </p>
          ) : (
            <div className="space-y-2">
              {groupConversationsByDate(conversations).map(({ label, items }) => (
                <div key={label}>
                  <p className="px-1 mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    {label}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((conv) => {
                      const badgeClass =
                        AGENT_BADGE_CLASSES[conv.agent_type] ??
                        'bg-muted text-muted-foreground'
                      const title = conv.title ?? 'Untitled'
                      const truncated =
                        title.length > 40 ? title.slice(0, 40) + '…' : title

                      return (
                        <li key={conv.id}>
                          <button
                            onClick={() => handleSelectConversation(conv)}
                            className={cn(
                              'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors',
                              activeConversationId === conv.id
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-muted'
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate text-sm">{truncated}</span>
                            </div>
                            <span
                              className={cn(
                                'ml-4.5 rounded-full px-1.5 py-0 text-[10px] font-medium w-fit',
                                badgeClass
                              )}
                            >
                              {AGENT_LABELS[conv.agent_type]}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mx-3 my-1 h-px bg-border" />

        {/* ── Talk to a Team ────────────────────────────────────────────────── */}
        <section className="px-3 py-2">
          <button
            onClick={() => setTeamExpanded((v) => !v)}
            className="mb-1.5 flex w-full items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>Talk to a Team</span>
            {teamExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {teamExpanded && (
            <ul className="space-y-0.5">
              {ACTIVE_AGENT_TYPES.map((agent, index) => {
                const Icon = AGENT_ICONS[agent]
                const isOverall = agent === 'overall'
                const isActive = activeAgentType === agent

                return (
                  <li key={agent}>
                    <button
                      onClick={() => handleSelectAgent(agent)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <span className="truncate">{AGENT_LABELS[agent]}</span>
                    </button>
                    {/* Separator after Account Manager */}
                    {isOverall && index < ACTIVE_AGENT_TYPES.length - 1 && (
                      <div className="mx-2 my-1 h-px bg-border" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ── Management ──────────────────────────────────────────────────── */}
        <section className="border-t border-border px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2">
            Management
          </p>
          <nav className="space-y-0.5">
            {[
              { href: '/agency/outputs', icon: FileText, label: 'Outputs' },
              { href: '/agency/tasks', icon: ListTodo, label: 'Tasks' },
              { href: '/agency/agents', icon: Users, label: 'Agents' },
              { href: '/agency/approvals', icon: ShieldCheck, label: 'Approvals' },
              { href: '/agency/costs', icon: DollarSign, label: 'Costs' },
              { href: '/agency/activity', icon: Activity, label: 'Activity' },
              { href: '/agency/settings', icon: Settings, label: 'Settings' },
            ].map(({ href, icon: NavIcon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <NavIcon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </aside>
  )
}
