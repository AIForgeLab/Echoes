import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Layers, Loader2, MessageCircle, PenLine, Save, Skull, Star, Trash2 } from 'lucide-react'
import { CATEGORIES, ART_STYLES, type ArtStyle, type Category } from '../types'
import { useEcho } from '../hooks/useEcho'
import { useApp } from '../state/AppState'
import { useEchoActions } from '../hooks/useEchoActions'
import { linksFor, allLinks } from '../lib/connections'
import { formatDate, formatDateTime } from '../lib/format'
import { data } from '../services/data'
import { useToast } from '../components/Toast'
import EchoArt from '../components/EchoArt'
import SourceText from '../components/SourceText'
import ProvenancePanel from '../components/ProvenancePanel'
import Pentimento from '../components/Pentimento'
import RetellDialog from '../components/RetellDialog'
import { ErrorState, Skeleton, Tabs, TagChip } from '../components/ui'

type Tab = 'overview' | 'source' | 'tellings' | 'provenance' | 'connections' | 'details'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'source', label: 'Original Source' }, { id: 'tellings', label: 'Tellings' },
  { id: 'provenance', label: 'Provenance' }, { id: 'connections', label: 'Connections' }, { id: 'details', label: 'Details' },
]

function DetailsForm({ id, onSaved }: { id: string; onSaved: () => void }) {
  const { echo } = useEcho(id)
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('Personal')
  const [style, setStyle] = useState<ArtStyle>('Cinematic')
  const [date, setDate] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!echo) return
    setTitle(echo.title); setCategory(echo.category); setStyle(echo.style); setDate(echo.memoryDate ?? ''); setTags(echo.tags)
  }, [echo])
  if (!echo) return <Skeleton className="h-40" />
  const addTag = () => { const t = tagInput.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9-]/g, ''); if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput('') }
  async function save() {
    if (!title.trim()) return toast('error', 'The title cannot be empty.')
    setBusy(true)
    try { await data.updateMeta(id, { title: title.trim(), category, style, memoryDate: date || null, tags }); toast('success', 'Details saved.'); onSaved() } catch (e) { toast('error', `Not saved: ${(e as Error).message}`) }
    setBusy(false)
  }
  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-muted">These details describe the memory. The memory's own words can't be edited, because that would break its seal. To change the story, <strong className="text-ivory">retell</strong> it.</p>
      <div><label htmlFor="t" className="label">Title</label><input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div><label htmlFor="c" className="label">Theme</label><select id="c" className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label htmlFor="s" className="label">Style</label><select id="s" className="input" value={style} onChange={(e) => setStyle(e.target.value as ArtStyle)}>{ART_STYLES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label htmlFor="d" className="label">Date</label><input id="d" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div>
        <p className="label">Tags</p>
        <div className="flex flex-wrap gap-1.5 mb-2">{tags.map((t) => <TagChip key={t} tag={t} onRemove={() => setTags(tags.filter((x) => x !== t))} />)}</div>
        <input className="input" placeholder="Add a tag and press Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} aria-label="Add a tag" />
      </div>
      <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save details</button>
    </div>
  )
}

