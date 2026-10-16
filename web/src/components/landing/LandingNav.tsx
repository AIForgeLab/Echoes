import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { SECTIONS, sectionLink } from './motion'

export default function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLElement>('a')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    const onWide = () => { if (window.innerWidth >= 1024) setOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onWide)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onWide) }
  }, [open])

  const close = () => setOpen(false)
  const solid = scrolled || open

  return (
    <header className={`lp-nav fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${solid ? 'is-solid' : ''}`}>
      <nav aria-label="Main" className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-5 sm:px-8">
        <a href="/" onClick={sectionLink('top', close)} className="shrink-0 rounded-lg" aria-label="Echoes home">
          <img src="/brand/echoes-lockup-120.webp" srcSet="/brand/echoes-lockup-120.webp 1x, /brand/echoes-lockup-240.webp 2x" alt="Echoes" width={120} height={110} className="h-12 w-auto" />
        </a>

        <ul className="hidden lg:flex flex-1 items-center justify-center gap-9 text-[15px] text-[#d9d1c3]">
          {SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} onClick={sectionLink(s.id)} className="lp-navlink">{s.label}</a></li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          {signedIn ? (
            <Link to="/dashboard" className="btn-primary lp-cta hidden sm:inline-flex rounded-full px-5">Open your archive<ArrowRight size={16} /></Link>
          ) : (
            <>
              <Link to="/login" className="lp-navlink hidden lg:inline text-[15px] text-[#d9d1c3]">Sign In</Link>
              <Link to="/login" className="btn-primary lp-cta hidden sm:inline-flex rounded-full px-5">Enter Your Archive</Link>
            </>
          )}
          <button ref={button} type="button" className="icon-btn lg:hidden" aria-expanded={open} aria-controls="lp-menu"
            aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <div id="lp-menu" ref={panel} hidden={!open} className="lg:hidden border-t border-[#a78040]/25 bg-[#0b0a09]/95 backdrop-blur-md">
        <ul className="mx-auto flex max-w-7xl flex-col px-5 py-3 sm:px-8">
          {SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} onClick={sectionLink(s.id, close)} className="block py-3.5 text-lg text-[#f5f0e6] border-b border-[#a78040]/15">{s.label}</a></li>
          ))}
          {signedIn ? (
            <li className="pt-4 pb-2"><Link to="/dashboard" onClick={close} className="btn-primary w-full rounded-full py-3">Open your archive</Link></li>
          ) : (
            <>
              <li><Link to="/login" onClick={close} className="block py-3.5 text-lg text-[#f5f0e6]">Sign In</Link></li>
              <li className="pt-2 pb-2"><Link to="/login" onClick={close} className="btn-primary w-full rounded-full py-3">Enter Your Archive</Link></li>
            </>
          )}
        </ul>
      </div>
      <div className="lp-nav-line" aria-hidden />
    </header>
  )
}
