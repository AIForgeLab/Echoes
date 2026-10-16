import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eraser, Feather, KeyRound, Lock, MessagesSquare, Network, Scale, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '../state/AppState'
import { data } from '../services/data'
import { useToast } from '../components/Toast'
import { DemoLabel, TruthBoundaryBadge } from '../components/ui'
import LandingNav from '../components/landing/LandingNav'
import ProductPreview from '../components/landing/ProductPreview'
import { Emblem, Sky } from '../components/landing/Sky'
import { Reveal } from '../components/landing/Reveal'
import { delay, reducedMotion, scrollToSection, SECTIONS, sectionLink } from '../components/landing/motion'
import '../landing.css'

const YEAR = new Date().getFullYear()

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="lp-eyebrow">{children}</p>
}

function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 data-section-heading tabIndex={-1} className={`font-serif font-medium text-[2.5rem] leading-[1.05] sm:text-5xl lg:text-6xl text-balance focus:outline-none ${className}`}>{children}</h2>
}

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Feather, title: 'Preserve Every Echo', text: 'Capture meaningful moments in your own words and keep them organised in a personal archive. Each one is sealed the moment you save it.' },
  { icon: Network, title: 'Explore Your Memory Map', text: 'Discover how your memories connect through shared tags, themes and dates: as a graph, a timeline, or a Renaissance memory theatre.' },
  { icon: MessagesSquare, title: 'Talk to Your Memories', text: 'Ask questions in Echo Room. Leading questions are checked against what you actually wrote before anything is answered.' },
  { icon: Scale, title: 'The Truth Boundary', text: 'Every answer is marked source-backed (quoting your exact words, which code confirms are really there), interpretation, or unknown when your memory doesn’t say.' },
  { icon: ShieldCheck, title: 'Provenance and Integrity', text: 'Each telling is hashed with SHA-256 and chained to the one before, so any later change to the stored text shows. A hash proves the text is unchanged, not that the story is true.' },
  { icon: Eraser, title: 'The Right to Forget', text: 'Forgetting deletes a memory’s facts, tags and summary and destroys its encryption key, so the stored text can no longer be read. A tombstone records that it existed.' },
]

const STEPS = [
  { n: '01', title: 'Preserve', text: 'Save the moments, stories and experiences that matter to you.' },
  { n: '02', title: 'Connect', text: 'Explore how memories relate across people, places, dates and experiences.' },
  { n: '03', title: 'Question', text: 'Ask your archive about the past. See what the evidence supports, and what remains unknown.' },
]

const PRIVACY: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Lock, title: 'Private to your account', text: 'You sign in to your own archive. Row-level security in the database means each account can read only its own memories.' },
  { icon: KeyRound, title: 'One key per memory', text: 'Your words, the facts and quotes drawn from them, and AI summaries are encrypted in your browser with the memory’s own AES-GCM key. Titles, tags, dates and themes are not, so the archive can sort and connect them.' },
  { icon: Feather, title: 'Your words stay yours', text: 'The AI never edits your original. Summaries and interpretations are always labelled and stored apart from what you wrote.' },
  { icon: Eraser, title: 'Forgetting that means it', text: 'Forget a memory and its key is destroyed, so its text can’t be decrypted again. A tombstone keeps the archive honest about what was removed.' },
  { icon: ShieldCheck, title: 'Secrets stay on the server', text: 'The AI service key lives only on the Echoes server, never in your browser. A question sends only that memory’s tellings to the AI.' },
]

