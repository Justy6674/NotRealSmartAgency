'use client'

import dynamic from 'next/dynamic'

const RacingTrackScene = dynamic(
  () => import('./RacingTrackScene').then((m) => m.RacingTrackScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-svh items-center justify-center" style={{ background: 'oklch(0.04 0 0)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'oklch(0.4 0.01 240)', borderTopColor: 'transparent' }} />
      </div>
    ),
  }
)

export function RacingTrackLoader() {
  return <RacingTrackScene />
}
