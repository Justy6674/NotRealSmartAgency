'use client'

import dynamic from 'next/dynamic'

const IndustrialDeskScene = dynamic(
  () => import('./IndustrialDeskScene').then((m) => m.IndustrialDeskScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-svh items-center justify-center" style={{ background: 'oklch(0.06 0 0)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'oklch(0.4 0.01 240)', borderTopColor: 'transparent' }} />
      </div>
    ),
  }
)

export function IndustrialDeskLoader() {
  return <IndustrialDeskScene />
}
