import Image from 'next/image'
import { AgentSidebar } from '@/components/agency/AgentSidebar'
import { BrandSelector } from '@/components/agency/BrandSelector'
import { ConversationList } from '@/components/agency/ConversationList'

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar with brand selector */}
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Image
          src="/Favicon.png"
          alt="NotRealSmart"
          width={32}
          height={32}
          className="rounded"
        />
        <span className="text-lg font-bold tracking-tight">
          NRS<span className="text-muted-foreground font-normal text-sm ml-1.5">Agency</span>
        </span>
        <div className="mx-2 h-6 w-px bg-border" />
        <BrandSelector />
      </div>

      {/* Main area: sidebar + conversations + chat */}
      <div className="flex flex-1 overflow-hidden">
        <AgentSidebar />
        <ConversationList />
        <div className="flex flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
