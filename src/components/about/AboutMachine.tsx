'use client'

import { useRef, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  PenLine,
  Search,
  Megaphone,
  Target,
  Mail,
  TrendingUp,
  Palette,
  Eye,
  Globe,
  ShieldCheck,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STEPS = [
  {
    num: '01',
    title: 'Create Your Brand Profile',
    desc: 'Set your brand name, tone of voice, target audience, and compliance flags. The agency remembers everything.',
  },
  {
    num: '02',
    title: 'Pick a Department',
    desc: '10 specialist agents: Content, SEO, Paid Ads, Strategy, Email, Growth, Brand, Competitor Intel, Website, and Compliance.',
  },
  {
    num: '03',
    title: 'Brief Your Agent',
    desc: 'Describe what you need in plain English. The agent already has your brand context, past outputs, and industry knowledge.',
  },
  {
    num: '04',
    title: 'Review & Publish',
    desc: 'Get finished, compliance-checked output. Copy it, save it to your library, or iterate until it\'s perfect.',
  },
]

const DEPARTMENTS = [
  { name: 'Content & Copy', Icon: PenLine, desc: 'Social posts, blogs, landing pages — publish-ready' },
  { name: 'SEO', Icon: Search, desc: 'Keywords, topic clusters, on-page optimisation' },
  { name: 'Paid Ads', Icon: Megaphone, desc: 'Meta, Google, LinkedIn, TikTok ad sets' },
  { name: 'Strategy & Launch', Icon: Target, desc: 'Campaign plans, GTM, launch playbooks' },
  { name: 'Email Marketing', Icon: Mail, desc: 'Sequences, EDMs, newsletters — subject to send' },
  { name: 'Growth', Icon: TrendingUp, desc: 'Referral programs, PR pitches, partnerships' },
  { name: 'Brand', Icon: Palette, desc: 'Voice guides, pillars, competitor analysis' },
  { name: 'Competitor Intel', Icon: Eye, desc: 'Messaging gaps, pricing analysis, SWOT' },
  { name: 'Website', Icon: Globe, desc: 'Page copy, UX suggestions, conversion optimisation' },
  { name: 'Compliance', Icon: ShieldCheck, desc: 'AHPRA/TGA advertising checks and rewrites' },
]

const BUILT_FOR = [
  'AHPRA-aware compliance checking on every output',
  'TGA advertising guidelines built into every agent',
  '8 brands managed from a single dashboard',
  'Telehealth, GP, NP, allied health, dental, mental health, weight loss, aesthetics',
]

// ---------------------------------------------------------------------------
// Colour tokens (inline styles — avoids Tailwind oklch purge issues)
// ---------------------------------------------------------------------------

const C = {
  bg:          'oklch(0.06 0 0)',
  bgCard:      'oklch(0.12 0 0)',
  bgAlt:       'oklch(0.09 0 0)',
  border:      'oklch(0.2 0 0)',
  borderHover: 'oklch(0.55 0.12 55)',
  accent:      'oklch(0.6 0.01 240)',
  accentHover: 'oklch(0.65 0.01 240)',
  gold:        'oklch(0.75 0.15 75)',
  goldDim:     'oklch(0.55 0.12 55)',
  text:        'oklch(0.92 0 0)',
  textSub:     'oklch(0.65 0 0)',
  textMuted:   'oklch(0.5 0 0)',
  line:        'oklch(0.55 0.12 55)',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AboutMachine() {
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef  = useRef<SVGLineElement>(null)

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      // ------------------------------------------------------------------
      // Section 1 — Timeline line draw
      // ------------------------------------------------------------------
      const path = timelineRef.current
      if (path) {
        const length = path.getTotalLength()
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })

        gsap.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: '#machine-timeline',
            start: 'top 75%',
            end: 'bottom 60%',
            scrub: 1,
          },
        })
      }

      // Step cards: each one triggers individually
      gsap.utils.toArray<HTMLElement>('.step-card').forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 82%',
            },
          }
        )

        // Node circle pops in just before the card
        const node = card.querySelector('.step-node')
        if (node) {
          gsap.fromTo(
            node,
            { scale: 0, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.4,
              ease: 'back.out(2)',
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
              },
            }
          )
        }
      })

      // ------------------------------------------------------------------
      // Section 2 — Department cards stagger
      // ------------------------------------------------------------------
      gsap.fromTo(
        '.dept-card',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.08,
          scrollTrigger: {
            trigger: '#machine-departments',
            start: 'top 80%',
          },
        }
      )

      // ------------------------------------------------------------------
      // Section 3 — Built-for items fade + scale
      // ------------------------------------------------------------------
      gsap.fromTo(
        '.built-item',
        { opacity: 0, scale: 0.95, y: 20 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: '#machine-built',
            start: 'top 80%',
          },
        }
      )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <main
      ref={containerRef}
      style={{ background: C.bg }}
      className="min-h-screen"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Hero label                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="pt-32 pb-16 px-6 text-center">
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: C.accent }}
        >
          Inside the agency
        </p>
        <h1
          className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl"
          style={{ color: C.text }}
        >
          How The Machine Works
        </h1>
        <p
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed md:text-lg"
          style={{ color: C.textSub }}
        >
          A structured process that turns a plain-English brief into finished,
          compliance-checked marketing output — every time.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Vertical Timeline                                       */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="machine-timeline"
        className="relative px-6 pb-32"
        style={{ background: C.bg }}
      >
        <div className="relative mx-auto max-w-4xl">

          {/* SVG vertical connecting line — desktop only */}
          {/* Sits in absolute centre column, full height of the steps block */}
          <div
            className="pointer-events-none absolute inset-0 hidden md:block"
            aria-hidden="true"
          >
            {/* SVG fills the full column height; line runs top-to-bottom */}
            <svg
              className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
              width="2"
              height="100%"
              style={{ overflow: 'visible' }}
              preserveAspectRatio="none"
            >
              <line
                ref={timelineRef}
                x1="1"
                y1="0"
                x2="1"
                y2="100%"
                stroke={C.line}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Step cards */}
          <div className="flex flex-col gap-20 md:gap-28">
            {STEPS.map(({ num, title, desc }, idx) => {
              const isLeft = idx % 2 === 0
              return (
                <div
                  key={num}
                  className={`step-card relative flex flex-col items-center gap-6 md:flex-row md:gap-0 ${
                    isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Content card — takes up ~45% on each side */}
                  <div
                    className={`w-full rounded-xl border p-6 md:w-[45%] ${
                      isLeft ? 'md:mr-auto' : 'md:ml-auto'
                    }`}
                    style={{
                      background: C.bgCard,
                      borderColor: C.border,
                    }}
                  >
                    <p
                      className="mb-1 font-mono text-xs uppercase tracking-[0.15em]"
                      style={{ color: C.goldDim }}
                    >
                      Step {num}
                    </p>
                    <h3
                      className="text-lg font-semibold leading-snug md:text-xl"
                      style={{ color: C.text }}
                    >
                      {title}
                    </h3>
                    <p
                      className="mt-2 text-sm leading-relaxed"
                      style={{ color: C.textMuted }}
                    >
                      {desc}
                    </p>
                  </div>

                  {/* Node circle — centred on the line (desktop), above card (mobile) */}
                  <div
                    className={`
                      step-node
                      flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2
                      font-mono text-base font-bold
                      order-first md:order-none
                      md:absolute md:left-1/2 md:-translate-x-1/2
                    `}
                    style={{
                      background: C.bg,
                      borderColor: C.goldDim,
                      color: C.gold,
                      boxShadow: `0 0 20px oklch(0.55 0.12 55 / 0.35)`,
                    }}
                  >
                    {num}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Divider                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-6">
        <hr
          className="mx-auto max-w-4xl"
          style={{ borderColor: 'oklch(0.15 0 0)' }}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — 10 Departments                                          */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="machine-departments"
        className="px-6 py-28"
        style={{ background: C.bgAlt }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: C.accent }}
          >
            The specialists
          </p>
          <h2
            className="text-center text-3xl font-bold tracking-tight md:text-4xl"
            style={{ color: C.text }}
          >
            10 Departments
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-center text-base"
            style={{ color: C.textSub }}
          >
            Each agent is a specialist. Pick one, brief it, get finished output.
            No account management. No briefs lost in a thread.
          </p>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {DEPARTMENTS.map(({ name, Icon, desc }) => (
              <div
                key={name}
                className="dept-card group rounded-xl border p-5 transition-colors duration-200"
                style={{
                  background: C.bgCard,
                  borderColor: C.border,
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = C.borderHover
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = C.border
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: C.textMuted }}
                />
                <h3
                  className="mt-3 text-sm font-semibold"
                  style={{ color: 'oklch(0.88 0 0)' }}
                >
                  {name}
                </h3>
                <p
                  className="mt-1.5 text-xs leading-relaxed"
                  style={{ color: C.textMuted }}
                >
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Built for Australian Health Businesses                 */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="machine-built"
        className="px-6 py-28"
        style={{ background: C.bg }}
      >
        <div className="mx-auto max-w-3xl">
          <p
            className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: C.accent }}
          >
            Purpose-built
          </p>
          <h2
            className="text-center text-3xl font-bold tracking-tight md:text-4xl"
            style={{ color: C.text }}
          >
            Built for Australian Health Businesses
          </h2>

          <ul className="mt-14 flex flex-col gap-5">
            {BUILT_FOR.map((item, i) => (
              <li
                key={i}
                className="built-item flex items-start gap-4 rounded-xl border p-5"
                style={{
                  background: C.bgCard,
                  borderColor: C.border,
                }}
              >
                {/* Tick mark */}
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: 'oklch(0.55 0.12 55 / 0.15)',
                    border: `1px solid oklch(0.55 0.12 55 / 0.4)`,
                  }}
                  aria-hidden="true"
                >
                  <svg
                    width="10"
                    height="8"
                    viewBox="0 0 10 8"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke={C.gold}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <p
                  className="text-sm leading-relaxed md:text-base"
                  style={{ color: C.textSub }}
                >
                  {item}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
