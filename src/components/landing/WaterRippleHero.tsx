'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { Texture } from 'three'

const SIMULATION_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const SIMULATION_FRAGMENT = `
uniform sampler2D uTexture;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform vec2 uResolution;
uniform float uAspect;
varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / uResolution;
  vec4 data = texture2D(uTexture, vUv);

  float pressure = data.r;
  float velocity = data.g;

  float pLeft   = texture2D(uTexture, vUv - vec2(texel.x, 0.0)).r;
  float pRight  = texture2D(uTexture, vUv + vec2(texel.x, 0.0)).r;
  float pTop    = texture2D(uTexture, vUv - vec2(0.0, texel.y)).r;
  float pBottom = texture2D(uTexture, vUv + vec2(0.0, texel.y)).r;

  velocity += (pLeft + pRight + pTop + pBottom - 4.0 * pressure) * 0.25;
  velocity *= 0.98;
  pressure += velocity;

  vec2 adjustedUV = vec2(vUv.x * uAspect, vUv.y);
  vec2 adjustedMouse = vec2(uMouse.x * uAspect, uMouse.y);
  float dist = distance(adjustedUV, adjustedMouse);
  float radius = 0.03;

  if (dist < radius && uMouseActive > 0.5) {
    pressure += 1.2 * (1.0 - dist / radius);
  }

  float gradX = pRight - pLeft;
  float gradY = pBottom - pTop;

  gl_FragColor = vec4(pressure, velocity, gradX, gradY);
}
`

const RENDER_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const RENDER_FRAGMENT = `
uniform sampler2D uSimulation;
uniform sampler2D uBackground;
varying vec2 vUv;

void main() {
  vec4 data = texture2D(uSimulation, vUv);
  vec2 distortion = 0.3 * data.zw;
  vec2 distortedUV = vUv + distortion;

  vec4 colour = texture2D(uBackground, distortedUV);

  float rippleStrength = abs(data.r);
  if (rippleStrength > 0.1) {
    float blurAmount = min((rippleStrength - 0.1) * 0.004, 0.008);
    vec4 blurred = vec4(0.0);
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        blurred += texture2D(uBackground, distortedUV + vec2(float(i), float(j)) * blurAmount);
      }
    }
    colour = mix(colour, blurred / 25.0, 0.5);
  }

  colour.rgb *= 0.65;
  gl_FragColor = colour;
}
`

