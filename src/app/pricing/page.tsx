import Link from 'next/link'
import Image from 'next/image'
import { LandingNav } from '@/components/landing/LandingNav'
import { AgencyFooter } from '@/components/landing/AgencyFooter'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Pricing | NotRealSmart Agency',
  description:
    'Your own marketing agency for a fraction of the cost. 14 AI specialists, AHPRA compliance, social publishing, video generation. Australian-built.',
}

const FEATURES = [
  { label: '14 AI specialist agents with unique expertise' },
  { label: '65+ slash commands for instant actions' },
  { label: 'Content calendar with auto-scheduling + Google Calendar / Apple Calendar sync' },
  { label: 'Social publishing across Instagram, Facebook, LinkedIn, YouTube, TikTok, X' },
  { label: 'Video scripts, storyboards and production briefs' },
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
  { label: 'Content gap analysis — know what you are missing' },
  { label: 'Post notifications — get emailed when content goes live' },
  { label: 'Shorts vs full-length video classification' },
  { label: 'Drag and drop video upload with auto-transcription' },
  { label: 'Connect via Claude Desktop, Mobile, or Cowork — use your agency from any AI' },
  { label: 'API keys for Claude Code and terminal access' },
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
              {'// pricing'}
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
              Your Own Marketing Agency
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'oklch(0.5 0 0)',
                maxWidth: '620px',
                margin: '0 auto',
              }}
            >
              Work on your business, not in your marketing. Everything a
              $5,000/month agency does — without the retainer, the reports,
              or the excuses.
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

          {/* Agency comparison */}
          <div
            style={{
              maxWidth: '560px',
              margin: '0 auto 2.5rem',
              padding: '1.75rem 2rem',
              background: 'oklch(0.1 0.005 240)',
              border: '1px solid oklch(0.2 0.01 240)',
              borderRadius: '10px',
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'oklch(0.75 0.15 75)',
                marginBottom: '1.25rem',
              }}
            >
              {'// the comparison'}
            </p>
            {[
              { label: 'Social media manager', cost: '$3,000 – 5,000/month' },
              { label: 'Marketing agency', cost: '$5,000 – 10,000/month' },
              { label: 'Freelancer', cost: '$1,000 – 2,000/month (when they show up)' },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid oklch(0.15 0.005 240)',
                }}
              >
                <span style={{ fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace", fontSize: '0.8rem', color: 'oklch(0.5 0 0)' }}>
                  {row.label}
                </span>
                <span style={{ fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace", fontSize: '0.8rem', color: 'oklch(0.65 0 0)' }}>
                  {row.cost}
                </span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '0.75rem 0 0',
              }}
            >
              <span style={{ fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif", fontSize: '0.9rem', fontWeight: 600, color: 'oklch(0.9 0.005 240)' }}>
                NotRealSmart
              </span>
              <span style={{ fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif", fontSize: '0.9rem', fontWeight: 600, color: 'oklch(0.68 0.2 145)' }}>
                A fraction of the above
              </span>
            </div>
          </div>

          {/* Trust line */}
          <p
            style={{
              fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
              fontSize: '0.82rem',
              lineHeight: 1.6,
              color: 'oklch(0.45 0 0)',
              textAlign: 'center',
              maxWidth: '560px',
              margin: '0 auto 2.5rem',
            }}
          >
            Australian-built. Not outsourced. Built by business owners running 10 brands.
            AHPRA/TGA compliant. Every plan includes tomorrow&apos;s features as they ship.
          </p>

          {/* CTA */}
          <div style={{ textAlign: 'center' }}>
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
