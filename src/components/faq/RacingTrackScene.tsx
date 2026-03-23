'use client'

import { useRef, useEffect, useState } from 'react'
import type * as THREE from 'three'

const FAQ_ITEMS = [
  { q: 'What is NotRealSmart Agency?', a: 'An AI marketing agency with 10 specialist departments that produce finished marketing outputs for your brand.' },
  { q: 'How does it work?', a: 'Pick your brand, brief an AI agent, get publish-ready content. Social posts, ads, SEO, email sequences, strategy docs.' },
  { q: 'What brands do you work with?', a: 'Currently managing 8 brands across health, skincare, SaaS, fragrance, and education. Built to scale to any industry.' },
  { q: 'Is the content ready to publish?', a: 'Yes. Each agent produces finished outputs — not drafts, not outlines. Copy, paste, publish.' },
  { q: 'What about healthcare compliance?', a: 'AHPRA and TGA advertising rules are built into every health brand output. The compliance agent checks everything.' },
  { q: 'What AI powers the agents?', a: 'Claude Sonnet 4 via Vercel AI Gateway. Each agent has a specialised system prompt with your brand context.' },
  { q: 'Can I add my own brand?', a: 'Yes. Create a brand profile with tone, audience, competitors, and compliance flags. Agents adapt automatically.' },
  { q: 'What does it cost?', a: 'Currently in private beta. Pricing coming soon.' },
]