export function WaterRippleHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5, active: false })
  const rafRef = useRef<number>(0)
  const [loaded, setLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.matchMedia('(hover: none)').matches || window.innerWidth < 768)
  }, [])

  useEffect(() => {
    if (isMobile) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let disposed = false

    const init = async () => {
      const THREE = await import('three')

      const width = container.clientWidth
      const height = container.clientHeight
      const simWidth = Math.min(width, 1920) / 2
      const simHeight = Math.min(height, 1080) / 2

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: false })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const geometry = new THREE.PlaneGeometry(2, 2)

      // Render targets for ping-pong simulation
      const rtOptions = {
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        stencilBuffer: false,
        depthBuffer: false,
        generateMipmaps: false,
      }
      let targetA = new THREE.WebGLRenderTarget(simWidth, simHeight, rtOptions)
      let targetB = new THREE.WebGLRenderTarget(simWidth, simHeight, rtOptions)

      // Load background texture
      const loader = new THREE.TextureLoader()
      const bgTexture = await new Promise<Texture>((resolve) => {
        loader.load('/hero-bg.jpg', (tex) => {
          tex.minFilter = THREE.LinearFilter
          tex.magFilter = THREE.LinearFilter
          resolve(tex)
        })
      })

      if (disposed) return

      // Simulation material
      const simMaterial = new THREE.ShaderMaterial({
        vertexShader: SIMULATION_VERTEX,
        fragmentShader: SIMULATION_FRAGMENT,
        uniforms: {
          uTexture: { value: targetA.texture },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uMouseActive: { value: 0.0 },
          uResolution: { value: new THREE.Vector2(simWidth, simHeight) },
          uAspect: { value: width / height },
        },
      })

      // Render material
      const renderMaterial = new THREE.ShaderMaterial({
        vertexShader: RENDER_VERTEX,
        fragmentShader: RENDER_FRAGMENT,
        uniforms: {
          uSimulation: { value: targetB.texture },
          uBackground: { value: bgTexture },
        },
      })

      const simMesh = new THREE.Mesh(geometry, simMaterial)
      const renderMesh = new THREE.Mesh(geometry, renderMaterial)
      const simScene = new THREE.Scene()
      const renderScene = new THREE.Scene()
      simScene.add(simMesh)
      renderScene.add(renderMesh)

      setLoaded(true)

      // Animation loop
      const animate = () => {
        if (disposed) return

        // Update mouse uniform
        simMaterial.uniforms.uMouse.value.set(mouseRef.current.x, mouseRef.current.y)
        simMaterial.uniforms.uMouseActive.value = mouseRef.current.active ? 1.0 : 0.0
        mouseRef.current.active = false

        // Simulation pass: read from A, write to B
        simMaterial.uniforms.uTexture.value = targetA.texture
        renderer.setRenderTarget(targetB)
        renderer.render(simScene, camera)

        // Render pass: read simulation from B, render to screen
        renderMaterial.uniforms.uSimulation.value = targetB.texture
        renderer.setRenderTarget(null)
        renderer.render(renderScene, camera)

        // Swap targets
        const temp = targetA
        targetA = targetB
        targetB = temp

        rafRef.current = requestAnimationFrame(animate)
      }

      rafRef.current = requestAnimationFrame(animate)

      // Handle resize
      const observer = new ResizeObserver(([entry]) => {
        if (disposed) return
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        renderer.setSize(w, h)
        simMaterial.uniforms.uAspect.value = w / h
      })
      observer.observe(container)

      // Cleanup
      return () => {
        disposed = true
        cancelAnimationFrame(rafRef.current)
        observer.disconnect()
        renderer.dispose()
        targetA.dispose()
        targetB.dispose()
        bgTexture.dispose()
        geometry.dispose()
        simMaterial.dispose()
        renderMaterial.dispose()
      }
    }

    let cleanup: (() => void) | undefined
    init().then((c) => { cleanup = c })

    return () => { cleanup?.() }
  }, [isMobile])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: 1.0 - (e.clientY - rect.top) / rect.height,
      active: true,
    }
  }, [])

  return (
    <section
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className="relative h-svh w-full overflow-hidden"
      style={{ background: 'oklch(0.08 0 0)' }}
    >
      {/* WebGL Canvas */}
      {!isMobile && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.8s ease' }}
        />
      )}

      {/* Mobile fallback — static darkened background */}
      {isMobile && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/hero-bg.jpg)',
            filter: 'brightness(0.5)',
          }}
        />
      )}

      {/* Content overlay */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <Image
          src="/Logo.png"
          alt="NotRealSmart Agency"
          width={600}
          height={300}
          className="w-[min(80vw,600px)] drop-shadow-2xl"
          priority
        />

        <p className="mt-6 max-w-lg text-lg font-light tracking-wide"
          style={{ color: 'oklch(0.75 0 0)' }}
        >
          10 AI agents. Your brands. Finished marketing.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/agency/chat"
            className="inline-flex h-12 items-center justify-center rounded-lg px-8 text-sm font-semibold tracking-wide transition-all"
            style={{
              background: 'oklch(0.75 0.15 75)',
              color: 'oklch(0.1 0 0)',
            }}
          >
            Enter the Agency
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-lg border px-8 text-sm font-medium tracking-wide transition-all hover:bg-white/5"
            style={{
              borderColor: 'oklch(0.4 0 0)',
              color: 'oklch(0.7 0 0)',
            }}
          >
            Log In
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-6 w-6" style={{ color: 'oklch(0.5 0 0)' }} />
      </div>
    </section>
  )
}
