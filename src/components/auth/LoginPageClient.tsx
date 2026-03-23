'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type * as THREE from 'three'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OAuthButtons } from './OAuthButtons'

export function LoginPageClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formVisible, setFormVisible] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/agency/chat'
  const containerRef = useRef<HTMLDivElement>(null)
  const touchMapRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [isMobile, setIsMobile] = useState(false)
  const [rippleReady, setRippleReady] = useState(false)

  useEffect(() => {
    setIsMobile(window.matchMedia('(hover: none)').matches || window.innerWidth < 768)
    // Show form after a beat
    const t = setTimeout(() => setFormVisible(true), 600)
    return () => clearTimeout(t)
  }, [])

  // Water ripple WebGL effect (same shader as hero)
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

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height)
      renderer.setClearColor(0x0a0a0a, 1)
      container.appendChild(renderer.domElement)
      Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', zIndex: '0' })

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const geometry = new THREE.PlaneGeometry(2, 2)

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

      // Dark gradient texture instead of hero image
      const cvs = document.createElement('canvas')
      cvs.width = simW
      cvs.height = simH
      const ctx = cvs.getContext('2d')!
      const grad = ctx.createRadialGradient(simW / 2, simH / 2, 0, simW / 2, simH / 2, simW * 0.7)
      grad.addColorStop(0, '#1a1a2e')
      grad.addColorStop(0.5, '#0f0f1a')
      grad.addColorStop(1, '#050508')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, simW, simH)
      const bgTexture = new THREE.CanvasTexture(cvs)
      bgTexture.minFilter = THREE.LinearFilter
      bgTexture.magFilter = THREE.LinearFilter

      if (disposed) return

      const MAX_TOUCHES = 10
      const touchArray: THREE.Vector2[] = []
      for (let i = 0; i < MAX_TOUCHES; i++) touchArray.push(new THREE.Vector2(0, 0))

      const VERTEX = `precision mediump float; varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

      const SIM_FRAG = `precision mediump float;
uniform sampler2D textureA; uniform vec2 touches[10]; uniform int touchCount; uniform vec2 resolution; uniform float frame; varying vec2 vUv;
const float delta = 1.4;
void main() {
  vec2 uv = vUv;
  if (frame < 3.0) { gl_FragColor = vec4(0.0); return; }
  vec4 d = texture2D(textureA, uv); float p = d.x; float v = d.y;
  vec2 ts = 1.0 / resolution;
  float pr = texture2D(textureA, uv + vec2(ts.x, 0.0)).x;
  float pl = texture2D(textureA, uv - vec2(ts.x, 0.0)).x;
  float pu = texture2D(textureA, uv + vec2(0.0, ts.y)).x;
  float pd = texture2D(textureA, uv - vec2(0.0, ts.y)).x;
  if (uv.x <= ts.x) pl = pr; if (uv.x >= 1.0 - ts.x) pr = pl;
  if (uv.y <= ts.y) pd = pu; if (uv.y >= 1.0 - ts.y) pu = pd;
  v += delta * (-2.0 * p + pr + pl) / 4.0;
  v += delta * (-2.0 * p + pu + pd) / 4.0;
  p += delta * v;
  v -= 0.005 * delta * p; v *= 1.0 - 0.002 * delta; p *= 0.999;
  float ar = resolution.x / resolution.y;
  for (int i = 0; i < 10; i++) {
    if (i >= touchCount) break;
    vec2 tuv = touches[i] / resolution;
    if (touches[i].x > 0.0 && touches[i].y > 0.0) {
      vec2 a = uv; vec2 b = tuv;
      if (ar > 1.0) { a.x *= ar; b.x *= ar; } else { a.y /= ar; b.y /= ar; }
      float dist = distance(a, b);
      if (dist <= 0.0275) p += 1.5 * (1.0 - dist / 0.0275);
    }
  }
  gl_FragColor = vec4(p, v, (pr - pl) / 2.0, (pu - pd) / 2.0);
}`

      const RENDER_FRAG = `precision mediump float;
