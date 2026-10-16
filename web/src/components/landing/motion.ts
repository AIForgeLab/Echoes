import type { CSSProperties, MouseEvent } from 'react'

export const SECTIONS = [
  { id: 'product', label: 'Product' },
  { id: 'how', label: 'How It Works' },
  { id: 'truth', label: 'Truth Boundary' },
  { id: 'privacy', label: 'Privacy' },
] as const

/** True when the visitor asked for less motion, in the OS or in Echoes' own settings. */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Inline animation delay for .lp-rise / .lp-reveal. */
export const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties

/** Smooth-scroll to a landing section, keep the URL hash in sync and move focus to its heading. */
export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  window.history.replaceState(window.history.state, '', id === 'top' ? window.location.pathname : `#${id}`)
  el.querySelector<HTMLElement>('[data-section-heading]')?.focus({ preventScroll: true })
}

/** onClick for an in-page link: scroll smoothly instead of jumping, then run `after` (e.g. close a menu). */
export function sectionLink(id: string, after?: () => void) {
  return (e: MouseEvent) => { e.preventDefault(); scrollToSection(id); after?.() }
}
