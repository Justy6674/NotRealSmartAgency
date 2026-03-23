'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type * as THREE from 'three'

export function IndustrialDeskScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [zoomedIn, setZoomedIn] = useState(false)
  const zoomedRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let rafId = 0

    const init = async () => {
      const THREE = await import('three')
      const { CSS3DRenderer, CSS3DObject } = await import('three/examples/jsm/renderers/CSS3DRenderer.js')
      const gsapModule = await import('gsap')
      const gsap = gsapModule.default

      const width = container.clientWidth
      const height = container.clientHeight

      // === WebGL Renderer ===
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x0a0a0a, 1)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)
      renderer.domElement.style.position = 'absolute'
      renderer.domElement.style.inset = '0'
      renderer.domElement.style.zIndex = '1'

      // === CSS3D Renderer (overlaid) ===
      const cssRenderer = new CSS3DRenderer()
      cssRenderer.setSize(width, height)
      cssRenderer.domElement.style.position = 'absolute'
      cssRenderer.domElement.style.inset = '0'
      cssRenderer.domElement.style.zIndex = '2'
      cssRenderer.domElement.style.pointerEvents = 'none'
      container.appendChild(cssRenderer.domElement)

      // === Camera ===
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
      camera.position.set(3.5, 2.5, 3.5)
      camera.lookAt(0, 0.5, 0)

      // === Scenes ===
      const scene = new THREE.Scene()
      const cssScene = new THREE.Scene()

      // === Materials ===
      const metalMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.85,
        roughness: 0.25,
      })
      const darkMetalMat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.9,
        roughness: 0.3,
      })
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0x0a1520,
        emissiveIntensity: 0.3,
      })

      // === Desk ===
      const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.2), metalMat)
      deskTop.position.set(0, 0.7, 0)
      deskTop.castShadow = true
      deskTop.receiveShadow = true
      scene.add(deskTop)

      // Desk legs
      const legGeo = new THREE.BoxGeometry(0.06, 0.7, 0.06)
      const legPositions = [[-1.1, 0.35, -0.5], [1.1, 0.35, -0.5], [-1.1, 0.35, 0.5], [1.1, 0.35, 0.5]]
      legPositions.forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legGeo, darkMetalMat)
        leg.position.set(x, y, z)
        leg.castShadow = true
        scene.add(leg)
      })

      // === Monitor ===
      // Monitor body (CRT-style box)
      const monitorBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.5), darkMetalMat)
      monitorBody.position.set(0, 1.15, -0.1)
      monitorBody.castShadow = true
      scene.add(monitorBody)

      // Monitor screen (front face) — slightly inset
      const monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.55), screenMat)
      monitorScreen.position.set(0, 1.18, 0.151)
      scene.add(monitorScreen)

      // Monitor stand
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), darkMetalMat)
      stand.position.set(0, 0.78, -0.1)
      scene.add(stand)

      // === Keyboard ===
      const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.2), metalMat)
      keyboard.position.set(0, 0.75, 0.35)
      scene.add(keyboard)

      // === Mouse ===
      const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), metalMat)
      mouse.position.set(0.5, 0.75, 0.35)
      scene.add(mouse)

      // === Scattered debris (small tech items) ===
      const debrisGeo = new THREE.BoxGeometry(0.1, 0.03, 0.06)
      const debrisPositions = [[-0.8, 0.76, 0.2], [0.9, 0.76, -0.3], [-0.6, 0.76, -0.4]]
      debrisPositions.forEach(([x, y, z]) => {
        const debris = new THREE.Mesh(debrisGeo, metalMat)
        debris.position.set(x, y, z)
        debris.rotation.y = Math.random() * Math.PI
        scene.add(debris)
      })

      // === Floor ===
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.8 })
      )
      floor.rotation.x = -Math.PI / 2
      floor.receiveShadow = true
      scene.add(floor)

      // === Lighting ===
      const ambient = new THREE.AmbientLight(0x333340, 0.8)
      scene.add(ambient)

      const warmLight = new THREE.PointLight(0xffaa66, 1.2, 10)
      warmLight.position.set(2, 3, 2)
      warmLight.castShadow = true
      scene.add(warmLight)

      const coolLight = new THREE.PointLight(0x6688cc, 0.8, 10)
      coolLight.position.set(-2, 2, -1)
      scene.add(coolLight)

      const monitorGlow = new THREE.PointLight(0x334455, 0.5, 3)
      monitorGlow.position.set(0, 1.2, 0.5)
      scene.add(monitorGlow)

      // === Particles (floating dust) ===
      const particleCount = 300
      const particlePositions = new Float32Array(particleCount * 3)
      for (let i = 0; i < particleCount * 3; i++) {
        particlePositions[i] = (Math.random() - 0.5) * 8
      }
      const particleGeo = new THREE.BufferGeometry()
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
      const particleMat = new THREE.PointsMaterial({
        size: 0.015,
        color: 0x888899,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true,
      })
      const particles = new THREE.Points(particleGeo, particleMat)
      scene.add(particles)

      // === CSS3D Object (iframe on monitor screen) ===
      const iframe = document.createElement('iframe')
      iframe.src = '/about/content'
      iframe.style.width = '800px'
      iframe.style.height = '600px'
      iframe.style.border = 'none'
      iframe.style.background = '#111'

      const cssObject = new CSS3DObject(iframe)
      // Position and scale to match monitor screen
      cssObject.position.set(0, 1.18, 0.152)
      cssObject.scale.set(0.00094, 0.00092, 1)
      cssScene.add(cssObject)

      if (disposed) return
      setLoaded(true)

      // === Camera positions ===
      const isoPos = { x: 3.5, y: 2.5, z: 3.5 }
      const zoomPos = { x: 0, y: 1.18, z: 1.2 }
      const isoTarget = new THREE.Vector3(0, 0.5, 0)
      const zoomTarget = new THREE.Vector3(0, 1.18, 0)
      const currentTarget = isoTarget.clone()

      // Auto-zoom after a delay
      setTimeout(() => {
        if (disposed) return
        zoomedRef.current = true
        setZoomedIn(true)
        cssRenderer.domElement.style.pointerEvents = 'auto'
        gsap.to(camera.position, { ...zoomPos, duration: 2.5, ease: 'power2.inOut' })
        gsap.to(currentTarget, { x: zoomTarget.x, y: zoomTarget.y, z: zoomTarget.z, duration: 2.5, ease: 'power2.inOut' })
      }, 1500)

      // === Animation loop ===
      const animate = () => {
        if (disposed) return
        particles.rotation.y += 0.0003
        camera.lookAt(currentTarget)
        renderer.render(scene, camera)
        cssRenderer.render(cssScene, camera)
        rafId = requestAnimationFrame(animate)
      }
      rafId = requestAnimationFrame(animate)

      // === Click to toggle zoom ===
      const handleClick = (e: MouseEvent) => {
        if (disposed) return
        // If clicking on the iframe area, don't zoom out
        if ((e.target as HTMLElement).tagName === 'IFRAME') return

        if (zoomedRef.current) {
          zoomedRef.current = false
          setZoomedIn(false)
          cssRenderer.domElement.style.pointerEvents = 'none'
          gsap.to(camera.position, { ...isoPos, duration: 2, ease: 'power2.inOut' })
          gsap.to(currentTarget, { x: isoTarget.x, y: isoTarget.y, z: isoTarget.z, duration: 2, ease: 'power2.inOut' })
        } else {
          zoomedRef.current = true
          setZoomedIn(true)
          cssRenderer.domElement.style.pointerEvents = 'auto'
          gsap.to(camera.position, { ...zoomPos, duration: 2, ease: 'power2.inOut' })
          gsap.to(currentTarget, { x: zoomTarget.x, y: zoomTarget.y, z: zoomTarget.z, duration: 2, ease: 'power2.inOut' })
        }
      }
      renderer.domElement.addEventListener('click', handleClick)

      // === Resize ===
      const onResize = () => {
        if (disposed) return
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        cssRenderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true
        cancelAnimationFrame(rafId)
        window.removeEventListener('resize', onResize)
        renderer.domElement.removeEventListener('click', handleClick)
        renderer.domElement.remove()
        cssRenderer.domElement.remove()
        renderer.dispose()
        metalMat.dispose()
        darkMetalMat.dispose()
        screenMat.dispose()
        particleGeo.dispose()
        particleMat.dispose()
      }
    }

    let cleanup: (() => void) | undefined
    init().then((c) => { cleanup = c })
    return () => { cleanup?.() }
  }, [])

  return (
    <div ref={containerRef} className="relative h-svh w-full" style={{ background: 'oklch(0.06 0 0)' }}>
      {/* Loading state */}
      {!loaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: 'oklch(0.06 0 0)' }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'oklch(0.4 0.01 240)', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Hint text */}
      {loaded && (
        <div className="absolute bottom-8 left-1/2 z-30 -translate-x-1/2 text-center pointer-events-none">
          <p className="text-xs uppercase tracking-widest animate-pulse" style={{ color: 'oklch(0.4 0 0)' }}>
            {zoomedIn ? 'Click outside monitor to zoom out' : 'Click to zoom in'}
          </p>
        </div>
      )}
    </div>
  )
}
