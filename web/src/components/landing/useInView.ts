import { useEffect, useState, type RefObject } from 'react'

/** Whether an element is in view. With once=true it stays true after the first time. */
export function useInView<T extends Element>(ref: RefObject<T | null>, { once = true, margin = '0px 0px -10% 0px', threshold = 0.1 } = {}) {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      if (!entry) return
      setInView(entry.isIntersecting)
      if (entry.isIntersecting && once) io.disconnect()
    }, { rootMargin: margin, threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, once, margin, threshold])
  return inView
}