// Mobile fallback — static FAQ accordion
function MobileFaq() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="min-h-screen pt-20 pb-8 px-6" style={{ background: 'oklch(0.08 0 0)' }}>
      <h1 className="text-2xl font-bold uppercase tracking-wider text-center mb-8" style={{ color: 'oklch(0.85 0.005 240)' }}>
        FAQ
      </h1>
      <div className="mx-auto max-w-lg space-y-3">
        {FAQ_ITEMS.map((faq, i) => (
          <div key={i} className="rounded-lg border overflow-hidden" style={{ borderColor: 'oklch(0.2 0.01 240)', background: 'oklch(0.1 0.005 240)' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full text-left px-4 py-3 flex justify-between items-center"
            >
              <span className="text-sm font-semibold pr-4" style={{ color: 'oklch(0.85 0 0)' }}>{faq.q}</span>
              <span style={{ color: 'oklch(0.5 0 0)' }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && (
              <div className="px-4 pb-3">
                <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.55 0 0)' }}>{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RacingTrackScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef(0)
  const [loaded, setLoaded] = useState(false)
  const [currentFaq, setCurrentFaq] = useState(-1)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.matchMedia('(hover: none)').matches || window.innerWidth < 768)
  }, [])

  useEffect(() => {
    if (isMobile) return
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let rafId = 0

    const init = async () => {
      const THREE = await import('three')

      const width = window.innerWidth
      const height = window.innerHeight

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x080810, 1)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.5
      container.appendChild(renderer.domElement)
      renderer.domElement.style.position = 'fixed'
      renderer.domElement.style.inset = '0'
      renderer.domElement.style.zIndex = '1'

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 500)
      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x080810, 0.005)

      // === Track curve — long straight sections with gentle turns ===
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 2, -40),
        new THREE.Vector3(15, 4, -80),
        new THREE.Vector3(30, 2, -120),
        new THREE.Vector3(15, 6, -160),
        new THREE.Vector3(-5, 4, -200),
        new THREE.Vector3(-20, 8, -240),
        new THREE.Vector3(-5, 6, -280),
        new THREE.Vector3(15, 4, -320),
        new THREE.Vector3(30, 2, -360),
        new THREE.Vector3(10, 6, -400),
        new THREE.Vector3(-15, 4, -440),
        new THREE.Vector3(0, 2, -480),
      ])

      // === Tunnel (BackSide so we see from inside) ===
      const tubeGeo = new THREE.TubeGeometry(curve, 400, 8, 16, false)
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a40,
        metalness: 0.6,
        roughness: 0.5,
        side: THREE.BackSide,
        emissive: 0x0a0a1a,
        emissiveIntensity: 0.3,
      })
      scene.add(new THREE.Mesh(tubeGeo, tubeMat))

      // === Glowing wireframe overlay ===
      const wireGeo = new THREE.TubeGeometry(curve, 400, 8.05, 16, false)
      scene.add(new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
        color: 0x3344aa, wireframe: true, transparent: true, opacity: 0.12, side: THREE.BackSide,
      })))

      // === Edge glow lines along track floor ===
      const edgePoints = curve.getPoints(300)
      const leftEdge = edgePoints.map(p => new THREE.Vector3(p.x - 6, p.y - 5, p.z))
      const rightEdge = edgePoints.map(p => new THREE.Vector3(p.x + 6, p.y - 5, p.z))
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 })
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftEdge), edgeMat))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightEdge), edgeMat))

      // === Centre line (dashed) ===
      const centreLine = edgePoints.map(p => new THREE.Vector3(p.x, p.y - 5, p.z))
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(centreLine),
        new THREE.LineDashedMaterial({ color: 0x334477, dashSize: 2, gapSize: 2, transparent: true, opacity: 0.3 })
      ))

      // === Billboard signs ===
      const billboardTs: number[] = []
      FAQ_ITEMS.forEach((faq, i) => {
        const t = (i + 0.7) / (FAQ_ITEMS.length + 0.5)
        billboardTs.push(t)
        const pos = curve.getPointAt(t)
        const tangent = curve.getTangentAt(t)

        // Canvas texture
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 512
        const ctx = canvas.getContext('2d')!

        // Background
        const grad = ctx.createLinearGradient(0, 0, 0, 512)
        grad.addColorStop(0, '#10101f')
        grad.addColorStop(1, '#0a0a15')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 1024, 512)

        // Glowing border
        ctx.shadowColor = '#4488ff'
        ctx.shadowBlur = 15
        ctx.strokeStyle = '#3366cc'
        ctx.lineWidth = 3
        ctx.strokeRect(12, 12, 1000, 488)
        ctx.shadowBlur = 0

        // Q number
        ctx.fillStyle = '#4488ff'
        ctx.font = 'bold 28px system-ui'
        ctx.fillText(`Q${i + 1}`, 35, 55)

        // Question
        ctx.fillStyle = '#d0d8f0'
        ctx.font = 'bold 30px system-ui'
        wrapText(ctx, faq.q, 35, 100, 950, 36)

        // Divider
        ctx.strokeStyle = '#2244aa'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(35, 180)
        ctx.lineTo(989, 180)
        ctx.stroke()

        // Answer
        ctx.fillStyle = '#7788bb'
        ctx.font = '22px system-ui'
        wrapText(ctx, faq.a, 35, 220, 950, 30)

        const tex = new THREE.CanvasTexture(canvas)
        tex.minFilter = THREE.LinearFilter
        const bbMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 6),
          new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true })
        )

        // Position on right wall, facing inward
        const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
        bbMesh.position.copy(pos).add(right.multiplyScalar(6))
        bbMesh.position.y += 1
        bbMesh.lookAt(pos)
        scene.add(bbMesh)
      })

      // === Lighting — much brighter ===
      scene.add(new THREE.AmbientLight(0x334466, 2))
      for (let i = 0; i < 30; i++) {
        const t = i / 30
        const pos = curve.getPointAt(t)
        const light = new THREE.PointLight(0x4466cc, 3, 30)
        light.position.copy(pos)
        light.position.y += 5
        scene.add(light)
      }

      // === Sparks ===
      const sparkCount = 1000
      const sparkArr = new Float32Array(sparkCount * 3)
      for (let i = 0; i < sparkCount; i++) {
        const t = Math.random()
        const p = curve.getPointAt(t)
        sparkArr[i * 3] = p.x + (Math.random() - 0.5) * 14
        sparkArr[i * 3 + 1] = p.y + (Math.random() - 0.5) * 14
        sparkArr[i * 3 + 2] = p.z + (Math.random() - 0.5) * 14
      }
      const sparkGeo = new THREE.BufferGeometry()
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkArr, 3))
      scene.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({
        size: 0.12, color: 0x6699ff, transparent: true, opacity: 0.7, sizeAttenuation: true,
      })))

      if (disposed) return
      setLoaded(true)

      // === Scroll handler ===
      const onScroll = () => {
        const scrollMax = document.documentElement.scrollHeight - window.innerHeight
        scrollRef.current = Math.max(0, Math.min(1, window.scrollY / scrollMax))
      }
      window.addEventListener('scroll', onScroll, { passive: true })

      // === WipEout-style damped camera ===
      const camPos = new THREE.Vector3()
      const camLookAt = new THREE.Vector3()
      const targetPos = new THREE.Vector3()
      const targetLookAt = new THREE.Vector3()
      const DAMPING = 0.92
      const Y_OFFSET = 2 // float above track centre
      const LOOK_AHEAD = 0.03 // how far ahead on curve to look

      // Initialise camera at start
      curve.getPointAt(0.01, camPos)
      camPos.y += Y_OFFSET
      curve.getPointAt(0.01 + LOOK_AHEAD, camLookAt)
      camera.position.copy(camPos)
      camera.lookAt(camLookAt)

      const animate = () => {
        if (disposed) return

        const t = Math.max(0.005, Math.min(0.99, scrollRef.current * 0.95 + 0.01))
        const tLook = Math.min(t + LOOK_AHEAD, 0.999)

        // Target position on curve + Y offset
        curve.getPointAt(t, targetPos)
        targetPos.y += Y_OFFSET

        // Target look-at (ahead on curve)
        curve.getPointAt(tLook, targetLookAt)

        // Exponential damping (WipEout pattern)
        camPos.multiplyScalar(DAMPING).add(targetPos.clone().multiplyScalar(1 - DAMPING))
        camLookAt.multiplyScalar(DAMPING).add(targetLookAt.clone().multiplyScalar(1 - DAMPING))

        camera.position.copy(camPos)
        camera.lookAt(camLookAt)

        // Determine closest FAQ
        let closest = -1
        let closestDist = Infinity
        billboardTs.forEach((bt, i) => {
          const dist = Math.abs(t - bt)
          if (dist < 0.035 && dist < closestDist) {
            closest = i
            closestDist = dist
          }
        })
        setCurrentFaq(closest)

        renderer.render(scene, camera)
        rafId = requestAnimationFrame(animate)
      }
      rafId = requestAnimationFrame(animate)

      const onResize = () => {
        if (disposed) return
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true
        cancelAnimationFrame(rafId)
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onResize)
        renderer.domElement.remove()
        renderer.dispose()
      }
    }

    let cleanup: (() => void) | undefined
    init().then((c) => { cleanup = c })
    return () => { cleanup?.() }
  }, [isMobile])

  if (isMobile) return <MobileFaq />

  return (
    <>
      <div ref={containerRef} className="fixed inset-0" style={{ background: 'oklch(0.05 0.005 240)' }}>
        {!loaded && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'oklch(0.4 0.01 240)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>

      {loaded && currentFaq >= 0 && (
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 max-w-lg px-6 text-center pointer-events-none">
          <div className="rounded-xl border px-6 py-4" style={{ background: 'oklch(0.08 0.005 240 / 0.9)', backdropFilter: 'blur(12px)', borderColor: 'oklch(0.25 0.01 240)' }}>
            <p className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.005 240)' }}>{FAQ_ITEMS[currentFaq].q}</p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'oklch(0.6 0 0)' }}>{FAQ_ITEMS[currentFaq].a}</p>
          </div>
        </div>
      )}

      {loaded && (
        <div className="fixed bottom-8 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
          <p className="text-[10px] uppercase tracking-widest animate-pulse" style={{ color: 'oklch(0.4 0 0)' }}>
            Scroll to fly through
          </p>
        </div>
      )}
    </>
  )
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, cy)
      line = word + ' '
      cy += lh
    } else {
      line = test
    }
  }
  ctx.fillText(line.trim(), x, cy)
}
