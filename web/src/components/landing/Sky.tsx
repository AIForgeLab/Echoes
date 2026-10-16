import type { CSSProperties } from 'react'
import GoldDust from './GoldDust'

// Ridge silhouettes for the left side of the valley; the right side is the same shape mirrored.
// Low at the page edge, rising to peaks beside the valley where the sun sets, as in the logo.
const FAR = 'M0 120 L0 98 L64 92 L126 99 L192 84 L252 90 L318 70 L372 77 L428 52 L470 40 L496 22 L528 38 L556 60 L580 92 L600 120 Z'
const NEAR = 'M0 120 L0 110 L84 104 L152 111 L232 98 L300 105 L376 90 L436 94 L492 72 L536 80 L566 100 L600 120 Z'

function Range({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={`lp-range lp-range-${side}`}>
      <div className="lp-par" style={{ '--depth': 5 } as CSSProperties}>
        <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="lp-ridge lp-ridge-far"><path d={FAR} /></svg>
      </div>
      <div className="lp-par" style={{ '--depth': 11 } as CSSProperties}>
        <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="lp-ridge lp-ridge-near"><path d={NEAR} /></svg>
      </div>
    </div>
  )
}

/**
 * The scene from the logo, opened out: a golden horizon between two mountain ranges,
 * soft light rays, still water with a reflection, and drifting dust. Decorative only.
 */
export function Sky({ variant = 'hero' }: { variant?: 'hero' | 'closing' }) {
  return (
    <div className={`lp-sky lp-sky-${variant}`} aria-hidden>
      <div className="lp-par lp-fill" style={{ '--depth': 3 } as CSSProperties}><div className="lp-rays" /></div>
      <div className="lp-glow" />
      <div className="lp-sun" />
      <Range side="left" />
      <Range side="right" />
      <div className="lp-water"><div className="lp-reflection" /></div>
      <GoldDust density={variant === 'hero' ? 1 : 0.6} className="lp-fill" />
      <div className="lp-fade" />
    </div>
  )
}

/** The official logo with a breathing portal ring, a travelling highlight and an occasional sheen. */
export function Emblem({ className = '', size = 'hero' }: { className?: string; size?: 'hero' | 'small' }) {
  return (
    <div className={`lp-emblem ${className}`} style={{ '--logo': 'url(/brand/echoes-logo-960.webp)' } as CSSProperties}>
      <div className="lp-ring" aria-hidden />
      <svg className="lp-orbit" viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="50" r="47" pathLength={1000} /></svg>
      <img
        src="/brand/echoes-logo-960.webp"
        srcSet="/brand/echoes-logo-640.webp 640w, /brand/echoes-logo-960.webp 960w"
        sizes={size === 'hero' ? '(min-width: 1024px) 500px, (min-width: 640px) 320px, 260px' : '240px'}
        width={960} height={960}
        alt="Echoes, The Living Memory Archive: a golden letter E framing a glowing portal over mountains and still water"
        fetchPriority={size === 'hero' ? 'high' : 'auto'}
        loading={size === 'hero' ? 'eager' : 'lazy'}
        decoding="async"
      />
      <div className="lp-sheen" aria-hidden />
    </div>
  )
}
