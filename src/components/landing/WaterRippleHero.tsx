'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type * as THREE from 'three'
type Texture = THREE.Texture

// Vertex shader (shared)
const VERTEX = `
precision mediump float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Simulation fragment shader — exact wave equation from reference
const SIM_FRAGMENT = `
precision mediump float;
uniform sampler2D textureA;
uniform vec2 touches[10];
uniform int touchCount;
uniform vec2 resolution;
uniform float frame;
varying vec2 vUv;

const float delta = 1.4;

void main() {
  vec2 uv = vUv;

  if (frame < 3.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec4 currentData = texture2D(textureA, uv);
  float pressure = currentData.x;
  float pVel = currentData.y;

  vec2 texelSize = 1.0 / resolution;

  float p_right = texture2D(textureA, uv + vec2(texelSize.x, 0.0)).x;
  float p_left  = texture2D(textureA, uv - vec2(texelSize.x, 0.0)).x;
  float p_up    = texture2D(textureA, uv + vec2(0.0, texelSize.y)).x;
  float p_down  = texture2D(textureA, uv - vec2(0.0, texelSize.y)).x;

  // Boundary conditions
  if (uv.x <= texelSize.x) p_left = p_right;
  if (uv.x >= 1.0 - texelSize.x) p_right = p_left;
  if (uv.y <= texelSize.y) p_down = p_up;
  if (uv.y >= 1.0 - texelSize.y) p_up = p_down;

  // Wave equation
  pVel += delta * (-2.0 * pressure + p_right + p_left) / 4.0;
  pVel += delta * (-2.0 * pressure + p_up + p_down) / 4.0;
  pressure += delta * pVel;

  // Damping
  pVel -= 0.005 * delta * pressure;
  pVel *= 1.0 - 0.002 * delta;
  pressure *= 0.999;

  // Touch/cursor interaction
  float aspectRatio = resolution.x / resolution.y;
  for (int i = 0; i < 10; i++) {
    if (i >= touchCount) break;
    vec2 touchUV = touches[i] / resolution;
    if (touches[i].x > 0.0 && touches[i].y > 0.0) {
      vec2 adjUV = uv;
      vec2 adjTouch = touchUV;
      if (aspectRatio > 1.0) {
        adjUV.x *= aspectRatio;
        adjTouch.x *= aspectRatio;
      } else {
        adjUV.y /= aspectRatio;
        adjTouch.y /= aspectRatio;
      }
      float dist = distance(adjUV, adjTouch);
      float intensity = resolution.x <= 768.0 ? 6.0 : 1.0;
      if (dist <= 0.0275) {
        pressure += intensity * (1.0 - dist / 0.0275);
      }
    }
  }

  float gradX = (p_right - p_left) / 2.0;
  float gradY = (p_up - p_down) / 2.0;

  gl_FragColor = vec4(pressure, pVel, gradX, gradY);
}
`

// Render fragment shader — distortion + blur + specular from reference
const RENDER_FRAGMENT = `
precision mediump float;
uniform sampler2D textureA;
uniform sampler2D textureB;
uniform vec2 resolution;
uniform float initialized;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  if (initialized < 1.0) {
    gl_FragColor = texture2D(textureB, uv);
    return;
  }

  vec4 data = texture2D(textureA, uv);
  float rippleIntensity = abs(data.x);
  vec2 distortion = 0.3 * data.zw;

  vec4 color;
  if (rippleIntensity > 0.1) {
    float blurStrength = min(rippleIntensity * 3.0, 1.0);
    vec2 texelSize = 1.0 / resolution;
    vec4 blurredColor = vec4(0.0);
    float totalWeight = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize * blurStrength * 2.0;
        vec2 sampleUV = uv + distortion + offset;
        float weight = 1.0 - length(vec2(float(x), float(y))) * 0.6;
        blurredColor += texture2D(textureB, sampleUV) * weight;
        totalWeight += weight;
      }
    }
    color = blurredColor / totalWeight;
  } else {
    color = texture2D(textureB, uv + distortion);
  }

  vec3 normal = normalize(vec3(-data.z * 2.0, 0.5, -data.w * 2.0));
  vec3 lightDir = normalize(vec3(-3.0, 10.0, 3.0));
  float specular = pow(max(0.0, dot(normal, lightDir)), 60.0) * 1.5;

  vec4 highlightColor = texture2D(textureB, uv);
  highlightColor.rgb *= 1.1;
  gl_FragColor = color + highlightColor * specular;
}
`

// Clear shader — initialises render targets to zero
const CLEAR_FRAGMENT = `
void main() {
  gl_FragColor = vec4(0.0);
}
`

export function WaterRippleHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const touchMapRef = useRef<Map<string, { x: number; y: number }>>(new Map())

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

      const dpr = window.devicePixelRatio
      const width = window.innerWidth
      const height = window.innerHeight
      const simW = Math.round(width * dpr)
      const simH = Math.round(height * dpr)

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false })
      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height)
      renderer.setClearColor(0x0a0a0a, 1)
      container.appendChild(renderer.domElement)
      renderer.domElement.style.position = 'absolute'
      renderer.domElement.style.inset = '0'

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const geometry = new THREE.PlaneGeometry(2, 2)

      // Render targets — need float textures for simulation
      const gl = renderer.getContext() as WebGLRenderingContext
      const hasFloat = !!gl.getExtension('OES_texture_float')
      const rtOpts = {
        format: THREE.RGBAFormat,
        type: hasFloat ? THREE.FloatType : THREE.HalfFloatType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        stencilBuffer: false,
        depthBuffer: false,
        generateMipmaps: false,
      }

      let targetA = new THREE.WebGLRenderTarget(simW, simH, rtOpts)
      let targetB = new THREE.WebGLRenderTarget(simW, simH, rtOpts)
      const bgTarget = new THREE.WebGLRenderTarget(simW, simH, rtOpts)

      // Load background image into a canvas then to texture (same as reference)
      const bgImg = new window.Image()
      bgImg.crossOrigin = 'anonymous'

      const bgTexture = await new Promise<Texture>((resolve) => {
        bgImg.onload = () => {
          const cvs = document.createElement('canvas')
          cvs.width = simW
          cvs.height = simH
          const ctx = cvs.getContext('2d')!
          // Cover-fit the image
          const imgAspect = bgImg.width / bgImg.height
          const targetAspect = simW / simH
          let drawW: number, drawH: number, drawX: number, drawY: number
          if (imgAspect > targetAspect) {
            drawH = simH; drawW = simH * imgAspect
            drawX = (simW - drawW) / 2; drawY = 0
          } else {
            drawW = simW; drawH = simW / imgAspect
            drawX = 0; drawY = (simH - drawH) / 2
          }
          ctx.drawImage(bgImg, drawX, drawY, drawW, drawH)
          const tex = new THREE.CanvasTexture(cvs)
          tex.minFilter = THREE.LinearFilter
          tex.magFilter = THREE.LinearFilter
          resolve(tex)
        }
        bgImg.src = '/hero-bg.png'
      })

      if (disposed) return

      // Touch array (supports 10 simultaneous touches)
      const MAX_TOUCHES = 10
      const touchArray: THREE.Vector2[] = []
      for (let i = 0; i < MAX_TOUCHES; i++) touchArray.push(new THREE.Vector2(0, 0))

      // Simulation material
      const simMaterial = new THREE.ShaderMaterial({
        uniforms: {
          textureA: { value: null },
          touches: { value: touchArray },
          touchCount: { value: 0 },
          resolution: { value: new THREE.Vector2(simW, simH) },
          frame: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: SIM_FRAGMENT,
      })

      // Render material
      const renderMaterial = new THREE.ShaderMaterial({
        uniforms: {
          textureA: { value: null },
          textureB: { value: bgTexture },
          resolution: { value: new THREE.Vector2(simW, simH) },
          initialized: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: RENDER_FRAGMENT,
      })

      // Scenes
      const simScene = new THREE.Scene()
      const renderScene = new THREE.Scene()
      simScene.add(new THREE.Mesh(geometry, simMaterial))
      renderScene.add(new THREE.Mesh(geometry, renderMaterial))

      // Clear render targets
      const clearMat = new THREE.ShaderMaterial({
        vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: CLEAR_FRAGMENT,
      })
      const clearScene = new THREE.Scene()
      clearScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), clearMat))
      renderer.setRenderTarget(targetA); renderer.render(clearScene, camera)
      renderer.setRenderTarget(targetB); renderer.render(clearScene, camera)
      renderer.setRenderTarget(null)

      let frame = 0
      setLoaded(true)

      // Animation loop
      const animate = () => {
        if (disposed) return
        frame++

        // Update touch uniforms
        const touches = Array.from(touchMapRef.current.values())
        const count = Math.min(touches.length, MAX_TOUCHES)
        for (let i = 0; i < MAX_TOUCHES; i++) {
          if (i < count) {
            touchArray[i].set(touches[i].x, touches[i].y)
          } else {
            touchArray[i].set(0, 0)
          }
        }
        simMaterial.uniforms.touchCount.value = count
        simMaterial.uniforms.frame.value = frame

        // Simulation pass: read A, write B
        simMaterial.uniforms.textureA.value = targetA.texture
        renderer.setRenderTarget(targetB)
        renderer.render(simScene, camera)

        // Render pass: read sim from B + background texture, write to screen
        renderMaterial.uniforms.textureA.value = targetB.texture
        renderMaterial.uniforms.initialized.value = frame > 5 ? 1.0 : 0.0
        renderer.setRenderTarget(null)
        renderer.render(renderScene, camera)

        // Swap
        const temp = targetA
        targetA = targetB
        targetB = temp

        rafId = requestAnimationFrame(animate)
      }

      rafId = requestAnimationFrame(animate)

      // Resize handler
      const onResize = () => {
        if (disposed) return
        const w = window.innerWidth
        const h = window.innerHeight
        renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true
        cancelAnimationFrame(rafId)
        window.removeEventListener('resize', onResize)
        renderer.domElement.remove()
        renderer.dispose()
        targetA.dispose()
        targetB.dispose()
        bgTarget.dispose()
        bgTexture.dispose()
        geometry.dispose()
        simMaterial.dispose()
        renderMaterial.dispose()
        clearMat.dispose()
      }
    }

    let cleanup: (() => void) | undefined
    init().then((c) => { cleanup = c })

    return () => { cleanup?.() }
  }, [isMobile])

  // Pointer event handler — converts screen coords to simulation UV space
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio
    const simW = Math.round(rect.width * dpr)
    const simH = Math.round(rect.height * dpr)
    const x = ((e.clientX - rect.left) / rect.width) * simW
    const y = ((rect.height - (e.clientY - rect.top)) / rect.height) * simH
    touchMapRef.current.set('mouse', { x, y })
  }, [])

  const handlePointerLeave = useCallback(() => {
    touchMapRef.current.delete('mouse')
  }, [])

  return (
    <section
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative h-svh w-full overflow-hidden"
      style={{ background: 'oklch(0.08 0 0)' }}
    >
      {/* Mobile fallback */}
      {isMobile && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/hero-bg.png)', filter: 'brightness(0.4)' }}
        />
      )}

      {/* Loading state */}
      {!isMobile && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'oklch(0.08 0 0)' }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'oklch(0.4 0 0)', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Content overlay */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="flex flex-col items-center gap-2 leading-none">
          {/* Line 1: NOTREAL (Artificial) */}
          <div className="flex items-baseline gap-3 md:gap-5">
            <span
              className="font-extrabold uppercase"
              style={{
                fontSize: 'clamp(2.8rem, 9vw, 7rem)',
                letterSpacing: '0.08em',
                backgroundImage: 'linear-gradient(170deg, oklch(0.75 0.04 70) 0%, oklch(0.55 0.03 60) 35%, oklch(0.35 0.02 50) 65%, oklch(0.5 0.04 65) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 0 oklch(0.2 0 0)) drop-shadow(0 4px 8px oklch(0 0 0 / 0.7))',
              }}
            >
              NotReal
            </span>
            <span
              className="font-light italic tracking-wide"
              style={{
                fontSize: 'clamp(0.9rem, 2.5vw, 1.8rem)',
                color: 'oklch(0.5 0.1 50)',
                textShadow: '0 1px 3px oklch(0 0 0 / 0.5)',
              }}
            >
              (Artificial)
            </span>
          </div>
          {/* Line 2: SMART (Intelligence) */}
          <div className="flex items-baseline gap-3 md:gap-5">
            <span
              className="font-extrabold uppercase"
              style={{
                fontSize: 'clamp(2.8rem, 9vw, 7rem)',
                letterSpacing: '0.08em',
                backgroundImage: 'linear-gradient(170deg, oklch(0.75 0.04 70) 0%, oklch(0.55 0.03 60) 35%, oklch(0.35 0.02 50) 65%, oklch(0.5 0.04 65) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 2px 0 oklch(0.2 0 0)) drop-shadow(0 4px 8px oklch(0 0 0 / 0.7))',
              }}
            >
              Smart
            </span>
            <span
              className="font-light italic tracking-wide"
              style={{
                fontSize: 'clamp(0.9rem, 2.5vw, 1.8rem)',
                color: 'oklch(0.5 0.1 50)',
                textShadow: '0 1px 3px oklch(0 0 0 / 0.5)',
              }}
            >
              (Intelligence)
            </span>
          </div>
        </h1>

        <p className="mt-8 text-xl font-semibold uppercase tracking-[0.2em] md:text-2xl" style={{ color: 'oklch(0.72 0.1 65)' }}>
          Agentic Marketing Agency
        </p>

        <p className="mt-4 max-w-xl text-base font-light leading-relaxed md:text-lg" style={{ color: 'oklch(0.6 0 0)' }}>
          In the fast-changing world of AI — we aim to use tomorrow&apos;s AI to market your business or idea.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/agency/chat"
            className="inline-flex h-12 items-center justify-center rounded-lg px-8 text-sm font-semibold uppercase tracking-widest transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, oklch(0.65 0.12 65), oklch(0.5 0.08 55))',
              color: 'oklch(0.95 0 0)',
              boxShadow: '0 0 20px oklch(0.5 0.1 60 / 0.3)',
            }}
          >
            Enter the Agency
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-lg border px-8 text-sm font-medium uppercase tracking-widest transition-all hover:bg-white/5"
            style={{ borderColor: 'oklch(0.35 0.05 60)', color: 'oklch(0.6 0.03 70)' }}
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
