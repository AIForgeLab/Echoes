import { useMemo, useState } from 'react'
import type { Echo } from '../types'
import { CATEGORIES } from '../types'
import { portraitUri } from '../lib/portrait'
import type { Link as MLink } from '../lib/connections'

// After Giulio Camillo's Theatre of Memory (1530s): the viewer stands on the stage facing
// columns (here: themes) and rising tiers (here: time, earliest nearest the stage).
const CX = 500, CY = 560, SEAT = 62, PAD = 0.12 // radians kept clear at each end of the arc

export default function TheatreView({ echoes, links, selected, onSelect }: { echoes: Echo[]; links: MLink[]; selected: string | null; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const { cols, sector, seats } = useMemo(() => {
    const cols = CATEGORIES.filter((c) => echoes.some((e) => e.category === c))
    // Within each column (theme), memories rise through the tiers in time order: earliest nearest the stage.
    const sector = (Math.PI - 2 * PAD) / Math.max(cols.length, 1)
    const seats: { e: Echo; x: number; y: number }[] = []
    cols.forEach((c, ci) => {
      const list = echoes.filter((e) => e.category === c).sort((a, b) => (a.memoryDate ?? a.createdAt).localeCompare(b.memoryDate ?? b.createdAt))
      list.forEach((e, i) => {
        const tier = list.length === 1 ? 2 : Math.round((i * 6) / Math.max(list.length - 1, 1))
        const r = 180 + tier * 54
        const a = Math.PI + PAD + sector * ci + sector / 2 + (list.length > 4 ? ((i % 2) - 0.5) * sector * 0.4 : 0)
        seats.push({ e, x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) })
      })
    })
    return { cols, sector, seats }
  }, [echoes])
  const pos = new Map(seats.map((s) => [s.e.id, s]))
  const focus = hover ?? selected

  return (
    <div className="h-full w-full overflow-auto grid place-items-center p-4">
      <svg viewBox="-110 -50 1220 650" className="w-full max-w-5xl" role="img" aria-label="Theatre of Memory: themes as columns, time as tiers">
        {Array.from({ length: 7 }, (_, t) => { const r = 170 + t * 55; return <path key={t} d={`M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`} fill="none" stroke="#f4d18e" strokeOpacity="0.1" /> })}
        {cols.map((c, i) => {
          const a0 = Math.PI + PAD + sector * i, mid = a0 + sector / 2
          return (
            <g key={c}>
              <line x1={CX + 140 * Math.cos(a0)} y1={CY + 140 * Math.sin(a0)} x2={CX + 545 * Math.cos(a0)} y2={CY + 545 * Math.sin(a0)} stroke="#f4d18e" strokeOpacity="0.12" />
              <text x={CX + 580 * Math.cos(mid)} y={CY + 580 * Math.sin(mid) + 5} textAnchor="middle" fill="#f4d18e" fontSize="19" fontFamily="Cormorant Garamond, serif">{c}</text>
            </g>
          )
        })}
        {links.map((l, i) => {
          const a = pos.get(l.a), b = pos.get(l.b)
          if (!a || !b) return null
          const lit = focus === l.a || focus === l.b
          const qx = (a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * 0.3, qy = (a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * 0.3
          return <path key={i} d={`M ${a.x} ${a.y} Q ${qx} ${qy} ${b.x} ${b.y}`} fill="none" stroke="#ffb84d" strokeOpacity={focus ? (lit ? 0.85 : 0.06) : 0.22} strokeWidth={lit ? 1.8 : 1} />
        })}
        <path d={`M ${CX - 120} ${CY} A 120 120 0 0 1 ${CX + 120} ${CY} Z`} fill="#ffb84d" fillOpacity="0.07" stroke="#f4d18e" strokeOpacity="0.4" />
        <text x={CX} y={CY - 42} textAnchor="middle" fill="#f4d18e" fontSize="16" fontFamily="Cormorant Garamond, serif">you stand here</text>
        {seats.map(({ e, x, y }) => (
          <g key={e.id} tabIndex={0} role="button" aria-label={e.title} className="cursor-pointer outline-none" onClick={() => onSelect(e.id)} onKeyDown={(k) => k.key === 'Enter' && onSelect(e.id)} onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)}>
            {selected === e.id && <circle cx={x} cy={y} r={SEAT / 2 + 7} fill="none" stroke="#ffb84d" strokeWidth="2" />}
            <clipPath id={`c-${e.id}`}><circle cx={x} cy={y} r={SEAT / 2} /></clipPath>
            <image href={e.cover ?? portraitUri(e.hash, e.style)} x={x - SEAT / 2} y={y - SEAT / 2} width={SEAT} height={SEAT} preserveAspectRatio="xMidYMid slice" clipPath={`url(#c-${e.id})`} />
            <circle cx={x} cy={y} r={SEAT / 2} fill="none" stroke="#5c4528" strokeWidth="1.5" />
            {(hover === e.id || selected === e.id) && <text x={x} y={y + SEAT / 2 + 18} textAnchor="middle" fill="#f6ebdd" fontSize="14">{e.title}</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}
