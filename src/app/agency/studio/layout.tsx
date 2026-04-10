import { StudioSidebar } from '@/components/agency/studio/StudioSidebar'

/**
 * Studio layout — wraps every /agency/studio/* route with the Mixpost-style
 * left sidebar navigation. The sidebar is always visible, providing the
 * Content / Insights / Configuration nav structure that matches Mixpost Pro.
 *
 * The parent layout at /agency/layout.tsx provides the brand sidebar (left)
 * + Director chat panel (right). This nested layout adds the Studio-specific
 * sidebar BETWEEN the brand sidebar and the page content area.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full overflow-hidden">
      <StudioSidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