function TruthExample() {
  return (
    <figure className="lp-frame p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[#a39a8c]"><ShieldCheck size={13} className="text-[#5fbf8f]" />Saved memory · sealed</p>
        <span className="rounded-full border border-[#a78040]/40 px-2 py-0.5 text-[11px] text-[#a39a8c]">Illustrative example</span>
      </div>
      <blockquote className="mt-3 font-serif text-xl leading-relaxed sm:text-2xl">“When I was ten, <mark className="lp-mark">I built my first robot with my father</mark>. That day inspired me to become an engineer.”</blockquote>
      <div className="lp-sep my-6" aria-hidden />
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#2a3140] px-4 py-2.5">Was my father an engineer?</p>
      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-[#5fbf8f]/40 bg-[#111110] p-4">
          <TruthBoundaryBadge type="said" />
          <p className="mt-2 text-[17px]">Your saved memory says you built a robot together.</p>
          <p className="mt-2 border-l-2 border-[#5fbf8f]/60 pl-3 text-sm text-[#d9d1c3]">“I built my first robot with my father” · your words, quote verified</p>
        </div>
        <div className="rounded-xl border border-[#f2b544]/40 bg-[#111110] p-4">
          <TruthBoundaryBadge type="unknown" />
          <p className="mt-2 text-[17px]">It does not establish your father’s occupation. That detail is not recorded in this memory.</p>
          <p className="mt-2 text-xs text-[#a39a8c]">Echoes won’t guess. Guessed details are how false memories form.</p>
        </div>
      </div>
      <figcaption className="mt-5 text-xs text-[#a39a8c]">A demonstration memory, not a real person’s. Real answers are generated from the memory you’re asking about.</figcaption>
    </figure>
  )
}

export default function Landing() {
  const { user } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const hero = useRef<HTMLElement>(null)
  const enter = user ? '/dashboard' : '/login'

  // Arriving with a hash (e.g. /#truth): scroll there once the page has rendered.
  useEffect(() => {
    const id = loc.hash.slice(1)
    if (id) requestAnimationFrame(() => scrollToSection(id))
  }, [loc.hash])

  // Gentle pointer parallax on the hero. Only CSS variables change, so React never re-renders.
  useEffect(() => {
    const el = hero.current
    if (!el || reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0, x = 0, y = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      x = ((e.clientX - r.left) / r.width) * 2 - 1
      y = ((e.clientY - r.top) / r.height) * 2 - 1
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty('--px', x.toFixed(3)); el.style.setProperty('--py', y.toFixed(3)) })
    }
    el.addEventListener('pointermove', onMove)
    return () => { el.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [])

  async function demo() {
    setBusy(true)
    try { await data.auth.enterDemo!(); nav('/dashboard') } catch (e) { toast('error', (e as Error).message); setBusy(false) }
  }

  return (
    <div className="lp-root min-h-screen">
      <a href="#product" onClick={sectionLink('product')} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[#f4d18e] focus:px-4 focus:py-2 focus:text-[#080807]">Skip to content</a>
      <LandingNav signedIn={!!user} />

      <main>
        {/* ---------------- Hero ---------------- */}
        <section id="top" ref={hero} className="lp-hero">
          <Sky />
          <div className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-6 px-5 pb-[250px] pt-28 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-4 lg:pb-32">
            <div className="order-2 text-center lg:order-1 lg:text-left">
              <p className="lp-eyebrow lp-rise" style={delay(0.15)}>Your personal living memory archive</p>
              <h1 className="lp-rise mt-5 font-serif text-[2.9rem] font-medium leading-[1.02] sm:text-6xl xl:text-[5.4rem] text-balance" style={delay(0.3)}>
                Your memories deserve more than <em className="lp-gold-text">a timeline.</em>
              </h1>
              <p className="lp-rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#d9d1c3] sm:text-xl lg:mx-0" style={delay(0.55)}>
                Preserve the moments that shaped you. Discover the connections between them. Ask questions of your past, and see what your memories actually support.
              </p>
              <div className="lp-rise mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start" style={delay(0.75)}>
                <Link to={enter} className="btn-primary lp-cta w-full rounded-full px-7 py-3.5 text-base sm:w-auto">Enter Your Archive<ArrowRight size={18} /></Link>
                <a href="#how" onClick={sectionLink('how')} className="btn-ghost w-full rounded-full px-7 py-3.5 text-base sm:w-auto">Discover How It Works</a>
              </div>
              <p className="lp-rise mt-6 text-sm tracking-wide text-[#a39a8c]" style={delay(0.95)}>Your memories. Your context. Your control.</p>
              {data.mode === 'demo' && !user && (
                <p className="lp-rise mt-3 flex flex-wrap items-center justify-center gap-2 text-sm lg:justify-start" style={delay(1.05)}>
                  <button onClick={demo} disabled={busy} className="text-[#f4d18e] hover:underline">{busy ? 'Preparing sample memories…' : 'Or explore the demo archive →'}</button>
                  <DemoLabel>Demo mode: data stays in this browser</DemoLabel>
                </p>
              )}
            </div>
            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <div className="lp-par lp-screen" style={{ '--depth': -9 } as CSSProperties}>
                <div className="lp-rise" style={delay(0.1)}>
                  <Emblem className="w-[min(70vw,250px)] sm:w-[320px] lg:w-[min(42vw,500px)]" />
                </div>
              </div>
            </div>
          </div>
          <a href="#product" onClick={sectionLink('product')} className="lp-scroll-cue" aria-label="Scroll to the product"><span /></a>
        </section>

        {/* ---------------- Product ---------------- */}
        <section id="product" className="relative scroll-mt-20 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="grid items-end gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Eyebrow>The archive</Eyebrow>
                <SectionTitle className="mt-4">A life is more than a collection of moments.</SectionTitle>
              </div>
              <p className="text-lg leading-relaxed text-[#a39a8c] lg:col-span-5 lg:pb-2">Echoes helps you preserve memories, explore their relationships, and revisit them with an AI that respects the difference between evidence and interpretation.</p>
            </Reveal>
            <Reveal className="mt-14" delay={0.1}><ProductPreview /></Reveal>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section aria-labelledby="lp-features" className="relative py-24 sm:py-32">
          <div className="lp-ornament mx-auto mb-20 max-w-7xl px-5 sm:px-8" aria-hidden><span /></div>
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="max-w-2xl">
              <Eyebrow>What it does</Eyebrow>
              <h2 id="lp-features" className="mt-4 font-serif text-[2.5rem] font-medium leading-[1.05] sm:text-5xl lg:text-6xl">Memory, with meaning.</h2>
            </Reveal>
            <div className="mt-14 grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 0.08} className="lp-feature">
                  <span className="lp-icon"><f.icon size={20} strokeWidth={1.5} /></span>
                  <h3 className="mt-5 font-serif text-2xl">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-[#a39a8c]">{f.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section id="how" className="relative scroll-mt-20 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="max-w-3xl">
              <Eyebrow>How it works</Eyebrow>
              <SectionTitle className="mt-4">A more thoughtful way to remember.</SectionTitle>
            </Reveal>
            <Reveal className="lp-steps relative mt-16" delay={0.05}>
              <div className="lp-path" aria-hidden />
              <ol className="relative grid gap-12 md:grid-cols-3 md:gap-10">
                {STEPS.map((s, i) => (
                  <li key={s.n} className="lp-step" style={delay(0.25 + i * 0.25)}>
                    <span className="lp-node" aria-hidden />
                    <p className="font-serif text-5xl text-[#f4d18e]/90">{s.n}</p>
                    <h3 className="mt-3 font-serif text-3xl">{s.title}</h3>
                    <p className="mt-2 max-w-sm leading-relaxed text-[#a39a8c]">{s.text}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal className="mt-14 max-w-2xl text-sm text-[#a39a8c]">
              Echoes only knows what you have saved. Until you write a memory, there is nothing for it to answer from, and it will tell you so.
            </Reveal>
          </div>
        </section>

        {/* ---------------- Truth Boundary ---------------- */}
        <section id="truth" className="lp-truth relative scroll-mt-20 py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl items-start gap-14 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <Reveal className="lg:sticky lg:top-28">
              <Eyebrow>The Truth Boundary</Eyebrow>
              <SectionTitle className="mt-4">An AI that knows when not to guess.</SectionTitle>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#a39a8c]">Memories are personal. Their meaning can be complicated. Echoes helps you explore your archive without presenting every interpretation as a fact.</p>
              <ul className="mt-10 space-y-5">
                <li className="lp-legend"><span><TruthBoundaryBadge type="said" /></span><span className="text-[#d9d1c3]"><strong className="font-medium text-[#f5f0e6]">Supported by memory.</strong> Code confirms the quote is really in your text; a second AI check confirms it supports the answer.</span></li>
                <li className="lp-legend"><span><TruthBoundaryBadge type="inferred" /></span><span className="text-[#d9d1c3]"><strong className="font-medium text-[#f5f0e6]">Interpretation.</strong> A possible reading, always labelled as not something you wrote.</span></li>
                <li className="lp-legend"><span><TruthBoundaryBadge type="unknown" /></span><span className="text-[#d9d1c3]"><strong className="font-medium text-[#f5f0e6]">Not recorded.</strong> When the memory doesn’t say, Echoes says so instead of filling the gap.</span></li>
              </ul>
            </Reveal>
            <Reveal delay={0.12}><TruthExample /></Reveal>
          </div>
        </section>

        {/* ---------------- Privacy ---------------- */}
        <section id="privacy" className="relative scroll-mt-20 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="grid gap-6 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <Eyebrow>Privacy and control</Eyebrow>
                <SectionTitle className="mt-4">Your story belongs to you.</SectionTitle>
              </div>
              <p className="text-lg leading-relaxed text-[#a39a8c] lg:col-span-5 lg:col-start-8 lg:self-end lg:pb-2">Your memories deserve care, transparency and control. Here is exactly what Echoes does, and what it doesn’t claim.</p>
            </Reveal>
            <dl className="mt-14 grid gap-x-14 sm:grid-cols-2 lg:grid-cols-3">
              {PRIVACY.map((p, i) => (
                <Reveal key={p.title} delay={(i % 3) * 0.08} className="lp-privacy">
                  <dt className="flex items-center gap-3 font-serif text-2xl"><p.icon size={18} strokeWidth={1.5} className="shrink-0 text-[#f4d18e]" />{p.title}</dt>
                  <dd className="mt-2 leading-relaxed text-[#a39a8c]">{p.text}</dd>
                </Reveal>
              ))}
              <Reveal delay={0.16} className="lp-privacy lp-limits">
                <dt className="font-serif text-2xl text-[#f4d18e]">What we don’t claim</dt>
                <dd className="mt-2 leading-relaxed text-[#a39a8c]">Echoes is not end-to-end encrypted: keys are stored in the same database, in a separate access-controlled table, so encryption mainly makes forgetting real rather than hiding data from someone with full database access. Backups made before you forget, and text already sent to the AI provider, follow those services’ own retention.</dd>
              </Reveal>
            </dl>
          </div>
        </section>

        {/* ---------------- Closing ---------------- */}
        <section aria-labelledby="lp-closing" className="lp-closing relative isolate overflow-hidden">
          <Sky variant="closing" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-[270px] pt-32 text-center sm:px-8">
            <Reveal className="lp-screen"><Emblem size="small" className="mx-auto w-[170px]" /></Reveal>
            <Reveal delay={0.1}>
              <h2 id="lp-closing" className="mt-6 font-serif text-[2.6rem] font-medium leading-[1.05] sm:text-6xl">Your story is still unfolding.</h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-[#d9d1c3]">Give your memories a place to live, connect and be understood.</p>
              <div className="mt-9 flex flex-col items-center gap-4">
                {user ? (
                  <Link to="/dashboard" className="btn-primary lp-cta rounded-full px-8 py-3.5 text-base">Open your archive<ArrowRight size={18} /></Link>
                ) : (
                  <>
                    <Link to="/signup" className="btn-primary lp-cta rounded-full px-8 py-3.5 text-base">Create Your Archive<ArrowRight size={18} /></Link>
                    <Link to="/login" className="text-sm text-[#d9d1c3] hover:text-[#f4d18e]">Already have an archive? <span className="underline decoration-[#a78040] underline-offset-4">Sign in</span></Link>
                  </>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-[#a78040]/20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <img src="/brand/echoes-lockup-240.webp" alt="Echoes" width={240} height={220} loading="lazy" className="h-20 w-auto" />
            <p className="mt-3 text-[#a39a8c]">The Living Memory Archive.</p>
          </div>
          <nav aria-label="Explore">
            <p className="text-xs uppercase tracking-[0.2em] text-[#a78040]">Explore</p>
            <ul className="mt-4 space-y-2.5">
              {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} onClick={sectionLink(s.id)} className="text-[#d9d1c3] hover:text-[#f4d18e]">{s.label}</a></li>)}
            </ul>
          </nav>
          <nav aria-label="Account">
            <p className="text-xs uppercase tracking-[0.2em] text-[#a78040]">Account</p>
            <ul className="mt-4 space-y-2.5">
              {user ? <li><Link to="/dashboard" className="text-[#d9d1c3] hover:text-[#f4d18e]">Open your archive</Link></li> : (
                <>
                  <li><Link to="/login" className="text-[#d9d1c3] hover:text-[#f4d18e]">Sign In</Link></li>
                  <li><Link to="/signup" className="text-[#d9d1c3] hover:text-[#f4d18e]">Create Account</Link></li>
                </>
              )}
            </ul>
          </nav>
        </div>
        <p className="border-t border-[#a78040]/15 py-6 text-center text-xs text-[#a39a8c]">© {YEAR} Echoes · Preserve the memory. Question the meaning. Verify the truth. Respect the right to forget.</p>
      </footer>
    </div>
  )
}
