'use client'

import { HelpSearch } from './HelpSearch'
import type { SearchEntry } from '@/lib/help/types'

interface HelpHeroProps {
  searchIndex: SearchEntry[]
}

export function HelpHero({ searchIndex }: HelpHeroProps) {
  return (
    <section
      style={{
        padding: '6rem 1.5rem 3rem',
        textAlign: 'center',
        maxWidth: '680px',
        margin: '0 auto',
      }}
    >
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
        // help centre
      </p>
      <h1
        style={{
          fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 600,
          color: 'oklch(0.9 0.005 240)',
          marginBottom: '0.75rem',
          textShadow: '0 0 18px oklch(0.6 0.01 240 / 0.35)',
        }}
      >
        How can we help?
      </h1>
      <p
        style={{
          fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
          fontSize: '1.05rem',
          color: 'oklch(0.55 0 0)',
          lineHeight: 1.6,
          marginBottom: '2rem',
        }}
      >
        Search for answers or browse the categories below.
      </p>
      <HelpSearch searchIndex={searchIndex} autoFocus placeholder="Type to search — e.g. 'schedule a post' or 'compliance'" />
    </section>
  )
}