uniform sampler2D textureA; uniform sampler2D textureB; uniform vec2 resolution; uniform float initialized; varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  if (initialized < 1.0) { gl_FragColor = texture2D(textureB, uv); return; }
  vec4 d = texture2D(textureA, uv);
  vec2 dist = 0.3 * d.zw;
  vec4 color = texture2D(textureB, uv + dist);
  vec3 n = normalize(vec3(-d.z * 2.0, 0.5, -d.w * 2.0));
  vec3 ld = normalize(vec3(-3.0, 10.0, 3.0));
  float spec = pow(max(0.0, dot(n, ld)), 60.0) * 1.5;
  vec4 hl = texture2D(textureB, uv); hl.rgb *= 1.1;
  gl_FragColor = color + hl * spec;
}`

      const simMat = new THREE.ShaderMaterial({
        uniforms: { textureA: { value: null }, touches: { value: touchArray }, touchCount: { value: 0 }, resolution: { value: new THREE.Vector2(simW, simH) }, frame: { value: 0 } },
        vertexShader: VERTEX, fragmentShader: SIM_FRAG,
      })
      const renderMat = new THREE.ShaderMaterial({
        uniforms: { textureA: { value: null }, textureB: { value: bgTexture }, resolution: { value: new THREE.Vector2(simW, simH) }, initialized: { value: 0 } },
        vertexShader: VERTEX, fragmentShader: RENDER_FRAG,
      })

      const simScene = new THREE.Scene()
      const renderScene = new THREE.Scene()
      simScene.add(new THREE.Mesh(geometry, simMat))
      renderScene.add(new THREE.Mesh(geometry, renderMat))

      const clearMat = new THREE.ShaderMaterial({ vertexShader: `void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`, fragmentShader: `void main(){gl_FragColor=vec4(0.0);}` })
      const clearScene = new THREE.Scene()
      clearScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), clearMat))
      renderer.setRenderTarget(targetA); renderer.render(clearScene, camera)
      renderer.setRenderTarget(targetB); renderer.render(clearScene, camera)
      renderer.setRenderTarget(null)

      let frame = 0
      setRippleReady(true)

      const animate = () => {
        if (disposed) return
        frame++
        const touches = Array.from(touchMapRef.current.values())
        const count = Math.min(touches.length, MAX_TOUCHES)
        for (let i = 0; i < MAX_TOUCHES; i++) {
          if (i < count) touchArray[i].set(touches[i].x, touches[i].y)
          else touchArray[i].set(0, 0)
        }
        simMat.uniforms.touchCount.value = count
        simMat.uniforms.frame.value = frame
        simMat.uniforms.textureA.value = targetA.texture
        renderer.setRenderTarget(targetB); renderer.render(simScene, camera)
        renderMat.uniforms.textureA.value = targetB.texture
        renderMat.uniforms.initialized.value = frame > 5 ? 1.0 : 0.0
        renderer.setRenderTarget(null); renderer.render(renderScene, camera)
        const temp = targetA; targetA = targetB; targetB = temp
        rafId = requestAnimationFrame(animate)
      }
      rafId = requestAnimationFrame(animate)

      const onResize = () => { if (!disposed) renderer.setSize(window.innerWidth, window.innerHeight) }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true; cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize)
        renderer.domElement.remove(); renderer.dispose(); targetA.dispose(); targetB.dispose()
        bgTexture.dispose(); geometry.dispose(); simMat.dispose(); renderMat.dispose(); clearMat.dispose()
      }
    }

    let cleanup: (() => void) | undefined
    init().then((c) => { cleanup = c })
    return () => { cleanup?.() }
  }, [isMobile])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio
    const simW = Math.round(rect.width * dpr)
    const simH = Math.round(rect.height * dpr)
    touchMapRef.current.set('mouse', {
      x: ((e.clientX - rect.left) / rect.width) * simW,
      y: ((rect.height - (e.clientY - rect.top)) / rect.height) * simH,
    })
  }, [])

  const handlePointerLeave = useCallback(() => { touchMapRef.current.delete('mouse') }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push(redirect)
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative min-h-svh w-full overflow-hidden"
      style={{ background: 'oklch(0.06 0 0)' }}
    >
      {/* Mobile fallback — dark gradient */}
      {isMobile && (
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, oklch(0.12 0.005 240) 0%, oklch(0.06 0 0) 70%)',
        }} />
      )}

      {/* Content */}
      <div className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6">
        {/* Big logo */}
        <div
          className="mb-10 transition-all duration-1000"
          style={{
            opacity: rippleReady || isMobile ? 1 : 0,
            transform: rippleReady || isMobile ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          }}
        >
          <Image
            src="/Logo.png"
            alt="NotRealSmart Agency"
            width={480}
            height={480}
            className="w-[280px] md:w-[400px] lg:w-[480px] h-auto drop-shadow-2xl"
            priority
          />
        </div>

        {/* Login form — frosted glass */}
        <div
          className="w-full max-w-sm transition-all duration-700"
          style={{
            opacity: formVisible ? 1 : 0,
            transform: formVisible ? 'translateY(0)' : 'translateY(30px)',
          }}
        >
          <div
            className="rounded-2xl border p-8"
            style={{
              background: 'oklch(0.1 0.005 240 / 0.4)',
              backdropFilter: 'blur(16px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
              borderColor: 'oklch(0.25 0.01 240 / 0.3)',
              boxShadow: '0 8px 32px oklch(0 0 0 / 0.4), inset 0 1px 0 oklch(0.4 0.01 240 / 0.08)',
            }}
          >
            {error && (
              <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: 'oklch(0.2 0.05 25 / 0.3)', color: 'oklch(0.75 0.15 25)' }}>
                {error}
              </div>
            )}

            <OAuthButtons />

            {/* Divider */}
            <div className="relative my-6">
              <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, oklch(0.3 0.01 240 / 0.5), transparent)' }} />
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs"
                style={{ background: 'oklch(0.1 0.005 240 / 0.6)', color: 'oklch(0.45 0 0)' }}
              >
                or continue with email
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider" style={{ color: 'oklch(0.55 0 0)' }}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[oklch(0.5_0.01_240)]"
                  style={{
                    background: 'oklch(0.08 0 0 / 0.6)',
                    borderColor: 'oklch(0.2 0.005 240 / 0.4)',
                    color: 'oklch(0.9 0 0)',
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium uppercase tracking-wider" style={{ color: 'oklch(0.55 0 0)' }}>
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-xs transition-colors hover:text-white" style={{ color: 'oklch(0.4 0 0)' }}>
                    Forgot?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[oklch(0.5_0.01_240)]"
                  style={{
                    background: 'oklch(0.08 0 0 / 0.6)',
                    borderColor: 'oklch(0.2 0.005 240 / 0.4)',
                    color: 'oklch(0.9 0 0)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 text-xs font-semibold uppercase tracking-widest transition-all hover:brightness-125 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, oklch(0.75 0.005 250), oklch(0.5 0.008 240))',
                  color: 'oklch(0.06 0 0)',
                  boxShadow: '0 0 20px oklch(0.5 0.01 240 / 0.2)',
                }}
              >
                {loading ? 'Signing in...' : 'Enter the Agency'}
              </button>
            </form>

            <p className="mt-5 text-center text-xs" style={{ color: 'oklch(0.4 0 0)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium transition-colors hover:text-white" style={{ color: 'oklch(0.6 0.01 240)' }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
