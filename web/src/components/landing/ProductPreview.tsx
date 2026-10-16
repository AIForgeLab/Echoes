import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Lock, Search, ShieldCheck } from 'lucide-react'
import { TruthBoundaryBadge } from '../ui'
import { useInView } from './useInView'
import { reducedMotion } from './motion'

// Illustrative previews built from the app's own sample archive (the demo memories and their artwork).

const TABS = [
  { id: 'echoes', title: 'My Echoes', path: '/echoes', desc: 'Every memory in your own words, sealed the moment you save it.' },
  { id: 'map', title: 'Memory Map', path: '/memory-map', desc: 'Connections drawn only from shared tags, themes and dates.' },
  { id: 'room', title: 'Echo Room', path: '/echoes/…/chat', desc: 'Ask your memory questions. Every answer shows its evidence.' },
  { id: 'xray', title: 'Tellings X-ray', path: '/echoes/…?tab=tellings', desc: 'Retell a memory years later and see exactly what drifted.' },
] as const
type TabId = (typeof TABS)[number]['id']
const ADVANCE_MS = 7000

function Chip({ children }: { children: string }) {
  return <span className="rounded-full border border-[#5c4528]/70 bg-[#171614] px-2 py-0.5 text-[11px] text-[#d9d1c3]">#{children}</span>
}

const CARDS = [
  { title: 'My First Robot', meta: 'Jan 12, 2024 · Projects', img: '/art/robot.jpg', tags: ['childhood', 'robot'], tellings: 2 },
  { title: 'Trip to the Mountains', meta: 'Mar 3, 2024 · Travel', img: '/art/mountains.jpg', tags: ['travel', 'nature'], tellings: 1 },
  { title: 'Learning to Code', meta: 'Feb 18, 2024 · Learning', img: '/art/library.jpg', tags: ['coding', 'growth'], tellings: 1 },
]

function EchoesPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-[#5c4528]/60 bg-[#171614] px-3 py-2 text-sm text-[#a39a8c]"><Search size={15} />Search your echoes</div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {['All', 'Personal', 'Learning', 'Projects', 'Travel'].map((c, i) => (
          <span key={c} className={`rounded-full border px-3 py-1 ${i === 0 ? 'border-[#f4d18e] bg-[#f4d18e] text-[#080807]' : 'border-[#5c4528]/70 text-[#a39a8c]'}`}>{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CARDS.map((c, i) => (
          <div key={c.title} className={`overflow-hidden rounded-xl border border-[#5c4528]/60 bg-[#111110] ${i === 2 ? 'hidden sm:block' : ''}`}>
            <img src={c.img} alt="" loading="lazy" className="h-24 w-full object-cover sm:h-28" />
            <div className="space-y-1.5 p-3">
              <p className="font-serif text-lg leading-tight">{c.title}</p>
              <p className="text-[11px] text-[#a39a8c]">{c.meta}{c.tellings > 1 && ' · 2 tellings'}</p>
              <div className="flex flex-wrap gap-1">{c.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
              <p className="flex items-center gap-1 pt-1 text-[11px] text-[#5fbf8f]"><Lock size={11} />Encrypted · sealed</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const NODES = [
  { id: 'robot', label: 'My First Robot', x: 250, y: 180, img: '/art/robot.jpg', r: 34, side: true },
  { id: 'fair', label: 'Science Fair', x: 92, y: 92, img: '/art/science-fair.jpg', r: 26 },
  { id: 'school', label: 'School Project', x: 110, y: 290, img: '/art/school-project.jpg', r: 26 },
  { id: 'code', label: 'Learning to Code', x: 330, y: 318, img: '/art/library.jpg', r: 26 },
  { id: 'mount', label: 'Trip to the Mountains', x: 470, y: 96, img: '/art/mountains.jpg', r: 28 },
  { id: 'stars', label: 'Stargazing Night', x: 540, y: 250, img: '/art/stars.jpg', r: 24 },
]
// Each line matches a real link in the sample archive: a shared tag, or the same theme.
const EDGES: [string, string, string][] = [
  ['robot', 'fair', '#robot'], ['fair', 'school', '#school'], ['school', 'code', '#coding'], ['robot', 'school', 'Projects'], ['mount', 'stars', '#nature'],
]

function MapPanel({ active, load }: { active: boolean; load: boolean }) {
  const at = (id: string) => NODES.find((n) => n.id === id)!
  return (
    <div>
      <svg viewBox="0 0 620 370" className={`lp-map h-auto max-h-[360px] w-full ${active ? 'is-on' : ''}`} role="img" aria-label="Sample memory map: My First Robot connects to Science Fair through the robot tag; Science Fair to School Project through school; School Project to Learning to Code through coding; Trip to the Mountains to Stargazing Night through nature.">
        <defs>{NODES.map((n) => <clipPath key={n.id} id={`lp-clip-${n.id}`}><circle cx={n.x} cy={n.y} r={n.r} /></clipPath>)}</defs>
        {EDGES.map(([a, b, label], i) => {
          const p = at(a), q = at(b)
          return (
            <g key={i}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="lp-edge" pathLength={1} style={{ transitionDelay: `${0.15 * i}s` }} />
              <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 6} textAnchor="middle" className="fill-[#d9b46e] text-[12px]">{label}</text>
            </g>
          )
        })}
        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r + 3} className="fill-[#111110] stroke-[#f4d18e]/70" strokeWidth={1.2} />
            {load && <image href={n.img} x={n.x - n.r} y={n.y - n.r} width={n.r * 2} height={n.r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#lp-clip-${n.id})`} />}
            {'side' in n
              ? <text x={n.x + n.r + 10} y={n.y + 5} textAnchor="start" className="fill-[#f5f0e6] font-serif text-[15px]">{n.label}</text>
              : <text x={n.x} y={n.y + n.r + 18} textAnchor="middle" className="fill-[#f5f0e6] font-serif text-[15px]">{n.label}</text>}
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-[#a39a8c]">Lines come from your own tags, themes and dates, never from guesses.</p>
    </div>
  )
}

const ORIGINAL = ['When I was ten, I built my first robot with my father. It was raining, so we worked in the garage. ', 'That day inspired me to become an engineer.']

function RoomPanel() {
  return (
    <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-xl border border-[#5c4528]/60 bg-[#111110] p-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#a39a8c]"><ShieldCheck size={13} className="text-[#5fbf8f]" />The original · sealed</p>
        <p className="mt-3 font-serif text-lg leading-relaxed">{ORIGINAL[0]}<mark className="rounded bg-[#5fbf8f]/20 px-0.5 text-[#f5f0e6] ring-1 ring-[#5fbf8f]/50">{ORIGINAL[1]}</mark></p>
      </div>
      <div className="space-y-3 text-sm">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#2a3140] px-3.5 py-2">Why was this moment important?</p>
        <div className="rounded-xl border border-[#5fbf8f]/40 bg-[#111110] p-3">
          <TruthBoundaryBadge type="said" />
          <p className="mt-2">It inspired you to become an engineer.</p>
          <p className="mt-2 border-l-2 border-[#5fbf8f]/60 pl-2 text-xs text-[#d9d1c3]">“That day inspired me to become an engineer” · quote verified</p>
        </div>
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#2a3140] px-3.5 py-2">Was Dad proud when the robot won?</p>
        <div className="rounded-xl border border-[#f2b544]/50 bg-[#f2b544]/5 p-3">
          <p className="text-xs font-medium text-[#f2b544]">Assumption check</p>
          <p className="mt-1">Your question assumes <em>“the robot won”</em>, but this telling doesn’t mention it… but your <strong>Telling 2 · 2026</strong> retelling does: “We won”.</p>
        </div>
      </div>
    </div>
  )
}

const DRIFT = [
  { k: 'Kept', c: 'text-[#5fbf8f] border-[#5fbf8f]/40', t: 'You were ten' },
  { k: 'Changed', c: 'text-[#f2b544] border-[#f2b544]/40', t: 'Your father helped you → Dad and Uncle Raj helped you' },
  { k: 'Faded away', c: 'text-[#a39a8c] border-[#a39a8c]/40', t: 'It was raining' },
  { k: 'Faded away', c: 'text-[#a39a8c] border-[#a39a8c]/40', t: 'You worked in the garage' },
  { k: 'Appeared later', c: 'text-[#a593f0] border-[#a593f0]/40', t: 'The robot was for a school competition' },
  { k: 'Appeared later', c: 'text-[#a593f0] border-[#a593f0]/40', t: 'You won the competition' },
]

function XrayPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#a39a8c]"><span className="text-[#f5f0e6]">Telling 1 · 2024</span> underneath, <span className="text-[#f5f0e6]">Telling 2 · 2026</span> on the surface. Both stay sealed; nothing is overwritten.</p>
      <ul className="space-y-2">
        {DRIFT.map((d, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-[#5c4528]/50 bg-[#111110] px-3 py-2.5 text-sm">
            <span className={`mt-0.5 w-28 shrink-0 rounded-full border px-2 py-0.5 text-center text-[10px] uppercase tracking-wider ${d.c}`}>{d.k}</span>
            <span className={d.k === 'Faded away' ? 'text-[#a39a8c] line-through decoration-[#a39a8c]/50' : ''}>{d.t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ProductPreview() {
  const [active, setActive] = useState<TabId>('echoes')
  const [auto, setAuto] = useState(true)
  const root = useRef<HTMLDivElement>(null)
  const visible = useInView(root, { once: false, threshold: 0.35 })
  // SVG images can't use loading="lazy", so the map's artwork waits until the preview is near.
  const near = useInView(root, { margin: '400px 0px' })
  // Auto-advance only on wider screens, where the frame keeps a fixed height while panels change.
  const playing = auto && visible && !reducedMotion() && window.matchMedia('(min-width: 768px)').matches

  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => {
      setActive((a) => TABS[(TABS.findIndex((x) => x.id === a) + 1) % TABS.length]!.id)
    }, ADVANCE_MS)
    return () => window.clearTimeout(t)
  }, [playing, active])

  const choose = (id: TabId) => { setAuto(false); setActive(id) }
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === active)
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : null
    if (next == null) return
    e.preventDefault()
    const id = TABS[(next + TABS.length) % TABS.length]!.id
    choose(id)
    root.current?.querySelector<HTMLElement>(`#lp-tab-${id}`)?.focus()
  }
  const current = TABS.find((t) => t.id === active)!

  return (
    <div ref={root} className="grid gap-6 lg:grid-cols-[280px_1fr] lg:gap-10">
      <div role="tablist" aria-label="Product preview" aria-orientation="vertical" onKeyDown={onKey}
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
        {TABS.map((t, i) => (
          <button key={t.id} id={`lp-tab-${t.id}`} role="tab" type="button" aria-selected={active === t.id} aria-controls={`lp-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1} onClick={() => choose(t.id)}
            className={`lp-tab shrink-0 text-left ${active === t.id ? 'is-active' : ''}`}>
            <span className="flex items-baseline gap-3">
              <span className="font-serif text-sm text-[#a78040]">0{i + 1}</span>
              <span className="font-serif text-xl lg:text-2xl">{t.title}</span>
            </span>
            <span className="mt-1 hidden text-sm leading-relaxed text-[#a39a8c] lg:block">{t.desc}</span>
            {active === t.id && <span className="lp-tab-progress" style={{ animationDuration: `${ADVANCE_MS}ms`, animationPlayState: playing ? 'running' : 'paused' }} key={`${t.id}-${playing}`} aria-hidden />}
          </button>
        ))}
      </div>

      <div className="lp-frame">
        <div className="flex items-center justify-between gap-3 border-b border-[#a78040]/25 px-4 py-2.5 text-xs text-[#a39a8c]">
          <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#f4d18e]/80" /><span className="font-mono">echoes{current.path}</span></span>
          <span className="rounded-full border border-[#a78040]/40 px-2 py-0.5">Illustrative preview · sample memories</span>
        </div>
        <p className="px-4 pt-3 text-sm text-[#d9d1c3] lg:hidden">{current.desc}</p>
        <div className="grid p-4 sm:p-6">
          {TABS.map((t) => (
            <div key={t.id} id={`lp-panel-${t.id}`} role="tabpanel" aria-labelledby={`lp-tab-${t.id}`} hidden={false}
              aria-hidden={active !== t.id} inert={active !== t.id}
              className={`lp-panel [grid-area:1/1] ${active === t.id ? 'is-active' : ''}`}>
              {t.id === 'echoes' && <EchoesPanel />}
              {t.id === 'map' && <MapPanel active={active === 'map'} load={near} />}
              {t.id === 'room' && <RoomPanel />}
              {t.id === 'xray' && <XrayPanel />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
