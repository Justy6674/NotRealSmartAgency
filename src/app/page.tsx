export const dynamic = 'force-dynamic'

import { LandingNav } from '@/components/landing/LandingNav'
import { WaterRippleHeroLoader } from '@/components/landing/WaterRippleHeroLoader'

export default function HomePage() {
  return (
    <main>
      <LandingNav />
      <WaterRippleHeroLoader />
    </main>
  )
}
