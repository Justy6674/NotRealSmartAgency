export const dynamic = 'force-dynamic'

import { LandingNav } from '@/components/landing/LandingNav'
import { WaterRippleHeroLoader } from '@/components/landing/WaterRippleHeroLoader'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export default function HomePage() {
  return (
    <main>
      <LandingNav />
      <WaterRippleHeroLoader />
      <AgencyFooter />
    </main>
  )
}
