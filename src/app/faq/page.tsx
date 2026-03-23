export const dynamic = 'force-dynamic'

import { LandingNav } from '@/components/landing/LandingNav'
import { RacingTrackLoader } from '@/components/faq/RacingTrackLoader'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export default function FaqPage() {
  return (
    <>
      <LandingNav />
      <RacingTrackLoader />
      {/* Scroll spacer — the 3D canvas is fixed, this div gives scroll room */}
      <div style={{ minHeight: '400vh' }} />
      <AgencyFooter />
    </>
  )
}