export default function EchoDetails() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const { echo, seal, status, error, reload } = useEcho(id)
  const { echoes, refreshEchoes } = useApp()
  const [retell, setRetell] = useState(false)
  const actions = useEchoActions(() => reload())
  const [vi, setVi] = useState<number | null>(null)

  const connected = useMemo(() => {
    if (!echoes || !id) return []
    return linksFor(id, allLinks(echoes)).map((l) => ({ ...l, echo: echoes.find((e) => e.id === l.other)! })).filter((l) => l.echo)
  }, [echoes, id])

  if (status === 'loading') return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>
  if (status === 'missing') return <ErrorState title="Memory not found" message="This memory doesn't exist in your archive. It may belong to another account, or the link is wrong." />
  if (status === 'error' || !echo) return <ErrorState message={error} retry={reload} />

  const forgotten = !!echo.forgottenAt
  const telling = echo.tellings[vi ?? echo.tellings.length - 1] ?? echo.tellings[0]
  const changed = async () => { await reload(); await refreshEchoes() }

  return (
    <div className="space-y-6">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 text-muted hover:text-ivory"><ArrowLeft size={18} />Back</button>

      <div className="flex flex-col md:flex-row gap-6">
        <EchoArt echo={echo} className="w-full md:w-72 aspect-[4/3] rounded-2xl border border-bronze/50" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm text-muted">{echo.category}</p>
          <h1 className="font-serif text-5xl flex items-center gap-3">{forgotten ? 'A forgotten memory' : echo.title}{echo.favourite && <Star size={22} className="text-flame fill-flame" />}</h1>
          <p className="text-muted">{forgotten ? `Forgotten ${formatDateTime(echo.forgottenAt)}` : `${formatDate(echo.memoryDate)} · ${echo.tellings.length} telling${echo.tellings.length > 1 ? 's' : ''}`}</p>
          <div className="flex flex-wrap gap-1.5">{echo.tags.map((t) => <TagChip key={t} tag={t} />)}</div>
          {!forgotten && (
            <div className="flex flex-wrap gap-3 pt-3">
              <Link to={`/echoes/${echo.id}/chat`} className="btn-primary"><MessageCircle size={16} />Open in Echo Room</Link>
              <button className="btn-ghost" onClick={() => setRetell(true)}><Layers size={16} />Retell</button>
              <button className="btn-ghost" onClick={() => setParams({ tab: 'details' })}><PenLine size={16} />Edit details</button>
              <button className="btn-danger" onClick={() => actions.forget(echo)}><Trash2 size={16} />Forget</button>
            </div>
          )}
        </div>
      </div>

      {forgotten ? (
        <div className="card p-6 space-y-3">
          <p className="flex items-center gap-2 text-ivory"><Skull size={18} className="text-muted" />This memory was forgotten. Its key was destroyed, so the text below can never be read again.</p>
          <p className="font-mono text-xs text-muted break-all">{echo.tellings[0]?.ciphertext.slice(0, 260)}…</p>
          <ProvenancePanel echo={echo} seal={seal} onChanged={changed} />
        </div>
      ) : (
        <>
          <Tabs tabs={TABS} value={tab} onChange={(t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })} label="Memory sections" />
          <section className="card p-6">
            {tab === 'overview' && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-emerald mb-2">In your words · {telling?.label}</p>
                  {telling?.text != null ? <SourceText text={telling.text} /> : <p className="text-danger">This telling is unreadable: its stored text was altered.</p>}
                </div>
                <div className="space-y-4">
                  {echo.summary && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-violet mb-2">{echo.summaryGenerated ? 'Generated summary · not your words' : 'Your summary'}</p>
                      <p className="text-ivory/85">{echo.summary}</p>
                    </div>
                  )}
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-muted">Created</dt><dd>{formatDateTime(echo.createdAt)}</dd></div>
                    <div><dt className="text-muted">Last changed</dt><dd>{formatDateTime(echo.updatedAt)}</dd></div>
                    <div><dt className="text-muted">Integrity</dt><dd className={seal.every((s) => s.ok) ? 'text-emerald' : 'text-danger'}>{seal.every((s) => s.ok) ? 'Verified' : 'Check failed'}</dd></div>
                    <div><dt className="text-muted">Connections</dt><dd>{connected.length}</dd></div>
                  </dl>
                </div>
              </div>
            )}
            {tab === 'source' && (
              <div className="space-y-4">
                {echo.tellings.length > 1 && (
                  <div className="flex flex-wrap gap-2">{echo.tellings.map((t, i) => (
                    <button key={t.id} onClick={() => setVi(i)} className={`rounded-full border px-3 py-1 text-sm ${telling?.id === t.id ? 'bg-gold text-night border-gold' : 'border-bronze/60 text-muted'}`}>{t.label}</button>
                  ))}</div>
                )}
                {telling?.text != null ? <SourceText text={telling.text} /> : <p className="text-danger">This telling is unreadable: its stored text was altered.</p>}
                <p className="text-xs text-muted">Exactly as sealed on {formatDateTime(telling?.sealedAt)}. Echoes never rewrites these words.</p>
                {telling && telling.claims.length > 0 && (
                  <div>
                    <h3 className="font-serif text-xl mb-2">Facts in this telling</h3>
                    <ul className="grid sm:grid-cols-2 gap-2">{telling.claims.map((c, i) => <li key={i} className="rounded-xl border border-bronze/40 bg-surface-2 px-3 py-2 text-sm">{c.text}<span className="block text-xs text-muted mt-0.5">“{c.quote}”</span></li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {tab === 'tellings' && <Pentimento echo={echo} onClaimsSaved={reload} />}
            {tab === 'provenance' && <ProvenancePanel echo={echo} seal={seal} onChanged={changed} />}
            {tab === 'connections' && (
              connected.length === 0 ? <p className="text-muted">No connections yet. Memories connect when they share a tag, a theme, or happened close together.</p> : (
                <ul className="space-y-2">
                  {connected.map((c) => (
                    <li key={c.other}>
                      <Link to={`/echoes/${c.other}`} className="card card-hover flex items-center gap-3 p-3">
                        <EchoArt echo={c.echo} className="size-14 rounded-lg" />
                        <div className="flex-1 min-w-0"><p className="text-ivory">{c.echo.title}</p><p className="text-xs text-muted">{c.reason}</p></div>
                        {c.sharedTags.length > 0 && <span className="text-xs rounded-full border border-bronze/60 px-2 py-1 text-gold" title="Share of tags the two memories have in common">{Math.round(c.tagOverlap * 100)}% tag overlap</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            )}
            {tab === 'details' && <DetailsForm id={echo.id} onSaved={changed} />}
          </section>
        </>
      )}
      <RetellDialog echoId={echo.id} open={retell} onClose={() => setRetell(false)} onSaved={async () => { await changed(); setParams({ tab: 'tellings' }) }} />
      {actions.dialog}
    </div>
  )
}
