import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, Handle, Position, useReactFlow, useViewport, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowRight, Columns3, Maximize, Minus, Network, PenLine, Plus, Rows3, Trash2, X, Tag, Images } from 'lucide-react'
import type { Echo } from '../types'
import { useApp } from '../state/AppState'
import { allLinks, linksFor, type Link as MLink } from '../lib/connections'
import { formatDate, cx } from '../lib/format'
import { useEchoActions } from '../hooks/useEchoActions'
import EchoArt from '../components/EchoArt'
import TheatreView from '../components/TheatreView'
import { EmptyState, ErrorState, PageHeader, SearchInput, Skeleton, Tabs, TagChip } from '../components/ui'

const COLORS = { direct: '#ffb84d', tags: '#6e9bff', theme: '#b07cf0', time: '#5fbf8f' }
const HANDLE = { left: '50%', top: '50%', opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 }

type MemNode = Node<{ echo: Echo; selected: boolean; dim: boolean }, 'memory'>
type HubNode = Node<{ tag: string; count: number; dim: boolean }, 'hub'>

function MemoryNode({ data: d }: NodeProps<MemNode>) {
  return (
    <div className={cx('w-44 overflow-hidden rounded-xl border bg-surface transition', d.selected ? 'border-gold glow' : 'border-bronze/70', d.dim && 'opacity-25')}>
      <Handle type="target" position={Position.Top} style={HANDLE} /><Handle type="source" position={Position.Top} style={HANDLE} />
      <EchoArt echo={d.echo} className="h-24 w-full" alt="" />
      <div className="px-3 py-2"><p className="text-sm text-ivory truncate">{d.echo.title}</p><p className="text-xs text-muted">{formatDate(d.echo.memoryDate)}</p></div>
    </div>
  )
}

function HubNodeView({ data: d }: NodeProps<HubNode>) {
  return (
    <div className={cx('rounded-xl border border-bronze/70 bg-surface px-4 py-3 text-center transition', d.dim && 'opacity-25')}>
      <Handle type="target" position={Position.Top} style={HANDLE} /><Handle type="source" position={Position.Top} style={HANDLE} />
      <Tag size={20} className="mx-auto text-flame" />
      <p className="text-sm text-ivory mt-1">#{d.tag}</p><p className="text-xs text-muted">{d.count} memories</p>
    </div>
  )
}

const nodeTypes = { memory: MemoryNode, hub: HubNodeView }

function Controls() {
  const rf = useReactFlow()
  const { zoom } = useViewport()
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
      <div className="card flex items-center">
        <button className="p-2.5 text-ivory hover:text-gold" aria-label="Zoom out" onClick={() => rf.zoomOut()}><Minus size={16} /></button>
        <span className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="p-2.5 text-ivory hover:text-gold" aria-label="Zoom in" onClick={() => rf.zoomIn()}><Plus size={16} /></button>
      </div>
      <button className="card p-2.5 text-ivory hover:text-gold" aria-label="Fit to screen" onClick={() => rf.fitView({ padding: 0.15, duration: 300 })}><Maximize size={16} /></button>
    </div>
  )
}

function Graph({ echoes, links, selected, matches, onSelect }: { echoes: Echo[]; links: MLink[]; selected: string | null; matches: Set<string> | null; onSelect: (id: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const sorted = [...echoes].sort((a, b) => a.category.localeCompare(b.category) || (a.memoryDate ?? '').localeCompare(b.memoryDate ?? ''))
    const R = Math.max(300, sorted.length * 34)
    const pos = new Map<string, { x: number; y: number }>()
    const nodes: Node[] = sorted.map((e, i) => {
      const a = (2 * Math.PI * i) / sorted.length - Math.PI / 2
      const p = { x: R * Math.cos(a), y: R * Math.sin(a) * 0.72 }
      pos.set(e.id, p)
      return { id: e.id, type: 'memory', position: { x: p.x - 88, y: p.y - 70 }, data: { echo: e, selected: e.id === selected, dim: !!matches && !matches.has(e.id) } }
    })
    const tagCount = new Map<string, string[]>()
    echoes.forEach((e) => e.tags.forEach((t) => tagCount.set(t, [...(tagCount.get(t) ?? []), e.id])))
    const hubs = [...tagCount.entries()].filter(([, ids]) => ids.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 5)
    hubs.forEach(([tag, ids], i) => {
      const a = (2 * Math.PI * i) / hubs.length
      nodes.push({ id: `hub:${tag}`, type: 'hub', position: { x: 150 * Math.cos(a) - 55, y: 110 * Math.sin(a) - 40 }, data: { tag, count: ids.length, dim: !!matches && !ids.some((x) => matches.has(x)) } })
    })
    const touch = (id: string) => selected === id
    const edges: Edge[] = []
    hubs.forEach(([tag, ids]) => ids.forEach((id) => edges.push({ id: `h-${tag}-${id}`, source: id, target: `hub:${tag}`, type: 'straight', style: { stroke: touch(id) ? COLORS.direct : COLORS.tags, strokeWidth: touch(id) ? 2 : 1, opacity: selected && !touch(id) ? 0.15 : 0.6 } })))
    links.forEach((l) => {
      const kind = l.kinds.includes('similar-theme') ? 'theme' : l.kinds.includes('time-related') ? 'time' : null
      if (!kind) return
      const lit = touch(l.a) || touch(l.b)
      edges.push({ id: `l-${l.a}-${l.b}`, source: l.a, target: l.b, type: 'straight', style: { stroke: lit ? COLORS.direct : COLORS[kind], strokeWidth: lit ? 2 : 1, opacity: selected && !lit ? 0.12 : 0.55, strokeDasharray: kind === 'time' ? '4 4' : undefined } })
    })
    return { nodes, edges }
  }, [echoes, links, selected, matches])

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.2} maxZoom={2}
      nodesDraggable nodesConnectable={false} onNodeClick={(_, n) => n.type === 'memory' && onSelect(n.id)} proOptions={{ hideAttribution: false }}>
      <Controls />
    </ReactFlow>
  )
}

