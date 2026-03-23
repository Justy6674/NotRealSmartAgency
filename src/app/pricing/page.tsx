import { LandingNav } from '@/components/landing/LandingNav'
import { ComingSoon } from '@/components/landing/ComingSoon'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export default function PricingPage() {
  return (
    <>
      <LandingNav />
      <ComingSoon
        title="Pricing"
        description="Plans and pricing for NotRealSmart Agency. From solo to enterprise."
      />
      <AgencyFooter />
    </>
  )
}
