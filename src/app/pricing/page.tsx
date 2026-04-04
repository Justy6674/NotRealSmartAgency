import Link from 'next/link'
import Image from 'next/image'
import { LandingNav } from '@/components/landing/LandingNav'
import { AgencyFooter } from '@/components/landing/AgencyFooter'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Pricing | NotRealSmart Agency',
  description:
    'Everything a real marketing agency does. No staff. 14 AI specialist agents, 65+ slash commands, social publishing, video generation, and AHPRA compliance.',
}

const FEATURES = [
  { label: '14 AI specialist agents with unique expertise' },
  { label: '65+ slash commands for instant actions' },
  { label: 'Content calendar with auto-scheduling' },
  { label: 'Social publishing to 6 platforms via Mixpost' },
  { label: 'HeyGen AI video generation' },
  { label: 'Canva graphic design' },
  { label: 'AHPRA/TGA compliance checking' },
  { label: 'Brand DNA voice enforcement' },
  { label: 'Inspiration Library (cross-industry marketing intelligence)' },
  { label: 'Marketing DNA (visual channel strategy)' },
  { label: 'Team invitations with role-based access' },
  { label: 'Chat with screenshots and images' },
  { label: 'Web search and competitor intelligence' },
  { label: 'Email campaigns (Spam Act compliant)' },
  { label: 'Blog writing (SEO optimised)' },
  { label: 'Multi-brand support (unlimited brands)' },
]

export default function PricingPage() {
  return (
    <>
      <LandingNav />
      <main
        style={{
          background: 'oklch(0.06 0 0)',
          minHeight: '100dvh',
          paddingTop: '7rem',
          paddingBottom: '5rem',
          position: 'relative',
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
            maxWidth: '960px',
            margin: '0 auto',
            padding: '0 1.5rem',
          }}
        >
          {/* Logo + heading */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <Image
              src="/Favicon.png"
              alt="NRS"
              width={48}
              height={48}
              style={{ margin: '0 auto 1.5rem', borderRadius: '6px' }}
            />
            <p
              style={{
                fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'oklch(0.75 0.15 75)',
                marginBottom: '0.75rem',
              }}
            >
              // pricing
            </p>
            <h1
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 600,
                color: 'oklch(0.9 0.005 240)',
                marginBottom: '1rem',
                textShadow: '0 0 18px oklch(0.6 0.01 240 / 0.35)',
              }}
            >
              Everything a Real Agency Does. No Staff.
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'oklch(0.5 0 0)',
                maxWidth: '560px',
                margin: '0 auto',
              }}
            >
              Plans and pricing are being finalised. Here is everything that is
              included when you sign up.
            </p>
          </div>

          {/* Feature grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '0.5rem 2rem',
              marginBottom: '3.5rem',
              background: 'oklch(0.1 0.005 240)',
              border: '1px solid oklch(0.2 0.01 240)',
              borderRadius: '10px',
              padding: '2rem 2rem',
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.65rem',
                  padding: '0.55rem 0',
                  borderBottom: '1px solid oklch(0.15 0.005 240)',
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                    fontSize: '0.75rem',
                    color: 'oklch(0.68 0.2 145)',
                    flexShrink: 0,
                  }}
                >
                  +
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    color: 'oklch(0.7 0 0)',
                  }}
                >
                  {f.label}
                </span>
              </div>
            ))}
          </div>

          {/* Coming soon badge + CTA */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-block',
                background: 'oklch(0.15 0.01 240)',
                color: 'oklch(0.6 0.01 240)',
                borderRadius: '9999px',
                padding: '0.35rem 1.25rem',
                fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '1.5rem',
              }}
            >
              Pricing coming soon
            </div>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '0.95rem',
                color: 'oklch(0.5 0 0)',
                marginBottom: '1.5rem',
              }}
            >
              Start with a free trial. No credit card required.
            </p>
            <Link
              href="/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'oklch(0.9 0.005 240)',
                color: 'oklch(0.08 0 0)',
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: '0.7rem 1.75rem',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'background 0.15s ease',
              }}
            >
              Get Started
              <ArrowRight style={{ width: '16px', height: '16px' }} />
            </Link>
          </div>
        </div>
      </main>
      <AgencyFooter />
    </>
  )
}
