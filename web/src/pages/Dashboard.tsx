import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, FileText, Layers, Loader2, Network, Plus, Clock, Images } from 'lucide-react'
import { useApp } from '../state/AppState'
import { archiveStats, recentActivity } from '../lib/stats'
import { relativeTime } from '../lib/format'
import EchoCard from '../components/EchoCard'
import { CardGridSkeleton, EmptyState, ErrorState, SearchInput, StatCard } from '../components/ui'
import { useEchoActions } from '../hooks/useEchoActions'
import { useToast } from '../components/Toast'
import { data } from '../services/data'
import { loadSamples, SAMPLE_NAME } from '../services/samples'

export default function Dashboard() {
  const { user, echoes, echoesError, refreshEchoes } = useApp()
  const [q, setQ] = useState('')
  const actions = useEchoActions()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  async function addSamples() {
    setLoading(true)
    try {
      const r = await loadSamples(data, echoes ?? [])
      await refreshEchoes()
      toast('success', `Added ${r.added} sample memories from ${SAMPLE_NAME}'s fictional archive.`)
    } catch (e) { toast('error', (e as Error).message) }
    setLoading(false)
  }
  const live = useMemo(() => (echoes ?? []).filter((e) => !e.forgottenAt), [echoes])
  const stats = useMemo(() => archiveStats(live), [live])
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const results = q.trim()
    ? live.filter((e) => `${e.title} ${e.text ?? ''} ${e.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    : [...live].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-serif text-4xl md:text-5xl">{greet}, {user?.name.split(' ')[0]}</h1>
          <p className="text-muted text-lg mt-1">Your memories shape your story.</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search your memories…" label="Search your memories" />
      </div>

      {echoesError ? <ErrorState message={echoesError} retry={refreshEchoes} /> : !echoes ? <CardGridSkeleton count={4} /> : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
            <StatCard icon={FileText} value={stats.total} label="Echoes" hint="Saved memories" />
            <StatCard icon={Network} value={stats.connections} label="Connections" hint="Pairs sharing a tag (the map also links themes and dates)" />
            <StatCard icon={Layers} value={stats.retold} label="Retold" hint="Memories told more than once" />
            <StatCard icon={CalendarDays} value={stats.thisWeek} label="This Week" hint="New memories" />
          </div>

          {live.length === 0 ? (
            <EmptyState icon={Images} title="Your archive is waiting" action={<div className="flex flex-wrap justify-center gap-3"><Link to="/echoes/new" className="btn-primary"><Plus size={18} />Create your first Echo</Link><button className="btn-ghost" disabled={loading} onClick={addSamples}>{loading && <Loader2 size={16} className="animate-spin" />}Load sample memories</button></div>}>
              Write a memory in your own words. Echoes seals the original so nothing, not even the AI, can quietly rewrite it. Or load six memories of {SAMPLE_NAME}, a fictional person, to try it first.
            </EmptyState>
          ) : (
            <div className="grid xl:grid-cols-[1fr_300px] gap-8">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-3xl">{q ? `Results for “${q}”` : 'Your Recent Echoes'}</h2>
                  <Link to="/echoes" className="text-sm text-ivory/80 hover:text-gold inline-flex items-center gap-1">View all <ArrowRight size={14} /></Link>
                </div>
                {results.length === 0 ? <p className="text-muted">No memories match “{q}”.</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-5">
                    {results.slice(0, 6).map((e) => <EchoCard key={e.id} echo={e} onToggleFavourite={actions.toggleFavourite} onForget={actions.forget} />)}
                  </div>
                )}
              </section>
              <aside className="space-y-4">
                <Link to="/echoes/new" className="btn-primary w-full py-3"><Plus size={18} />Create Echo</Link>
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/memory-map" className="btn-ghost"><Network size={16} />Memory Map</Link>
                  <Link to={live[0] ? `/echoes/${live[0].id}/chat` : '/echoes'} className="btn-ghost">Echo Room</Link>
                </div>
                <div className="card p-5">
                  <h2 className="font-serif text-2xl mb-3">Recent activity</h2>
                  <ul className="space-y-3">
                    {recentActivity(echoes).map((a) => (
                      <li key={a.id} className="flex gap-3 text-sm">
                        <Clock size={15} className="text-gold mt-0.5 shrink-0" />
                        <div><Link to={`/echoes/${a.echoId}`} className="text-ivory/90 hover:text-gold">{a.text}</Link><p className="text-xs text-muted">{relativeTime(a.at)}</p></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </>
      )}
      {actions.dialog}
    </div>
  )
}
