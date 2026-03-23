'use client'

import { useRef, useEffect, useState } from 'react'
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

      // === Shared camera ===
      const camera = new THREE.PerspectiveCamera(50, width / height, 1, 5000)
      camera.position.set(600, 400, 800)

      // === Shared scene (both renderers use the same scene) ===
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0a0a0e)

      // === CSS3D Renderer (renders FIRST — behind WebGL) ===
      const cssRenderer = new CSS3DRenderer()
      cssRenderer.setSize(width, height)
      container.appendChild(cssRenderer.domElement)

      // === WebGL Renderer (renders ON TOP with alpha, pointerEvents none) ===
      const glRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      glRenderer.domElement.style.position = 'absolute'
      glRenderer.domElement.style.top = '0'
      glRenderer.domElement.style.pointerEvents = 'none'
      glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      glRenderer.setSize(width, height)
      container.appendChild(glRenderer.domElement)

      // === Controls div (on top of everything for orbit) ===
      const controlsDiv = document.createElement('div')
      controlsDiv.style.position = 'absolute'
      controlsDiv.style.inset = '0'
      container.appendChild(controlsDiv)

      // === Lighting ===
      scene.add(new THREE.HemisphereLight(0xbbbbcc, 0x333344, 3))
      const dirLight = new THREE.DirectionalLight(0xffffff, 2)
      dirLight.position.set(200, 400, 300)
      scene.add(dirLight)
      const warmPoint = new THREE.PointLight(0xffaa66, 1.5, 1500)
      warmPoint.position.set(-300, 300, 200)
      scene.add(warmPoint)

      // === Monitor screen dimensions (in world units matching CSS3D pixels) ===
      const screenW = 800
      const screenH = 600

      // === CSS3D iframe — the content on the monitor ===
      const iframe = document.createElement('iframe')
      iframe.src = '/about/content'
      iframe.style.width = screenW + 'px'
      iframe.style.height = screenH + 'px'
      iframe.style.border = 'none'
      iframe.style.background = '#111'
      iframe.style.backfaceVisibility = 'hidden'
      const cssObject = new CSS3DObject(iframe)
      cssObject.position.set(0, 250, 0)
      scene.add(cssObject)

      // === Cutout mesh (creates a hole in the WebGL layer so CSS3D shows through) ===
      const cutoutGeo = new THREE.PlaneGeometry(screenW, screenH)
      const cutoutMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        blending: THREE.NoBlending,
        opacity: 0,
        premultipliedAlpha: true,
      })
      const cutout = new THREE.Mesh(cutoutGeo, cutoutMat)
      cutout.position.copy(cssObject.position)
      scene.add(cutout)

      // === Monitor frame (extruded border around the screen) ===
      const frameThickness = 40
      const outerShape = new THREE.Shape()
      const hw = screenW / 2 + frameThickness
      const hh = screenH / 2 + frameThickness
      outerShape.moveTo(-hw, -hh)
      outerShape.lineTo(hw, -hh)
      outerShape.lineTo(hw, hh)
      outerShape.lineTo(-hw, hh)
      outerShape.lineTo(-hw, -hh)
      const hole = new THREE.Path()
      hole.moveTo(-screenW / 2, -screenH / 2)
      hole.lineTo(screenW / 2, -screenH / 2)
      hole.lineTo(screenW / 2, screenH / 2)
      hole.lineTo(-screenW / 2, screenH / 2)
      hole.lineTo(-screenW / 2, -screenH / 2)
      outerShape.holes.push(hole)
      const frameGeo = new THREE.ExtrudeGeometry(outerShape, { depth: 60, bevelEnabled: false })
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9, roughness: 0.3 })
      const frame = new THREE.Mesh(frameGeo, frameMat)
      frame.position.set(0, 250, -30)
      scene.add(frame)

      // === Monitor back panel ===
      const backGeo = new THREE.PlaneGeometry(screenW + frameThickness * 2, screenH + frameThickness * 2)
      const backMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.4 })
      const back = new THREE.Mesh(backGeo, backMat)
      back.position.set(0, 250, -31)
      back.rotation.y = Math.PI
      scene.add(back)

      // === Monitor stand ===
      const standGeo = new THREE.BoxGeometry(80, 200, 80)
      const standMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.85, roughness: 0.3 })
      const stand = new THREE.Mesh(standGeo, standMat)
      stand.position.set(0, 50, -10)
      scene.add(stand)

      // === Desk ===
      const deskGeo = new THREE.BoxGeometry(1400, 30, 600)
      const deskMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.35 })
      const desk = new THREE.Mesh(deskGeo, deskMat)
      desk.position.set(0, -65, 0)
      scene.add(desk)

      // === Desk legs ===
      const legGeo = new THREE.BoxGeometry(30, 300, 30)
      const legMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.3 })
      const legPositions = [[-650, -215, -250], [650, -215, -250], [-650, -215, 250], [650, -215, 250]]
      legPositions.forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legGeo, legMat)
        leg.position.set(x, y, z)
        scene.add(leg)
      })

      // === Keyboard ===
      const kbGeo = new THREE.BoxGeometry(300, 10, 100)
      const kbMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.4 })
      const kb = new THREE.Mesh(kbGeo, kbMat)
      kb.position.set(0, -48, 200)
      scene.add(kb)

      // === Floor ===
      const floorGeo = new THREE.PlaneGeometry(5000, 5000)
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x181820, metalness: 0.3, roughness: 0.9 })
      const floor = new THREE.Mesh(floorGeo, floorMat)
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -365
      scene.add(floor)

      // === Floating particles ===
      const particleCount = 200
      const pPositions = new Float32Array(particleCount * 3)
      for (let i = 0; i < particleCount * 3; i++) pPositions[i] = (Math.random() - 0.5) * 3000
      const pGeo = new THREE.BufferGeometry()
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
      const pMat = new THREE.PointsMaterial({ size: 3, color: 0x667788, transparent: true, opacity: 0.4 })
      const particles = new THREE.Points(pGeo, pMat)
      scene.add(particles)

      if (disposed) return
      setLoaded(true)

      // === Camera targets ===
      const isoPos = new THREE.Vector3(600, 400, 800)
      const zoomPos = new THREE.Vector3(0, 250, 700)
      const lookTarget = new THREE.Vector3(0, 250, 0)
      const currentLook = lookTarget.clone()

      // Auto-zoom into monitor after delay
      setTimeout(() => {
        if (disposed) return
        zoomedRef.current = true
        setZoomedIn(true)
        iframe.style.pointerEvents = 'auto'
        gsap.to(camera.position, { x: zoomPos.x, y: zoomPos.y, z: zoomPos.z, duration: 2.5, ease: 'power2.inOut' })
      }, 2000)

      // === Click to toggle zoom ===
      const handleClick = (e: MouseEvent) => {
        if (disposed) return
        if ((e.target as HTMLElement).tagName === 'IFRAME') return

        if (zoomedRef.current) {
          zoomedRef.current = false
          setZoomedIn(false)
          iframe.style.pointerEvents = 'none'
          gsap.to(camera.position, { x: isoPos.x, y: isoPos.y, z: isoPos.z, duration: 2, ease: 'power2.inOut' })
        } else {
          zoomedRef.current = true
          setZoomedIn(true)
          iframe.style.pointerEvents = 'auto'
          gsap.to(camera.position, { x: zoomPos.x, y: zoomPos.y, z: zoomPos.z, duration: 2, ease: 'power2.inOut' })
        }
      }
      controlsDiv.addEventListener('click', handleClick)

      // === Animation loop ===
      const animate = () => {
        if (disposed) return
        particles.rotation.y += 0.0002
        camera.lookAt(currentLook)
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
  }, [])

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
