import { LandingNav } from '@/components/landing/LandingNav'
import { SpaceHeroLoader } from '@/components/about/SpaceHeroLoader'
import { TerminalFaq } from '@/components/faq/TerminalFaq'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export const metadata = {
  title: 'About | NotRealSmart Agency',
  description:
    'Meet the AI-powered marketing agency built for Australian health businesses. Learn how it works and get answers to common questions.',
}

export default function AboutPage() {
  return (
    <>
      <LandingNav />
      <SpaceHeroLoader />
      <div
        id="faq"
        style={{
          position: 'relative',
          background: 'oklch(0.06 0 0)',
        }}
      >
        {/* Metallic brushed texture overlay */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `repeating-linear-gradient(
              90deg,
              oklch(0.5 0 0 / 0.02) 0px,
              transparent 1px,
              transparent 3px,
              oklch(0.5 0 0 / 0.015) 4px,
              transparent 5px,
              transparent 8px
            )`,
            zIndex: 1,
          }}
        />
        {/* Override TerminalFaq min-height when embedded */}
        <style>{`.nrs-faq-page { min-height: auto !important; }`}</style>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <TerminalFaq />
        </div>
      </div>
      <AgencyFooter />
    </>
  )
}
