'use client'

import { useRef, useEffect, useState } from 'react'
import type * as THREE from 'three'

const FAQ_ITEMS = [
  { q: 'What is NotRealSmart Agency?', a: 'An AI marketing agency with 10 specialist departments that produce finished marketing outputs for your brand.' },
  { q: 'How does it work?', a: 'Pick your brand, brief an AI agent, get publish-ready content. Social posts, ads, SEO, email sequences, strategy docs.' },
  { q: 'What brands do you work with?', a: 'Currently managing 8 brands across health, skincare, SaaS, fragrance, and education. Built to scale to any industry.' },
  { q: 'Is the content ready to publish?', a: 'Yes. Each agent produces finished outputs — not drafts, not outlines. Copy, paste, publish.' },
  { q: 'What about healthcare compliance?', a: 'AHPRA and TGA advertising rules are built into every health brand output. The compliance agent checks everything.' },
  { q: 'What AI model powers the agents?', a: 'Claude Sonnet 4 via Vercel AI Gateway. Each agent has a specialised system prompt with your brand context injected.' },
  { q: 'Can I add my own brand?', a: 'Yes. Create a brand profile with tone, audience, competitors, and compliance flags. The agents adapt automatically.' },
  { q: 'What does it cost?', a: 'Currently in private beta. Pricing coming soon.' },
]

