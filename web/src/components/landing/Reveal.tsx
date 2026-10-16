import { useRef, type ReactNode } from 'react'
import { useInView } from './useInView'
import { delay as d, reducedMotion } from './motion'

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref)
  const show = seen || (typeof window !== 'undefined' && reducedMotion())
  return <div ref={ref} className={`lp-reveal ${show ? 'is-in' : ''} ${className}`} style={d(delay)}>{children}</div>
}
