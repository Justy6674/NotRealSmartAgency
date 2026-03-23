export const dynamic = 'force-dynamic'

import { LandingNav } from '@/components/landing/LandingNav'
import { IndustrialDeskLoader } from '@/components/about/IndustrialDeskLoader'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export default function AboutPage() {
  return (
    <>
      <LandingNav />
      <IndustrialDeskLoader />
      <AgencyFooter />
    </>
  )
}