export function RacingTrackScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef(0)
  const [loaded, setLoaded] = useState(false)
  const [currentFaq, setCurrentFaq] = useState(-1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let rafId = 0

    const init = async () => {
      const THREE = await import('three')

      const width = window.innerWidth
      const height = window.innerHeight

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x050508, 1)
      container.appendChild(renderer.domElement)
      renderer.domElement.style.position = 'fixed'
      renderer.domElement.style.inset = '0'
      renderer.domElement.style.zIndex = '1'

      const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 200)
      const scene = new THREE.Scene()
      scene.fog = new THREE.Fog(0x050508, 5, 30)

      // === Track curve ===
      const curvePoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -10),
        new THREE.Vector3(3, 1, -20),
        new THREE.Vector3(0, 2, -30),
        new THREE.Vector3(-3, 1.5, -40),
        new THREE.Vector3(0, 0.5, -50),
        new THREE.Vector3(2, 2, -60),
        new THREE.Vector3(0, 1, -70),
        new THREE.Vector3(-2, 0, -80),
        new THREE.Vector3(0, 1, -90),
      ]
      const curve = new THREE.CatmullRomCurve3(curvePoints)

      // === Tunnel ===
      const tubeGeo = new THREE.TubeGeometry(curve, 200, 3, 12, false)
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        metalness: 0.7,
        roughness: 0.4,
        side: THREE.BackSide,
        wireframe: false,
      })
      const tube = new THREE.Mesh(tubeGeo, tubeMat)
      scene.add(tube)

      // === Wireframe overlay for industrial look ===
      const wireGeo = new THREE.TubeGeometry(curve, 200, 3.01, 12, false)
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x222244,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
      })
      scene.add(new THREE.Mesh(wireGeo, wireMat))

      // === Billboard planes at intervals ===
      const billboards: THREE.Mesh[] = []
      const billboardData: { t: number; mesh: THREE.Mesh }[] = []

      FAQ_ITEMS.forEach((faq, i) => {
        const t = (i + 1) / (FAQ_ITEMS.length + 1)
        const pos = curve.getPointAt(t)
        const tangent = curve.getTangentAt(t)

        // Create billboard canvas
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 512
        const ctx = canvas.getContext('2d')!

        // Dark metallic background
        ctx.fillStyle = '#0d0d15'
        ctx.fillRect(0, 0, 1024, 512)
        ctx.strokeStyle = '#334'
        ctx.lineWidth = 3
        ctx.strokeRect(10, 10, 1004, 492)

        // Question
        ctx.fillStyle = '#b0b8c8'
        ctx.font = 'bold 36px system-ui, sans-serif'
        ctx.fillText(`Q${i + 1}`, 40, 60)

        ctx.fillStyle = '#e0e4ec'
        ctx.font = 'bold 30px system-ui, sans-serif'
        wrapText(ctx, faq.q, 40, 110, 940, 36)

        // Answer
        ctx.fillStyle = '#667088'
        ctx.font = '24px system-ui, sans-serif'
        wrapText(ctx, faq.a, 40, 220, 940, 32)

        const texture = new THREE.CanvasTexture(canvas)
        const billboardGeo = new THREE.PlaneGeometry(4, 2)
        const billboardMat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
        })
        const billboard = new THREE.Mesh(billboardGeo, billboardMat)

        // Position billboard on the right side of the tunnel
        const normal = new THREE.Vector3()
        normal.crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
        billboard.position.copy(pos).add(normal.multiplyScalar(2.2))
        billboard.lookAt(pos)

        scene.add(billboard)
        billboards.push(billboard)
        billboardData.push({ t, mesh: billboard })
      })

      // === Lighting along the track ===
      for (let i = 0; i < 15; i++) {
        const t = i / 15
        const pos = curve.getPointAt(t)
        const light = new THREE.PointLight(0x445577, 0.6, 8)
        light.position.copy(pos)
        light.position.y += 2
        scene.add(light)
      }

      const ambient = new THREE.AmbientLight(0x222233, 0.5)
      scene.add(ambient)

      // === Particles (sparks flying past) ===
      const sparkCount = 500
      const sparkPositions = new Float32Array(sparkCount * 3)
      for (let i = 0; i < sparkCount; i++) {
        const t = Math.random()
        const pos = curve.getPointAt(t)
        sparkPositions[i * 3] = pos.x + (Math.random() - 0.5) * 5
        sparkPositions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 5
        sparkPositions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 5
      }
      const sparkGeo = new THREE.BufferGeometry()
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3))
      const sparkMat = new THREE.PointsMaterial({
        size: 0.03,
        color: 0x6688aa,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
      })
      scene.add(new THREE.Points(sparkGeo, sparkMat))

      if (disposed) return
      setLoaded(true)

      // === Scroll handler ===
      const onScroll = () => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
        scrollRef.current = Math.max(0, Math.min(1, window.scrollY / scrollHeight))
      }
      window.addEventListener('scroll', onScroll, { passive: true })

      // === Animation loop ===
      const lookAtTarget = new THREE.Vector3()

      const animate = () => {
        if (disposed) return

        const t = scrollRef.current * 0.95 + 0.02 // Keep camera slightly off the edges
        const pos = curve.getPointAt(t)
        const lookT = Math.min(t + 0.01, 1)
        lookAtTarget.copy(curve.getPointAt(lookT))

        camera.position.copy(pos)
        camera.lookAt(lookAtTarget)

        // Determine which FAQ is closest
        let closest = -1
        let closestDist = Infinity
        billboardData.forEach(({ t: bt }, i) => {
          const dist = Math.abs(t - bt)
          if (dist < 0.05 && dist < closestDist) {
            closest = i
            closestDist = dist
          }
        })
        setCurrentFaq(closest)

        renderer.render(scene, camera)
        rafId = requestAnimationFrame(animate)
      }
      rafId = requestAnimationFrame(animate)

      // === Resize ===
      const onResize = () => {
        if (disposed) return
        const w = window.innerWidth
        const h = window.innerHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true
        cancelAnimationFrame(rafId)
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onResize)
        renderer.domElement.remove()
        renderer.dispose()
        tubeGeo.dispose()
        tubeMat.dispose()
        sparkGeo.dispose()
        sparkMat.dispose()
        billboards.forEach((b) => {
          (b.material as THREE.MeshBasicMaterial).map?.dispose()
          ;(b.material as THREE.MeshBasicMaterial).dispose()
          b.geometry.dispose()
        })
      }
    }

    let cleanup: (() => void) | undefined
    init().then((c) => { cleanup = c })
    return () => { cleanup?.() }
  }, [])

  return (
    <>
      <div ref={containerRef} className="fixed inset-0" style={{ background: 'oklch(0.04 0 0)' }}>
        {!loaded && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'oklch(0.4 0.01 240)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>

      {/* Current FAQ overlay */}
      {loaded && currentFaq >= 0 && (
        <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 max-w-lg px-6 text-center pointer-events-none">
          <div
            className="rounded-xl border px-6 py-4"
            style={{
              background: 'oklch(0.08 0.005 240 / 0.85)',
              backdropFilter: 'blur(12px)',
              borderColor: 'oklch(0.25 0.01 240)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'oklch(0.85 0.005 240)' }}>
              {FAQ_ITEMS[currentFaq].q}
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'oklch(0.55 0 0)' }}>
              {FAQ_ITEMS[currentFaq].a}
            </p>
          </div>
        </div>
      )}

      {/* Scroll indicator */}
      {loaded && (
        <div className="fixed bottom-8 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
          <p className="text-[10px] uppercase tracking-widest animate-pulse" style={{ color: 'oklch(0.35 0 0)' }}>
            Scroll to fly through
          </p>
        </div>
      )}
    </>
  )
}

// Helper: wrap text on canvas
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  for (const word of words) {
    const testLine = line + word + ' '
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, currentY)
      line = word + ' '
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line.trim(), x, currentY)
}
