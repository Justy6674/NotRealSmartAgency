'use client'

import dynamic from 'next/dynamic'

const SpaceHero = dynamic(
  () => import('./SpaceHero').then((m) => m.SpaceHero),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex min-h-[85vh] items-center justify-center"
        style={{ background: 'oklch(0.04 0 0)' }}
      />
    ),
  }
)

export function SpaceHeroLoader() {
  return <SpaceHero />
}
