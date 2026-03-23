'use client'

import { useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Star {
  x: number
  y: number
  baseRadius: number
  brightness: number
  twinkleSpeed: number
  twinklePhase: number
  r: number
  g: number
  b: number
}

interface TrailPoint {
  x: number
  y: number
  time: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2
const STAR_COUNT = 250
const TRAIL_MAX = 40
const TRAIL_LIFETIME = 400

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateStars(w: number, h: number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < STAR_COUNT; i++) {
    const colourRoll = Math.random()
    let r = 255, g = 255, b = 255
    if (colourRoll > 0.95) {
      // warm tint
      r = 255; g = 235; b = 210
    } else if (colourRoll > 0.90) {
      // blue tint
      r = 210; g = 230; b = 255
    }
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      baseRadius: Math.random() * 2 + 0.5,
      brightness: Math.random(),
      twinkleSpeed: 0.3 + Math.random() * 1.5,
      twinklePhase: Math.random() * TAU,
      r, g, b,
    })
  }
  return stars
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpaceHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const starsRef = useRef<Star[]>([])
  const trailRef = useRef<TrailPoint[]>([])
  const rafRef = useRef<number>(0)
  const isMobileRef = useRef(false)

  // --- Pointer handler (ref-based, no re-renders) ---
  const handlePointerMove = useCallback((e: PointerEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Update trail
    const trail = trailRef.current
    trail.push({ x, y, time: performance.now() })
    if (trail.length > TRAIL_MAX) trail.shift()

    // Update spotlight directly (no setState)
    if (spotlightRef.current) {
      spotlightRef.current.style.background =
        `radial-gradient(circle 350px at ${x}px ${y}px, oklch(0.92 0 0 / 0.07) 0%, transparent 100%)`
    }
  }, [])

  const handlePointerLeave = useCallback(() => {
    trailRef.current = []
    if (spotlightRef.current) {
      spotlightRef.current.style.background = 'transparent'
    }
  }, [])

  // --- Main effect ---
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    // Mobile detection
    isMobileRef.current = window.matchMedia('(pointer: coarse)').matches
    if (isMobileRef.current) return // No canvas on mobile

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // --- Resize ---
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      const w = container.clientWidth
      const h = container.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      starsRef.current = generateStars(w, h)
    }
    resize()

    // --- Listeners ---
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('resize', resize)

    // --- Animation loop ---
    let elapsed = 0

    const animate = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      ctx.clearRect(0, 0, w, h)
      elapsed += 0.016

      // Draw stars
      const stars = starsRef.current
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        const twinkle = 0.5 + 0.5 * Math.sin(elapsed * s.twinkleSpeed + s.twinklePhase)
        const alpha = s.brightness * twinkle

        if (s.brightness > 0.7) {
          ctx.shadowBlur = s.baseRadius * 3
          ctx.shadowColor = `rgba(${s.r},${s.g},${s.b},${alpha * 0.6})`
        }

        ctx.globalAlpha = alpha
        ctx.fillStyle = `rgb(${s.r},${s.g},${s.b})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.baseRadius, 0, TAU)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      ctx.globalAlpha = 1

      // Draw comet trail
      const now = performance.now()
      const trail = trailRef.current.filter(p => now - p.time < TRAIL_LIFETIME)
      trailRef.current = trail

      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].time) / TRAIL_LIFETIME
          const opacity = (1 - age) * 0.7
          const width = (1 - age) * 3 + 0.5

          ctx.beginPath()
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y)
          ctx.lineTo(trail[i].x, trail[i].y)
          ctx.strokeStyle = `rgba(220, 170, 60, ${opacity})`
          ctx.lineWidth = width
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        // Comet head
        const head = trail[trail.length - 1]
        const grd = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 12)
        grd.addColorStop(0, 'rgba(255, 240, 200, 0.8)')
        grd.addColorStop(0.3, 'rgba(220, 170, 60, 0.4)')
        grd.addColorStop(1, 'rgba(220, 170, 60, 0)')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(head.x, head.y, 12, 0, TAU)
        ctx.fill()

        // Bright core
        ctx.fillStyle = 'rgba(255, 250, 240, 0.9)'
        ctx.beginPath()
        ctx.arc(head.x, head.y, 2, 0, TAU)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(rafRef.current)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('resize', resize)
    }
  }, [handlePointerMove, handlePointerLeave])

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-[85vh] items-center justify-center overflow-hidden"
      style={{
        background: 'oklch(0.04 0 0)',
        cursor: isMobileRef.current ? 'auto' : 'none',
      }}
    >
      {/* Canvas — starfield + comet */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10"
        style={{ pointerEvents: 'none' }}
      />

      {/* Nebula clouds */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="absolute rounded-full"
          style={{
            top: '15%', left: '20%', width: 500, height: 400,
            background: 'oklch(0.25 0.08 270 / 0.08)',
            filter: 'blur(120px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: '20%', right: '15%', width: 400, height: 350,
            background: 'oklch(0.2 0.06 220 / 0.06)',
            filter: 'blur(100px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: '50%', left: '55%', width: 350, height: 300,
            background: 'oklch(0.18 0.04 200 / 0.05)',
            filter: 'blur(90px)',
          }}
        />
      </div>

      {/* Spotlight — follows cursor via ref */}
      <div
        ref={spotlightRef}
        className="absolute inset-0 z-20"
        style={{ pointerEvents: 'none' }}
      />

      {/* Logo — floating gently */}
      <div className="relative z-5 nrs-logo-float" style={{ width: '80%', maxWidth: 700 }}>
        <div className="relative aspect-square">
          <Image
            src="/Logo.png"
            alt="NotReal Smart Agency — Not Artificial, Real Intelligence"
            fill
            className="object-contain"
            style={{
              filter: 'drop-shadow(0 0 60px oklch(0.55 0.12 55 / 0.15))',
            }}
            priority
            sizes="(max-width: 768px) 90vw, 700px"
          />
        </div>
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 z-30"
        style={{
          boxShadow: 'inset 0 0 150px 60px oklch(0.02 0 0 / 0.8)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Float animation */}
      <style>{`
        @keyframes nrs-drift {
          0%   { transform: translate(0, 0) rotate(0deg); }
          25%  { transform: translate(6px, -12px) rotate(1.5deg); }
          50%  { transform: translate(-3px, -6px) rotate(-0.5deg); }
          75%  { transform: translate(-6px, 12px) rotate(-1.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        .nrs-logo-float {
          animation: nrs-drift 12s cubic-bezier(0.37, 0, 0.63, 1) infinite;
        }
      `}</style>
    </section>
  )
}
