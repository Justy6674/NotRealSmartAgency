import { LandingNav } from '@/components/landing/LandingNav'
import { SpaceHeroLoader } from '@/components/about/SpaceHeroLoader'
import { TerminalFaq } from '@/components/faq/TerminalFaq'
import { AgencyFooter } from '@/components/landing/AgencyFooter'

export const metadata = {
  title: 'About | NotRealSmart Agency',
  description:
    'Built by Australian business owners running 10 brands. Not Real = Artificial, Smart = Intelligence. Your own AI marketing agency with AHPRA/TGA compliance.',
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
          {/* The Story */}
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
              marginBottom: '0.75rem',
              textShadow: '0 0 18px oklch(0.6 0.01 240 / 0.35)',
            }}
          >
            Not Real. Smart.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: 'oklch(0.55 0.1 240)',
              textAlign: 'center',
              marginBottom: '2.5rem',
            }}
          >
            Not Real = Artificial. Smart = Intelligence. AI — said differently.
          </p>

          {/* Narrative paragraphs */}
          <div style={{ maxWidth: '720px', margin: '0 auto 3rem' }}>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1.05rem',
                lineHeight: 1.8,
                color: 'oklch(0.65 0 0)',
                marginBottom: '1.5rem',
              }}
            >
              We didn&apos;t set out to build an AI company. We run 10 Australian
              businesses — health clinics, telehealth, skincare, fragrance. We needed
              marketing done properly. What we found was a $5,000/month agency sending
              PDF reports, a freelancer who disappeared after month three, and an intern
              who nearly got us fined by AHPRA.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1.05rem',
                lineHeight: 1.8,
                color: 'oklch(0.65 0 0)',
                marginBottom: '1.5rem',
              }}
            >
              So we built our own marketing agency. One that actually does the work.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1.05rem',
                lineHeight: 1.8,
                color: 'oklch(0.65 0 0)',
                marginBottom: '1.5rem',
              }}
            >
              Not a dashboard. Not a scheduling tool. Not another app selling you
              integrations dressed up as innovation. An actual agency — 14 AI specialists
              that write your content, design your graphics, schedule your posts, monitor
              your competitors, and keep you compliant. You just talk to the Director.
              Like you would a real agency. Except this one doesn&apos;t ghost you.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1.05rem',
                lineHeight: 1.8,
                color: 'oklch(0.65 0 0)',
                marginBottom: '1.5rem',
              }}
            >
              We built it for healthcare first because that&apos;s the hardest. AHPRA
              compliance. TGA advertising rules. A $60,000 fine for getting an Instagram
              post wrong. If it handles that, it handles anything.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1.05rem',
                lineHeight: 1.8,
                color: 'oklch(0.65 0 0)',
                marginBottom: '1.5rem',
              }}
            >
              This is Australian. Not outsourced. We use it every day across our own
              brands. We stake our businesses on it.
            </p>
          </div>

          {/* The tech promise */}
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto 3rem',
              padding: '1.75rem 2rem',
              background: 'oklch(0.1 0.005 240)',
              border: '1px solid oklch(0.2 0.01 240)',
              borderRadius: '10px',
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1rem',
                fontWeight: 600,
                color: 'oklch(0.85 0.01 240)',
                marginBottom: '0.75rem',
              }}
            >
              The tech behind it changes. The promise doesn&apos;t.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '0.92rem',
                lineHeight: 1.7,
                color: 'oklch(0.55 0 0)',
                marginBottom: '0.75rem',
              }}
            >
              Today it uses the best AI available. Tomorrow it&apos;ll use better. The
              apps you install now will be gone in two years — AI will live in your phone,
              your laptop, your watch, and it&apos;ll just do things. We&apos;re building
              for that. Always moving forward. Always ready for what&apos;s next.
            </p>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '0.92rem',
                lineHeight: 1.7,
                color: 'oklch(0.55 0 0)',
              }}
            >
              You don&apos;t need to understand any of it. You just need to talk to your agency.
            </p>
          </div>

          {/* Section break — what it does */}
          <p
            style={{
              fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
              fontSize: '0.7rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'oklch(0.75 0.15 75)',
              textAlign: 'center',
              marginBottom: '2.5rem',
            }}
          >
            // what your agency does
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
                  'Facebook publishing',
                  'Instagram publishing',
                  'LinkedIn publishing',
                  'TikTok publishing',
                  'YouTube publishing',
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

          {/* Card 4 — Connect */}
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto 3rem',
              padding: '1.75rem 2rem',
              background: 'oklch(0.1 0.005 240)',
              border: '1px solid oklch(0.2 0.01 240)',
              borderRadius: '10px',
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
              // connect from anywhere
            </h3>
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '0.92rem',
                lineHeight: 1.7,
                color: 'oklch(0.55 0 0)',
                marginBottom: '1rem',
              }}
            >
              Your agency lives wherever your AI lives. Use the web app, or connect
              from Claude Desktop, Claude Mobile, VS Code (Cowork), or Claude Code.
              One click to connect — your 14 agents appear as native tools in any
              Claude conversation.
            </p>
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
                'Web app — notrealsmart.com.au',
                'Claude Desktop & Mobile — one-click connector',
                'VS Code (Cowork) — agency tools while you code',
                'Claude Code — terminal access for power users',
                'Any MCP-compatible AI client',
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
            Work on your business. Not in your marketing.
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
