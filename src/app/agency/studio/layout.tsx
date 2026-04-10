import { StudioSidebar } from '@/components/agency/studio/StudioSidebar'
import { StudioChatCloser } from '@/components/agency/studio/StudioChatCloser'

/**
 * Studio layout — wraps every /agency/studio/* route with the Mixpost-style
 * left sidebar navigation. The sidebar is always visible, providing the
 * Content / Insights / Configuration nav structure that matches Mixpost Pro.
 *
 * The parent layout at /agency/layout.tsx provides the brand sidebar (left)
 * + Director chat panel (right). This nested layout adds the Studio-specific
 * sidebar BETWEEN the brand sidebar and the page content area.
 *
 * The StudioChatCloser component closes the Director chat panel on mount
 * so it doesn't overlap Studio content. Users can reopen it manually.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full overflow-hidden">
      <StudioChatCloser />
      <StudioSidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
