'use client'

import { useRef, useEffect, useState } from 'react'
import type * as THREE from 'three'

function MobileAbout() {
  return (
    <div className="min-h-screen pt-20 pb-8" style={{ background: 'oklch(0.08 0 0)' }}>
      <iframe
        src="/about/content"
        className="w-full border-0"
        style={{ height: 'calc(100vh - 5rem)', background: 'oklch(0.1 0.005 240)' }}
        title="About NotRealSmart Agency"
      />
    </div>
  )
}

export function IndustrialDeskScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [zoomedIn, setZoomedIn] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const zoomedRef = useRef(false)

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
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const { CSS3DRenderer, CSS3DObject } = await import('three/examples/jsm/renderers/CSS3DRenderer.js')
      const gsapModule = await import('gsap')
      const gsap = gsapModule.default

      const width = container.clientWidth
      const height = container.clientHeight

      // === Camera ===
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
      camera.position.set(4, 3, 5)

      // === Scene ===
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0a0a0e)
      scene.fog = new THREE.FogExp2(0x0a0a0e, 0.06)

      // === CSS3D Renderer (behind) ===
      const cssRenderer = new CSS3DRenderer()
      cssRenderer.setSize(width, height)
      container.appendChild(cssRenderer.domElement)

      // === WebGL Renderer (on top, alpha, no pointer events) ===
      const glRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      glRenderer.domElement.style.position = 'absolute'
      glRenderer.domElement.style.top = '0'
      glRenderer.domElement.style.pointerEvents = 'none'
      glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      glRenderer.setSize(width, height)
      glRenderer.toneMapping = THREE.ACESFilmicToneMapping
      glRenderer.toneMappingExposure = 1.3
      container.appendChild(glRenderer.domElement)

      // === Controls div (on top for clicks) ===
      const controlsDiv = document.createElement('div')
      controlsDiv.style.position = 'absolute'
      controlsDiv.style.inset = '0'
      container.appendChild(controlsDiv)

      // === Lighting ===
      scene.add(new THREE.AmbientLight(0x556677, 2))
      const dirLight = new THREE.DirectionalLight(0xffffff, 3)
      dirLight.position.set(3, 5, 4)
      scene.add(dirLight)
      scene.add(new THREE.PointLight(0x4466aa, 2, 15).translateX(-3).translateY(3))
      scene.add(new THREE.PointLight(0x445566, 1.5, 5).translateY(1.5).translateZ(1))

      // === Load GLTF computer model ===
      const loader = new GLTFLoader()
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load('/computer.glb', resolve, undefined, reject)
      })
      const model = gltf.scene
      scene.add(model)

      // Make materials more metallic
      model.traverse((child: any) => {
        if (child.isMesh && child.material?.isMeshStandardMaterial) {
          child.material.metalness = Math.min(child.material.metalness + 0.3, 1)
          child.material.roughness = Math.max(child.material.roughness - 0.1, 0)
        }
      })

      // === Floor ===
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x111118, metalness: 0.3, roughness: 0.9 })
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -0.01
      scene.add(floor)

      // === CSS3D iframe on monitor screen ===
      const screenW = 960
      const screenH = 720
      const iframe = document.createElement('iframe')
      iframe.src = '/about/content'
      iframe.style.width = screenW + 'px'
      iframe.style.height = screenH + 'px'
      iframe.style.border = 'none'
      iframe.style.background = '#0d0d15'
      iframe.style.backfaceVisibility = 'hidden'

      const cssObject = new CSS3DObject(iframe)
      // Position on the monitor screen — adjust based on model
      cssObject.position.set(0, 1.55, 0.05)
      cssObject.scale.set(0.00085, 0.00085, 0.00085)
      scene.add(cssObject)

      // === Cutout mesh (NoBlending hole for CSS3D) ===
      const cutW = screenW * 0.00085
      const cutH = screenH * 0.00085
      const cutout = new THREE.Mesh(
        new THREE.PlaneGeometry(cutW, cutH),
        new THREE.MeshBasicMaterial({ color: 0x000000, blending: THREE.NoBlending, opacity: 0, premultipliedAlpha: true })
      )
      cutout.position.set(0, 1.55, 0.051)
      scene.add(cutout)

      // === Particles ===
      const pCount = 150
      const pArr = new Float32Array(pCount * 3)
      for (let i = 0; i < pCount * 3; i++) pArr[i] = (Math.random() - 0.5) * 15
      const pGeo = new THREE.BufferGeometry()
      pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3))
      const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
        size: 0.02, color: 0x667788, transparent: true, opacity: 0.4, sizeAttenuation: true,
      }))
      scene.add(particles)

      if (disposed) return
      setLoaded(true)

      // === Camera targets ===
      const isoPos = { x: 4, y: 3, z: 5 }
      const zoomPos = { x: 0, y: 1.55, z: 1.6 }
      const lookTarget = new THREE.Vector3(0, 1.2, 0)

      // Auto-zoom into monitor
      setTimeout(() => {
        if (disposed) return
        zoomedRef.current = true
        setZoomedIn(true)
        iframe.style.pointerEvents = 'auto'
        gsap.to(camera.position, { ...zoomPos, duration: 2.5, ease: 'power2.inOut' })
        gsap.to(lookTarget, { x: 0, y: 1.55, z: 0, duration: 2.5, ease: 'power2.inOut' })
      }, 2000)

      // === Click toggle zoom ===
      const handleClick = (e: MouseEvent) => {
        if (disposed) return
        if ((e.target as HTMLElement).tagName === 'IFRAME') return
        if (zoomedRef.current) {
          zoomedRef.current = false
          setZoomedIn(false)
          iframe.style.pointerEvents = 'none'
          gsap.to(camera.position, { ...isoPos, duration: 2, ease: 'power2.inOut' })
          gsap.to(lookTarget, { x: 0, y: 1.2, z: 0, duration: 2, ease: 'power2.inOut' })
        } else {
          zoomedRef.current = true
          setZoomedIn(true)
          iframe.style.pointerEvents = 'auto'
          gsap.to(camera.position, { ...zoomPos, duration: 2, ease: 'power2.inOut' })
          gsap.to(lookTarget, { x: 0, y: 1.55, z: 0, duration: 2, ease: 'power2.inOut' })
        }
      }
      controlsDiv.addEventListener('click', handleClick)

      // === Animate ===
      const animate = () => {
        if (disposed) return
        particles.rotation.y += 0.0002
        camera.lookAt(lookTarget)
        cssRenderer.render(scene, camera)
        glRenderer.render(scene, camera)
        rafId = requestAnimationFrame(animate)
      }
      rafId = requestAnimationFrame(animate)

      // === Resize ===
      const onResize = () => {
        if (disposed) return
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        glRenderer.setSize(w, h)
        cssRenderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true
        cancelAnimationFrame(rafId)
        window.removeEventListener('resize', onResize)
        controlsDiv.removeEventListener('click', handleClick)
        glRenderer.domElement.remove()
        cssRenderer.domElement.remove()
        controlsDiv.remove()
        glRenderer.dispose()
      }
    }

    let cleanup: (() => void) | undefined
    init().then((c) => { cleanup = c })
    return () => { cleanup?.() }
  }, [isMobile])

  if (isMobile) return <MobileAbout />

  return (
    <div ref={containerRef} className="relative h-svh w-full" style={{ background: 'oklch(0.06 0 0)' }}>
      {!loaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'oklch(0.06 0 0)' }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'oklch(0.4 0.01 240)', borderTopColor: 'transparent' }} />
        </div>
      )}
      {loaded && (
        <div className="absolute bottom-8 left-1/2 z-30 -translate-x-1/2 text-center pointer-events-none">
          <p className="text-xs uppercase tracking-widest animate-pulse" style={{ color: 'oklch(0.45 0 0)' }}>
            {zoomedIn ? 'Click outside to zoom out' : 'Click to zoom into monitor'}
          </p>
        </div>
      )}
    </div>
  )
}
