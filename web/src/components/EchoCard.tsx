import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, MoreHorizontal, Eye, PenLine, Star, Trash2, Layers } from 'lucide-react'
import type { Echo } from '../types'
import { formatDate, cx } from '../lib/format'
import EchoArt from './EchoArt'
import { TagChip } from './ui'

interface Props {
  echo: Echo
  view?: 'grid' | 'list'
  onToggleFavourite?: (e: Echo) => void
  onForget?: (e: Echo) => void
}

function Menu({ echo, onToggleFavourite, onForget }: Omit<Props, 'view'>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const item = 'flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-2'
  return (
    <div ref={ref} className="relative">
      <button aria-label={`Actions for ${echo.title}`} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o) }}
        className="grid place-items-center size-8 rounded-lg bg-black/55 text-ivory backdrop-blur hover:bg-black/75"><MoreHorizontal size={16} /></button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-bronze/60 bg-surface shadow-2xl" onClick={(e) => e.preventDefault()}>
          <button role="menuitem" className={item} onClick={() => nav(`/echoes/${echo.id}`)}><Eye size={15} />Open</button>
          <button role="menuitem" className={item} onClick={() => nav(`/echoes/${echo.id}/chat`)}><MessageCircle size={15} />Echo Room</button>
          <button role="menuitem" className={item} onClick={() => nav(`/echoes/${echo.id}?tab=details`)}><PenLine size={15} />Edit details</button>
          {onToggleFavourite && <button role="menuitem" className={item} onClick={() => { setOpen(false); onToggleFavourite(echo) }}><Star size={15} />{echo.favourite ? 'Unpin' : 'Pin to top'}</button>}
          {onForget && <button role="menuitem" className={cx(item, 'text-danger')} onClick={() => { setOpen(false); onForget(echo) }}><Trash2 size={15} />Forget…</button>}
        </div>
      )}
    </div>
  )
}

export default function EchoCard({ echo, view = 'grid', onToggleFavourite, onForget }: Props) {
  const preview = echo.summary && !echo.summaryGenerated ? echo.summary : echo.text ?? echo.summary ?? ''
  if (view === 'list') {
    return (
      <div className="card card-hover flex items-center gap-4 p-3 pr-4">
        <Link to={`/echoes/${echo.id}`} className="shrink-0"><EchoArt echo={echo} className="size-20 rounded-xl" /></Link>
        <Link to={`/echoes/${echo.id}`} className="min-w-0 flex-1">
          <p className="font-serif text-xl text-ivory truncate flex items-center gap-2">{echo.favourite && <Star size={14} className="text-flame fill-flame" />}{echo.title}</p>
          <p className="text-xs text-muted">{formatDate(echo.memoryDate)} · {echo.category}{echo.tellingCount > 1 && ` · ${echo.tellingCount} tellings`}</p>
          <p className="text-sm text-ivory/75 truncate mt-1">{preview}</p>
        </Link>
        <div className="hidden md:flex gap-1.5">{echo.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}</div>
        <Menu echo={echo} onToggleFavourite={onToggleFavourite} onForget={onForget} />
      </div>
    )
  }
  return (
    <div className={cx('card card-hover overflow-hidden flex flex-col', echo.favourite && 'glow')}>
      <div className="relative">
        <Link to={`/echoes/${echo.id}`} tabIndex={-1} aria-hidden><EchoArt echo={echo} className="h-44 w-full" /></Link>
        {echo.favourite && <Star size={20} className="absolute left-3 top-3 text-flame fill-flame drop-shadow" aria-label="Pinned" />}
        {echo.tellingCount > 1 && <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-gold backdrop-blur"><Layers size={12} />{echo.tellingCount} tellings</span>}
        <div className="absolute right-3 top-3"><Menu echo={echo} onToggleFavourite={onToggleFavourite} onForget={onForget} /></div>
      </div>
      <Link to={`/echoes/${echo.id}`} className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-serif text-[22px] leading-tight text-ivory">{echo.title}</h3>
        <p className="text-sm text-muted">{formatDate(echo.memoryDate)}</p>
        <p className="text-sm text-ivory/75 line-clamp-2">{preview}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">{echo.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}</div>
      </Link>
    </div>
  )
}
