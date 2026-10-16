import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Layers, LineChart } from 'lucide-react'
import { useApp } from '../state/AppState'
import { CATEGORIES } from '../types'
import { allLinks } from '../lib/connections'
import { EmptyState, ErrorState, PageHeader, Skeleton, TagChip } from '../components/ui'

function Bars({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-sm">
          <span className="text-ivory/85 truncate">{r.label}</span>
          <span className="h-2.5 rounded-full bg-surface-2 overflow-hidden" role="img" aria-label={`${r.label}: ${r.value} ${unit}`}>
            <span className="block h-full rounded-full bg-gradient-to-r from-[#b8862f] to-flame" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-muted text-right tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Insights() {
  const { echoes, echoesError, refreshEchoes } = useApp()
  const live = useMemo(() => (echoes ?? []).filter((e) => !e.forgottenAt), [echoes])

  const s = useMemo(() => {
    const tagCount = new Map<string, number>()
    live.forEach((e) => e.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)))
    const byMonth = new Map<string, number>()
    live.forEach((e) => { const m = (e.memoryDate ?? e.createdAt).slice(0, 7); byMonth.set(m, (byMonth.get(m) ?? 0) + 1) })
    const links = allLinks(live).filter((l) => l.sharedTags.length)
    return {
      tags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      themes: CATEGORIES.map((c) => ({ label: c, value: live.filter((e) => e.category === c).length })).filter((r) => r.value),
      months: [...byMonth.entries()].sort().slice(-12).map(([m, v]) => ({ label: new Date(`${m}-01T12:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), value: v })),
      strongest: links.sort((a, b) => b.sharedTags.length - a.sharedTags.length).slice(0, 4).map((l) => ({ ...l, a: live.find((e) => e.id === l.a)!, b: live.find((e) => e.id === l.b)! })),
      retold: live.filter((e) => e.tellingCount > 1),
    }
  }, [live])

  if (echoesError) return <ErrorState message={echoesError} retry={refreshEchoes} />
  if (!echoes) return <Skeleton className="h-96" />

  return (
    <div>
      <PageHeader title="Insights" subtitle="Patterns across your memories, counted directly from your archive." />
      {live.length < 3 ? (
        <EmptyState icon={LineChart} title="Not enough memories yet" action={<Link to="/echoes/new" className="btn-primary">Create an Echo</Link>}>Insights appear once you have at least three memories.</EmptyState>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted">Everything on this page is a plain count of your own data. No AI interpretation, and nothing about your personality or wellbeing is inferred.</p>
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="card p-6"><h2 className="font-serif text-2xl mb-4 flex items-center gap-2"><BarChart3 size={20} className="text-gold" />Memories over time</h2><Bars rows={s.months} unit="memories" /><p className="text-xs text-muted mt-3">By the date each memory happened (or was created, if undated).</p></section>
            <section className="card p-6"><h2 className="font-serif text-2xl mb-4">Themes</h2><Bars rows={s.themes} unit="memories" /></section>
            <section className="card p-6"><h2 className="font-serif text-2xl mb-4">Most used tags</h2><div className="flex flex-wrap gap-2">{s.tags.map(([t, n]) => <span key={t} className="inline-flex items-center gap-1.5"><TagChip tag={t} /><span className="text-xs text-muted">×{n}</span></span>)}</div></section>
            <section className="card p-6">
              <h2 className="font-serif text-2xl mb-4">Strongest connections</h2>
              {s.strongest.length ? <ul className="space-y-2 text-sm">{s.strongest.map((l, i) => <li key={i}><Link to={`/echoes/${l.a.id}`} className="text-gold hover:underline">{l.a.title}</Link> ↔ <Link to={`/echoes/${l.b.id}`} className="text-gold hover:underline">{l.b.title}</Link><span className="block text-xs text-muted">{l.reason}</span></li>)}</ul> : <p className="text-muted text-sm">No memories share tags yet.</p>}
            </section>
          </div>
          <section className="card p-6">
            <h2 className="font-serif text-2xl mb-2 flex items-center gap-2"><Layers size={20} className="text-gold" />Memories you've retold</h2>
            <p className="text-sm text-muted mb-3">Open one and use Tellings to X-ray how it drifted.</p>
            {s.retold.length ? <div className="flex flex-wrap gap-2">{s.retold.map((e) => <Link key={e.id} to={`/echoes/${e.id}?tab=tellings`} className="btn-ghost text-sm">{e.title} · {e.tellingCount} tellings</Link>)}</div> : <p className="text-muted text-sm">None yet. Retell a memory from its page to compare versions.</p>}
          </section>
        </div>
      )}
    </div>
  )
}
