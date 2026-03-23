'use client'

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  PenLine, Search, Megaphone, Target, Mail,
  TrendingUp, Palette, Eye, Globe, ShieldCheck,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

const DEPARTMENTS = [
  { name: 'Content & Copy', icon: PenLine, desc: 'Social posts, blogs, landing pages — publish-ready' },
  { name: 'SEO', icon: Search, desc: 'Keywords, topic clusters, on-page optimisation' },
  { name: 'Paid Ads', icon: Megaphone, desc: 'Meta, Google, LinkedIn, TikTok ad sets' },
  { name: 'Strategy & Launch', icon: Target, desc: 'Campaign plans, GTM, launch playbooks' },
  { name: 'Email Marketing', icon: Mail, desc: 'Sequences, EDMs, newsletters — subject to send' },
  { name: 'Growth', icon: TrendingUp, desc: 'Referral programs, PR pitches, partnerships' },
  { name: 'Brand', icon: Palette, desc: 'Voice guides, pillars, competitor analysis' },
  { name: 'Competitor Intel', icon: Eye, desc: 'Messaging gaps, pricing analysis, SWOT' },
  { name: 'Website', icon: Globe, desc: 'Page copy, UX suggestions, conversion optimisation' },
  { name: 'Compliance', icon: ShieldCheck, desc: 'AHPRA/TGA advertising checks and rewrites' },
]

export function AgentShowcase() {
  const sectionRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Heading and subtitle fade in from below
      gsap.from('.agent-heading', {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.agent-heading',
          start: 'top 80%',
        },
      })

      gsap.from('.agent-subtitle', {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        delay: 0.1,
        scrollTrigger: {
          trigger: '.agent-subtitle',
          start: 'top 80%',
        },
      })

      // Cards stagger in from below
      gsap.from('.agent-card', {
        y: 40,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.agent-grid',
          start: 'top 80%',
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="px-6 py-24" style={{ background: 'oklch(0.08 0 0)' }}>
      <div className="mx-auto max-w-6xl">
        <h2
          className="agent-heading text-center text-3xl font-bold tracking-tight md:text-4xl"
          style={{ color: 'oklch(0.92 0 0)' }}
        >
          10 Departments. One Agency. Zero Headcount.
        </h2>
        <p
          className="agent-subtitle mx-auto mt-4 max-w-2xl text-center text-lg"
          style={{ color: 'oklch(0.55 0 0)' }}
        >
          Each agent is a specialist. Pick one, brief it, get finished output.
        </p>

        <div className="agent-grid mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DEPARTMENTS.map(({ name, icon: Icon, desc }) => (
            <div
              key={name}
              className="agent-card group rounded-xl border p-5 transition-all hover:border-[oklch(0.55_0.12_55)]"
              style={{
                background: 'oklch(0.12 0 0)',
                borderColor: 'oklch(0.2 0 0)',
              }}
            >
              <Icon
                className="h-5 w-5 transition-colors group-hover:text-[oklch(0.75_0.15_75)]"
                style={{ color: 'oklch(0.5 0 0)' }}
              />
              <h3
                className="mt-3 text-sm font-semibold"
                style={{ color: 'oklch(0.88 0 0)' }}
              >
                {name}
              </h3>
              <p
                className="mt-1.5 text-xs leading-relaxed"
                style={{ color: 'oklch(0.5 0 0)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
