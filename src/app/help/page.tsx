import { LandingNav } from '@/components/landing/LandingNav'
import { AgencyFooter } from '@/components/landing/AgencyFooter'
import { HelpHero } from '@/components/help/HelpHero'
import { HelpCategoryGrid } from '@/components/help/HelpCategoryGrid'
import { buildSearchIndex } from '@/lib/help'

export const metadata = {
  title: 'Help Centre | NotRealSmart Agency',
  description:
    'Learn how to use your AI marketing agency. Guides for creating content, publishing, video, compliance, team management, and more.',
}

export default function HelpPage() {
  const searchIndex = buildSearchIndex()

  return (
    <>
      <LandingNav />

      <main
        style={{
          position: 'relative',
          minHeight: '100vh',
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

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 1.5rem 5rem',
          }}
        >
          <HelpHero searchIndex={searchIndex} />
          <HelpCategoryGrid />
        </div>
      </main>

      <AgencyFooter />
    </>
  )
}