function Timeline({ echoes, selected, matches, onSelect }: { echoes: Echo[]; selected: string | null; matches: Set<string> | null; onSelect: (id: string) => void }) {
  const byYear = new Map<string, Echo[]>()
  ;[...echoes].sort((a, b) => (b.memoryDate ?? '').localeCompare(a.memoryDate ?? '')).forEach((e) => { const y = e.memoryDate?.slice(0, 4) ?? 'Undated'; byYear.set(y, [...(byYear.get(y) ?? []), e]) })
  return (
    <div className="h-full overflow-y-auto p-5 space-y-6">
      {[...byYear.entries()].map(([y, list]) => (
        <section key={y}>
          <h3 className="font-serif text-2xl text-gold mb-3">{y}</h3>
          <ol className="relative border-l border-bronze/60 ml-2 space-y-3">
            {list.map((e) => (
              <li key={e.id} className={cx('ml-5', matches && !matches.has(e.id) && 'opacity-30')}>
                <span className="absolute -left-[5px] mt-5 size-2.5 rounded-full bg-flame" />
                <button onClick={() => onSelect(e.id)} className={cx('card card-hover flex w-full items-center gap-3 p-2.5 text-left', selected === e.id && 'glow')}>
                  <EchoArt echo={e} className="size-14 rounded-lg" alt="" />
                  <span><span className="block text-ivory">{e.title}</span><span className="text-xs text-muted">{formatDate(e.memoryDate)} · {e.category}</span></span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function DetailsPanel({ echo, echoes, links, onSelect, onClose, onForget }: { echo: Echo; echoes: Echo[]; links: MLink[]; onSelect: (id: string) => void; onClose: () => void; onForget: (e: Echo) => void }) {
  const [tab, setTab] = useState<'overview' | 'connections' | 'source'>('overview')
  const nav = useNavigate()
  const conns = linksFor(echo.id, links).map((l) => ({ ...l, other: echoes.find((e) => e.id === l.other)! })).filter((c) => c.other)
  const connList = (
    <ul className="space-y-2">
      {conns.map((c) => (
        <li key={c.other.id}>
          <button onClick={() => onSelect(c.other.id)} className="card card-hover flex w-full items-center gap-3 p-2 text-left">
            <EchoArt echo={c.other} className="size-12 rounded-lg" alt="" />
            <span className="min-w-0 flex-1"><span className="block text-sm text-ivory truncate">{c.other.title}</span><span className="block text-xs text-muted truncate">{c.reason}</span></span>
            {c.sharedTags.length > 0 && <span className="rounded-full border border-bronze/60 px-2 py-0.5 text-xs text-gold" title="Share of tags in common">{Math.round(c.tagOverlap * 100)}%</span>}
          </button>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="card p-5 flex flex-col gap-4 h-full overflow-y-auto">
      <div className="flex items-start justify-between"><h2 className="font-serif text-2xl">Memory Details</h2><button aria-label="Close details" onClick={onClose} className="text-muted hover:text-ivory"><X size={18} /></button></div>
      <div className="flex gap-3">
        <EchoArt echo={echo} className="w-28 aspect-[4/3] rounded-xl" />
        <div className="min-w-0"><p className="font-serif text-xl">{echo.title}</p><p className="text-sm text-muted">{formatDate(echo.memoryDate)}</p><div className="flex flex-wrap gap-1 mt-1">{echo.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}</div></div>
      </div>
      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'connections', label: 'Connections' }, { id: 'source', label: 'Source' }]} value={tab} onChange={setTab} label="Memory details" />
      {tab === 'overview' && (
        <>
          <p className="rounded-xl border border-bronze/40 bg-surface-2 p-3 text-sm text-ivory/90">{echo.summary ?? echo.text}</p>
          {echo.summary && echo.summaryGenerated && <p className="text-xs text-violet -mt-2">Generated summary, not your words</p>}
          <div><div className="flex items-center justify-between mb-2"><h3 className="text-ivory">Connected Memories ({conns.length})</h3>{conns.length > 4 && <button className="text-xs text-muted hover:text-gold" onClick={() => setTab('connections')}>View all →</button>}</div>{conns.length ? connList : <p className="text-sm text-muted">No connections yet.</p>}</div>
        </>
      )}
      {tab === 'connections' && (conns.length ? connList : <p className="text-sm text-muted">No connections yet.</p>)}
      {tab === 'source' && <p className="font-serif text-lg leading-relaxed">{echo.text ?? 'Unreadable.'}</p>}
      <div className="mt-auto space-y-2 pt-2">
        <Link to={`/echoes/${echo.id}/chat`} className="btn-primary w-full"><ArrowRight size={16} />Open in Echo Room</Link>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => nav(`/echoes/${echo.id}?tab=details`)}><PenLine size={16} />Edit Memory</button>
          <button className="btn-danger px-3" aria-label="Forget this memory" onClick={() => onForget(echo)}><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  )
}

type View = 'graph' | 'timeline' | 'theatre'

export default function MemoryMap() {
  const { echoes, echoesError, refreshEchoes } = useApp()
  const [selected, setSelected] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'timeline' : 'graph'))
  const actions = useEchoActions(() => setSelected(null))
  const live = useMemo(() => (echoes ?? []).filter((e) => !e.forgottenAt), [echoes])
  const links = useMemo(() => allLinks(live), [live])
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase()
    return n ? new Set(live.filter((e) => `${e.title} ${e.tags.join(' ')} ${e.text ?? ''}`.toLowerCase().includes(n)).map((e) => e.id)) : null
  }, [q, live])

  const picked = useRef(false)
  useEffect(() => {
    if (!picked.current && live.length) { picked.current = true; setSelected(live.find((e) => e.favourite)?.id ?? live[0]!.id) }
  }, [live])
  useEffect(() => { if (matches && matches.size === 1) setSelected([...matches][0]!) }, [matches])

  const sel = live.find((e) => e.id === selected) ?? null

  if (echoesError) return <ErrorState message={echoesError} retry={refreshEchoes} />
  if (!echoes) return <Skeleton className="h-[70vh]" />

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Memory Map" subtitle="Explore the connections between your memories, ideas and experiences."
        actions={<>
          <SearchInput value={q} onChange={setQ} placeholder="Search memories or tags…" label="Search the map" />
          <div className="flex rounded-xl border border-bronze/60 p-1" role="group" aria-label="View">
            {([['graph', 'Graph', Network], ['timeline', 'Timeline', Rows3], ['theatre', 'Theatre', Columns3]] as const).map(([v, label, Icon]) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm', view === v ? 'bg-surface-2 text-gold border border-bronze' : 'text-muted border border-transparent')}><Icon size={15} />{label}</button>
            ))}
          </div>
        </>} />

      {live.length === 0 ? (
        <EmptyState icon={Images} title="Nothing to map yet" action={<Link to="/echoes/new" className="btn-primary">Create an Echo</Link>}>Memories appear here and connect through shared tags, themes and dates.</EmptyState>
      ) : (
        <div className="grid xl:grid-cols-[1fr_360px] gap-4 flex-1 min-h-[640px]">
          <div className="card relative overflow-hidden starfield min-h-[520px]">
            {view === 'graph' && <ReactFlowProvider><Graph echoes={live} links={links} selected={selected} matches={matches} onSelect={setSelected} /></ReactFlowProvider>}
            {view === 'timeline' && <Timeline echoes={live} selected={selected} matches={matches} onSelect={setSelected} />}
            {view === 'theatre' && <TheatreView echoes={matches ? live.filter((e) => matches.has(e.id)) : live} links={links} selected={selected} onSelect={setSelected} />}
            {view !== 'timeline' && (
              <div className="absolute bottom-4 left-4 z-10 card flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-xs">
                {view === 'graph' ? <>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLORS.direct }} />Selected memory's links</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLORS.tags }} />Shared Tags</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLORS.theme }} />Same Theme</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLORS.time }} />Within 45 days</span>
                </> : <span className="text-muted">After Camillo's Theatre of Memory (1530s): columns are themes, tiers are time. You stand on the stage.</span>}
              </div>
            )}
          </div>
          {sel ? <DetailsPanel echo={sel} echoes={live} links={links} onSelect={setSelected} onClose={() => setSelected(null)} onForget={actions.forget} /> : <div className="card p-6 text-muted grid place-items-center">Select a memory to see its details.</div>}
        </div>
      )}
      {actions.dialog}
    </div>
  )
}
