'use client'

import dynamic from 'next/dynamic'

const WaterRippleHero = dynamic(
  () => import('./WaterRippleHero').then((m) => m.WaterRippleHero),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-svh items-center justify-center"
        style={{ background: 'oklch(0.08 0 0)' }}
      />
    ),
  }
)

export function WaterRippleHeroLoader() {
  return <WaterRippleHero />
}
