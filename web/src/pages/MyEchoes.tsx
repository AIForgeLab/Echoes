import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownUp, CalendarDays, FileText, Grid2X2, Images, Layers, List, Network, Plus, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../state/AppState'
import { CATEGORIES } from '../types'
import { archiveStats } from '../lib/stats'
import { cx } from '../lib/format'
import EchoCard from '../components/EchoCard'
import { CardGridSkeleton, EmptyState, ErrorState, PageHeader, SearchInput, StatCard } from '../components/ui'
import { useEchoActions } from '../hooks/useEchoActions'

type Sort = 'newest' | 'oldest' | 'title'

export default function MyEchoes() {
  const { echoes, echoesError, refreshEchoes } = useApp()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [retoldOnly, setRetoldOnly] = useState(false)
  const category = params.get('category') ?? 'All'
  const sort = (params.get('sort') as Sort) ?? 'newest'
  const view = params.get('view') === 'list' ? 'list' : 'grid'
  const actions = useEchoActions()

  const set = (k: string, v: string | null) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }) }

  const live = useMemo(() => (echoes ?? []).filter((e) => !e.forgottenAt), [echoes])
  const stats = useMemo(() => archiveStats(live), [live])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = live.filter((e) =>
      (category === 'All' || e.category === category) &&
      (!pinnedOnly || e.favourite) && (!retoldOnly || e.tellingCount > 1) &&
      (!needle || `${e.title} ${e.text ?? ''} ${e.summary ?? ''} ${e.tags.join(' ')}`.toLowerCase().includes(needle)))
    const date = (d: string | null, c: string) => d ?? c.slice(0, 10)
    list.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title)
        : sort === 'oldest' ? date(a.memoryDate, a.createdAt).localeCompare(date(b.memoryDate, b.createdAt))
          : date(b.memoryDate, b.createdAt).localeCompare(date(a.memoryDate, a.createdAt)))
    return [...list.filter((e) => e.favourite), ...list.filter((e) => !e.favourite)]
  }, [live, q, category, sort, pinnedOnly, retoldOnly])

  return (
    <div>
      <PageHeader title="My Echoes" subtitle="All your memories, in one place."
        actions={<>
          <SearchInput value={q} onChange={setQ} placeholder="Search your echoes…" label="Search your echoes" />
          <button className={cx('icon-btn size-11', showFilters && 'border-gold text-gold')} aria-label="More filters" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}><SlidersHorizontal size={18} /></button>
          <Link to="/echoes/new" className="btn-primary"><Plus size={18} />Create Echo</Link>
        </>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard icon={FileText} value={stats.total} label="Total Echoes" hint="Your saved memories" />
        <StatCard icon={Network} value={stats.connections} label="Connections" hint="Pairs sharing a tag (the map also links themes and dates)" />
        <StatCard icon={Layers} value={stats.retold} label="Retold" hint="Told more than once" />
        <StatCard icon={CalendarDays} value={stats.thisWeek} label="This Week" hint="New memories" />
      </div>

      {showFilters && (
        <div className="card p-4 mb-4 flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-[#f4d18e]" checked={pinnedOnly} onChange={(e) => setPinnedOnly(e.target.checked)} />Pinned only</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-[#f4d18e]" checked={retoldOnly} onChange={(e) => setRetoldOnly(e.target.checked)} />Retold memories only</label>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Category">
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} role="tab" aria-selected={category === c} onClick={() => set('category', c === 'All' ? null : c)}
              className={cx('whitespace-nowrap rounded-xl border px-4 py-2 text-sm transition', category === c ? 'bg-gold text-night border-gold' : 'border-bronze/60 text-ivory/85 hover:border-gold/70')}>
              {c === 'All' ? 'All Echoes' : c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Sort</span>
            <ArrowDownUp size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select value={sort} onChange={(e) => set('sort', e.target.value === 'newest' ? null : e.target.value)} className="input py-2 pl-9 pr-8 w-auto appearance-none cursor-pointer">
              <option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="title">Title A–Z</option>
            </select>
          </label>
          <div className="flex rounded-xl border border-bronze/60 p-1" role="group" aria-label="View">
            <button aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => set('view', null)} className={cx('rounded-lg p-2', view === 'grid' ? 'bg-gold text-night' : 'text-muted')}><Grid2X2 size={16} /></button>
            <button aria-pressed={view === 'list'} aria-label="List view" onClick={() => set('view', 'list')} className={cx('rounded-lg p-2', view === 'list' ? 'bg-gold text-night' : 'text-muted')}><List size={16} /></button>
          </div>
        </div>
      </div>

      {echoesError ? <ErrorState message={echoesError} retry={refreshEchoes} /> : !echoes ? <CardGridSkeleton /> : live.length === 0 ? (
        <EmptyState icon={Images} title="No echoes yet" action={<Link to="/echoes/new" className="btn-primary"><Plus size={18} />Create Echo</Link>}>Your first memory will appear here.</EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={Images} title="Nothing matches" action={<button className="btn-ghost" onClick={() => { setQ(''); set('category', null); setPinnedOnly(false); setRetoldOnly(false) }}>Clear filters</button>}>
          No memories match these filters{q && <> and “{q}”</>}.
        </EmptyState>
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5' : 'flex flex-col gap-3'}>
          {shown.map((e) => <EchoCard key={e.id} echo={e} view={view} onToggleFavourite={actions.toggleFavourite} onForget={actions.forget} />)}
        </div>
      )}
      {actions.dialog}
    </div>
  )
}
