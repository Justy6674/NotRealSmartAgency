'use client'

import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STEPS = [
  {
    num: '01',
    title: 'Pick Your Brand',
    desc: 'Select from your portfolio or create a new brand profile with tone, audience, and compliance flags.',
  },
  {
    num: '02',
    title: 'Brief an Agent',
    desc: 'Choose a department, describe what you need. The agent knows your brand context already.',
  },
  {
    num: '03',
    title: 'Get Finished Output',
    desc: 'Review, copy, publish. Compliance-checked for health brands. Save to your output library.',
  },
]

// Total width between circle centres on the 3-col grid (max-w-4xl = 896px, 3 cols)
// Lines connect circle centres: from right edge of circle 1 to left edge of circle 2
// Rendered as a positioned SVG overlay — only visible on md+
const CONNECTOR_LENGTH = 180

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Heading fades in from below
      gsap.from('.hiw-heading', {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.hiw-heading',
          start: 'top 80%',
        },
      })

      // Step columns stagger in from below
      gsap.from('.hiw-step', {
        y: 50,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.2,
        scrollTrigger: {
          trigger: '.hiw-grid',
          start: 'top 80%',
        },
      })

      // Numbered circles scale in with back ease
      gsap.from('.hiw-circle', {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(1.7)',
        stagger: 0.2,
        scrollTrigger: {
          trigger: '.hiw-grid',
          start: 'top 80%',
        },
      })

      // Connector lines draw in via strokeDashoffset (HTML attribute starts at CONNECTOR_LENGTH, animate to 0)
      gsap.to('.hiw-connector-line', {
        strokeDashoffset: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        stagger: 0.2,
        delay: 0.4,
        scrollTrigger: {
          trigger: '.hiw-grid',
          start: 'top 80%',
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="px-6 py-24" style={{ background: 'oklch(0.06 0 0)' }}>
      <div className="mx-auto max-w-4xl">
        <h2
          className="hiw-heading text-center text-3xl font-bold tracking-tight md:text-4xl"
          style={{ color: 'oklch(0.92 0 0)' }}
        >
          How It Works
        </h2>

        {/* Grid with relative positioning so connector SVGs can be overlaid */}
        <div className="hiw-grid relative mt-16 grid gap-12 md:grid-cols-3">

          {/* Connector lines — desktop only, positioned between circle centres */}
          {/* Each connector sits between column n and n+1, centred vertically on the circles */}
          {[0, 1].map((i) => (
            <svg
              key={i}
              aria-hidden="true"
              className="hiw-connector pointer-events-none absolute hidden md:block"
              style={{
                // Circle is h-16 (64px), grid starts at top of content
                // Each column is 1/3 of grid. Circle centre is at col midpoint, 32px from top of step
                // Position: left edge at right of circle i, width = gap between circles
                top: 0,
                left: `calc(${(i + 1) * (100 / 3)}% - ${CONNECTOR_LENGTH / 2}px)`,
                width: CONNECTOR_LENGTH,
                height: 64,
                overflow: 'visible',
              }}
            >
              <line
                className="hiw-connector-line"
                x1={0}
                y1={32}
                x2={CONNECTOR_LENGTH}
                y2={32}
                stroke="oklch(0.3 0.06 55)"
                strokeWidth={1.5}
                strokeDasharray={`6 6`}
                strokeDashoffset={CONNECTOR_LENGTH}
                strokeLinecap="round"
              />
            </svg>
          ))}

          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="hiw-step text-center">
              <div
                className="hiw-circle mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 font-mono text-xl font-bold"
                style={{
                  borderColor: 'oklch(0.55 0.12 55)',
                  color: 'oklch(0.75 0.15 75)',
                  background: 'oklch(0.06 0 0)',
                }}
              >
                {num}
              </div>
              <h3
                className="mt-5 text-lg font-semibold"
                style={{ color: 'oklch(0.88 0 0)' }}
              >
                {title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
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
