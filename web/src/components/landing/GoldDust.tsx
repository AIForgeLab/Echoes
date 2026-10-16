import { useEffect, useRef } from 'react'
import { reducedMotion } from './motion'

interface Mote { x: number; y: number; size: number; rise: number; drift: number; alpha: number; twinkle: number; phase: number }

/** Sparse golden dust rising from the horizon. One small canvas, paused while off screen or hidden. */
export default function GoldDust({ density = 1, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = reducedMotion()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    // a soft glowing dot, drawn once and reused
    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = 32
    const sctx = sprite.getContext('2d')
    if (sctx) {
      const g = sctx.createRadialGradient(16, 16, 0, 16, 16, 16)
      g.addColorStop(0, 'rgba(255, 236, 196, 1)')
      g.addColorStop(0.25, 'rgba(255, 210, 140, 0.75)')
      g.addColorStop(1, 'rgba(255, 184, 77, 0)')
      sctx.fillStyle = g
      sctx.fillRect(0, 0, 32, 32)
    }

    let w = 0, h = 0, raf = 0, last = 0, onScreen = true
    let motes: Mote[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const spawn = (anywhere: boolean): Mote => ({
      x: rand(0, w), y: anywhere ? rand(h * 0.15, h) : h + 6, size: rand(2, 7), rise: rand(5, 16), drift: rand(-4, 4),
      alpha: rand(0.25, 0.8), twinkle: rand(0.5, 1.6), phase: rand(0, Math.PI * 2),
    })

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const m of motes) {
        const fade = Math.min(1, Math.max(0, m.y / h) * 1.6) // thins out towards the top
        ctx.globalAlpha = m.alpha * fade * (0.6 + 0.4 * Math.sin(m.phase + t * m.twinkle))
        ctx.drawImage(sprite, m.x - m.size / 2, m.y - m.size / 2, m.size, m.size)
      }
      ctx.globalAlpha = 1
    }

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width; h = r.height
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(70, (w * h) / 17000) * density * (still ? 0.6 : 1))
      motes = Array.from({ length: count }, () => spawn(true))
      draw(0)
    }

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      for (const m of motes) {
        m.y -= m.rise * dt
        m.x += (m.drift + Math.sin(now / 2400 + m.phase) * 3) * dt
        if (m.y < -8) Object.assign(m, spawn(false))
      }
      draw(now / 1000)
      raf = requestAnimationFrame(frame)
    }
    const start = () => { if (!raf && !still && onScreen && !document.hidden) { last = 0; raf = requestAnimationFrame(frame) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => { onScreen = !!e?.isIntersecting; if (onScreen) start(); else stop() })
    io.observe(canvas)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [density])

  return <canvas ref={ref} aria-hidden className={`lp-dust ${className}`} />
}
