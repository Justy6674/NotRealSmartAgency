import { LandingNav } from '@/components/landing/LandingNav'
import { SpaceHeroLoader } from '@/components/about/SpaceHeroLoader'
import { TerminalFaq } from '@/components/faq/TerminalFaq'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export const metadata = {
  title: 'About | NotRealSmart Agency',
  description:
    'Meet the AI-powered marketing agency built for Australian health businesses. 14 AI specialist agents run your marketing. Learn how it works.',
}

export default function AboutPage() {
  return (
    <>
      <LandingNav />
      <SpaceHeroLoader />

      {/* ------------------------------------------------------------------ */}
      {/* Your AI Marketing Team — between hero and FAQ                       */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          position: 'relative',
          background: 'oklch(0.06 0 0)',
          paddingTop: '5rem',
          paddingBottom: '5rem',
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
            padding: '0 1.5rem',
          }}
        >
          {/* Heading */}
          <p
            style={{
              fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'oklch(0.75 0.15 75)',
              textAlign: 'center',
              marginBottom: '0.75rem',
            }}
          >
            // the agency
          </p>
          <h2
            style={{
              fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
              fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
              fontWeight: 600,
              color: 'oklch(0.9 0.005 240)',
              textAlign: 'center',
              marginBottom: '1.25rem',
              textShadow: '0 0 18px oklch(0.6 0.01 240 / 0.35)',
            }}
          >
            Your AI Marketing Team
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: 'oklch(0.6 0 0)',
              textAlign: 'center',
              maxWidth: '780px',
              margin: '0 auto 3.5rem',
            }}
          >
            14 independent AI specialists that run your marketing. You talk to
            one person — the Director. Behind the scenes, a team of specialists
            writes your content, designs your graphics, shoots your videos, fills
            your calendar, publishes to all platforms, and keeps you compliant.
          </p>

          {/* Three columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginBottom: '3rem',
            }}
          >
            {/* Card 1 — Create */}
            <div
              style={{
                background: 'oklch(0.1 0.005 240)',
                border: '1px solid oklch(0.2 0.01 240)',
                borderRadius: '10px',
                padding: '2rem 1.75rem',
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.75 0.15 75)',
                  marginBottom: '1rem',
                }}
              >
                // create
              </h3>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {[
                  'Content & copy writing',
                  'SEO-optimised blog posts',
                  'Paid ad copy (Google, Meta, LinkedIn)',
                  'Email campaigns (Spam Act compliant)',
                  'Video scripting (Reels, TikTok, YouTube)',
                  'Graphic design via Canva',
                  'AI video generation via HeyGen',
                  'Web search and competitor research',
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                      fontSize: '0.8rem',
                      lineHeight: 1.6,
                      color: 'oklch(0.65 0 0)',
                      paddingLeft: '1rem',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        color: 'oklch(0.4 0.01 240)',
                      }}
                    >
                      -
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 — Publish */}
            <div
              style={{
                background: 'oklch(0.1 0.005 240)',
                border: '1px solid oklch(0.2 0.01 240)',
                borderRadius: '10px',
                padding: '2rem 1.75rem',
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.75 0.15 75)',
                  marginBottom: '1rem',
                }}
              >
                // publish
              </h3>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {[
                  'Content calendar with auto-scheduling',
                  'Facebook publishing via Mixpost',
                  'Instagram publishing via Mixpost',
                  'LinkedIn publishing via Mixpost',
                  'TikTok publishing via Mixpost',
                  'YouTube publishing via Mixpost',
                  'Post signatures and branding',
                  'Platform algorithm intelligence',
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                      fontSize: '0.8rem',
                      lineHeight: 1.6,
                      color: 'oklch(0.65 0 0)',
                      paddingLeft: '1rem',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        color: 'oklch(0.4 0.01 240)',
                      }}
                    >
                      -
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 3 — Protect */}
            <div
              style={{
                background: 'oklch(0.1 0.005 240)',
                border: '1px solid oklch(0.2 0.01 240)',
                borderRadius: '10px',
                padding: '2rem 1.75rem',
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.75 0.15 75)',
                  marginBottom: '1rem',
                }}
              >
                // protect
              </h3>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {[
                  'AHPRA advertising compliance',
                  'TGA therapeutic claims checking',
                  'Guardian Agent validation on every output',
                  'Brand DNA voice enforcement',
                  'Banned words and constraint rules',
                  'Reddit AHPRA awareness (public scrutiny)',
                  'Audit trail for all content decisions',
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
                      fontSize: '0.8rem',
                      lineHeight: 1.6,
                      color: 'oklch(0.65 0 0)',
                      paddingLeft: '1rem',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        color: 'oklch(0.4 0.01 240)',
                      }}
                    >
                      -
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom tagline */}
          <p
            style={{
              fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
              fontSize: '0.95rem',
              lineHeight: 1.7,
              color: 'oklch(0.5 0 0)',
              textAlign: 'center',
              maxWidth: '640px',
              margin: '0 auto',
            }}
          >
            Built for Australian business owners who can&apos;t afford a
            $5,000/month agency. AHPRA and TGA compliant for health
            practitioners.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ Terminal                                                         */}
      {/* ------------------------------------------------------------------ */}
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
