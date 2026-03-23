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

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x0a0a12, 1)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      container.appendChild(renderer.domElement)
      renderer.domElement.style.position = 'fixed'
      renderer.domElement.style.inset = '0'
      renderer.domElement.style.zIndex = '1'

      const camera = new THREE.PerspectiveCamera(84, width / height, 0.1, 2000)
      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x0a0a12, 0.008)

      // === Track curve — more dramatic with wider turns ===
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 5, -30),
        new THREE.Vector3(20, 10, -60),
        new THREE.Vector3(40, 5, -90),
        new THREE.Vector3(20, 15, -130),
        new THREE.Vector3(-10, 10, -170),
        new THREE.Vector3(-30, 20, -210),
        new THREE.Vector3(-10, 15, -250),
        new THREE.Vector3(20, 10, -290),
        new THREE.Vector3(40, 5, -330),
        new THREE.Vector3(10, 15, -370),
        new THREE.Vector3(-20, 10, -410),
      ])

      // === Tunnel (tube geometry, rendered from inside) ===
      const tubeGeo = new THREE.TubeGeometry(curve, 300, 12, 16, false)
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a3a,
        metalness: 0.7,
        roughness: 0.4,
        side: THREE.BackSide,
      })
      scene.add(new THREE.Mesh(tubeGeo, tubeMat))

      // === Wireframe grid overlay ===
      const wireGeo = new THREE.TubeGeometry(curve, 300, 12.1, 16, false)
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x4455aa,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      })
      scene.add(new THREE.Mesh(wireGeo, wireMat))

      // === Edge glow lines along the track ===
      const edgeCurveL = new THREE.CatmullRomCurve3(
        curve.getPoints(100).map(p => new THREE.Vector3(p.x - 10, p.y - 8, p.z))
      )
      const edgeCurveR = new THREE.CatmullRomCurve3(
        curve.getPoints(100).map(p => new THREE.Vector3(p.x + 10, p.y - 8, p.z))
      )
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x3366cc, transparent: true, opacity: 0.5 })
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgeCurveL.getPoints(200)), edgeMat))
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgeCurveR.getPoints(200)), edgeMat))

      // === Billboard signs at intervals ===
      const billboardTs: number[] = []
      FAQ_ITEMS.forEach((faq, i) => {
        const t = (i + 0.8) / (FAQ_ITEMS.length + 1)
        billboardTs.push(t)

        const pos = curve.getPointAt(t)
        const tangent = curve.getTangentAt(t)

        // Canvas texture for billboard
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 512
        const ctx = canvas.getContext('2d')!

        // Dark panel with border
        ctx.fillStyle = '#0c0c18'
        ctx.fillRect(0, 0, 1024, 512)
        ctx.strokeStyle = '#3355aa'
        ctx.lineWidth = 4
        ctx.strokeRect(8, 8, 1008, 496)

        // Question number badge
        ctx.fillStyle = '#3366cc'
        ctx.fillRect(30, 30, 60, 40)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 24px system-ui'
        ctx.fillText(`Q${i + 1}`, 40, 58)

        // Question text
        ctx.fillStyle = '#e0e4f0'
        ctx.font = 'bold 32px system-ui'
        wrapText(ctx, faq.q, 110, 60, 880, 38)

        // Divider line
        ctx.strokeStyle = '#334488'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(30, 160)
        ctx.lineTo(994, 160)
        ctx.stroke()

        // Answer text
        ctx.fillStyle = '#8899bb'
        ctx.font = '24px system-ui'
        wrapText(ctx, faq.a, 30, 200, 960, 32)

        const tex = new THREE.CanvasTexture(canvas)
        tex.minFilter = THREE.LinearFilter
        const bbGeo = new THREE.PlaneGeometry(16, 8)
        const bbMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
        const billboard = new THREE.Mesh(bbGeo, bbMat)

        // Position on right wall
        const right = new THREE.Vector3()
        right.crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
        billboard.position.copy(pos).add(right.multiplyScalar(8))
        billboard.position.y += 3
        billboard.lookAt(pos.clone().add(new THREE.Vector3(0, 3, 0)))

        scene.add(billboard)
      })

      // === Lights along the track ===
      scene.add(new THREE.AmbientLight(0x222233, 1))
      for (let i = 0; i < 20; i++) {
        const t = i / 20
        const pos = curve.getPointAt(t)
        const light = new THREE.PointLight(0x4466aa, 2, 40)
        light.position.copy(pos)
        light.position.y += 8
        scene.add(light)
      }

      // === Spark particles scattered through tunnel ===
      const sparkCount = 800
      const sparkPos = new Float32Array(sparkCount * 3)
      for (let i = 0; i < sparkCount; i++) {
        const t = Math.random()
        const p = curve.getPointAt(t)
        sparkPos[i * 3] = p.x + (Math.random() - 0.5) * 20
        sparkPos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 20
        sparkPos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 20
      }
      const sparkGeo = new THREE.BufferGeometry()
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
      scene.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({
        size: 0.15, color: 0x6688cc, transparent: true, opacity: 0.6, sizeAttenuation: true,
      })))

      if (disposed) return
      setLoaded(true)

      // === Scroll handler ===
      const onScroll = () => {
        const scrollMax = document.documentElement.scrollHeight - window.innerHeight
        scrollRef.current = Math.max(0, Math.min(1, window.scrollY / scrollMax))
      }
      window.addEventListener('scroll', onScroll, { passive: true })

      // === Camera fly-through using Frenet frames (from Three.js official example) ===
      const position = new THREE.Vector3()
      const lookAt = new THREE.Vector3()
      const direction = new THREE.Vector3()
      const binormal = new THREE.Vector3()
      const normal = new THREE.Vector3()

      const animate = () => {
        if (disposed) return

        const t = Math.max(0.001, Math.min(0.999, scrollRef.current * 0.95 + 0.01))

        // Get position on curve
        curve.getPointAt(t, position)

        // Get tangent for direction
        curve.getTangentAt(t, direction)

        // Use tubeGeometry Frenet frames for stable orientation
        const segments = tubeGeo.tangents.length
        const pickt = t * segments
        const pick = Math.floor(pickt)
        const pickNext = (pick + 1) % segments

        // Interpolate binormal
        binormal.subVectors(tubeGeo.binormals[pickNext], tubeGeo.binormals[pick])
        binormal.multiplyScalar(pickt - pick).add(tubeGeo.binormals[pick])

        // Normal = binormal x tangent
        normal.copy(binormal).cross(direction)

        // Offset camera slightly above centre
        camera.position.copy(position)
        camera.position.add(normal.clone().multiplyScalar(2))

        // Look ahead on the curve
        const lookAheadT = Math.min(t + 15 / curve.getLength(), 0.999)
        curve.getPointAt(lookAheadT, lookAt)

        // Stable orientation using matrix lookAt with normal as up
        camera.matrix.lookAt(camera.position, lookAt, normal)
        camera.quaternion.setFromRotationMatrix(camera.matrix)

        // Determine closest FAQ
        let closest = -1
        let closestDist = Infinity
        billboardTs.forEach((bt, i) => {
          const dist = Math.abs(t - bt)
          if (dist < 0.04 && dist < closestDist) {
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
  }, [])

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
          <div className="rounded-xl border px-6 py-4" style={{ background: 'oklch(0.08 0.005 240 / 0.85)', backdropFilter: 'blur(12px)', borderColor: 'oklch(0.25 0.01 240)' }}>
            <p className="text-sm font-semibold" style={{ color: 'oklch(0.85 0.005 240)' }}>{FAQ_ITEMS[currentFaq].q}</p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'oklch(0.55 0 0)' }}>{FAQ_ITEMS[currentFaq].a}</p>
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
