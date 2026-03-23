export const dynamic = 'force-dynamic'

import { WaterRippleHeroLoader } from '@/components/landing/WaterRippleHeroLoader'
import { AgentShowcase } from '@/components/landing/AgentShowcase'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export default function HomePage() {
  return (
    <main>
      <WaterRippleHeroLoader />
      <AgentShowcase />
      <HowItWorks />
      <AgencyFooter />
    </main>
  )
}
