import { Suspense } from 'react'

/**
 * Social department owns its own scrolling. Compose is a full-height
 * PostCreator that must not be clipped by a parent scroller; list screens
 * scroll inside themselves.
 */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<div className="min-h-0 flex-1" />}>{children}</Suspense>
    </div>
  )
}
