import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Loader2, RotateCcw, ShieldQuestion } from 'lucide-react'
import type { AskResult } from '../types'
import { useEcho } from '../hooks/useEcho'
import { ask } from '../services/ai'
import { useApp } from '../state/AppState'
import { formatDate, cx } from '../lib/format'
import EchoArt from '../components/EchoArt'
import SourceText from '../components/SourceText'
import { DemoLabel, ErrorState, Skeleton, TagChip, TruthBoundaryBadge } from '../components/ui'
import { sampleQuestions } from '../services/samples'

interface Turn { q: string; tellingId: string; result?: AskResult; error?: string }
const SUGGESTIONS = ['Why was this moment important?', 'Who was with me?', 'What happened next?']

function Answer({ r, onShow }: { r: AskResult; onShow: (s: { start: number; end: number }) => void }) {
  const flagged = r.assumptions.filter((a) => a.status !== 'supported')
  return (
    <div className="space-y-3 max-w-2xl">
      {flagged.map((a, i) => (
        <div key={i} className="card border-amber/50 bg-amber/5 p-4">
          <p className="flex items-center gap-2 text-amber text-sm font-medium"><ShieldQuestion size={16} />Assumption check</p>
          <p className="mt-1">Your question assumes <em>“{a.assumption}”</em>, but {a.status === 'contradicted' ? 'your memory says otherwise' : "this telling of your memory doesn't mention it"}.</p>
          {a.status === 'contradicted' && a.quote && <p className="text-sm text-muted mt-1">It says: “{a.quote}”</p>}
          {a.found_in && <p className="text-sm mt-2 text-ivory/90">…but your <strong>{a.found_in.label}</strong> retelling does: “{a.found_in.quote}”. Compare them under <strong>Tellings</strong> to see how the memory drifted.</p>}
        </div>
      ))}
      {r.claims.map((c, i) => (
        <div key={i} className={cx('card p-4', c.type === 'said' && 'border-emerald/40', c.type === 'inferred' && 'border-violet/40', c.type === 'unknown' && 'border-amber/40')}>
          <TruthBoundaryBadge type={c.type} />
          <p className="mt-2 text-[17px] leading-relaxed">{c.text}</p>
          {c.type === 'said' && c.quote && (
            <div className="mt-3">
              <p className="text-sm text-muted"><span className="text-ivory/90">Source:</span> your exact words, found in the memory by code{c.verified ? '; a second AI check judged that they support this' : ''}</p>
              <blockquote className="mt-2 border-l-2 border-emerald/60 bg-surface-2 rounded-r-lg px-3 py-2 text-sm text-ivory/90">“{c.quote}”</blockquote>
              {c.start != null && c.end != null && <button className="mt-2 text-sm text-gold hover:underline inline-flex items-center gap-1" onClick={() => onShow({ start: c.start!, end: c.end! })}><BookOpen size={14} />Show in the original</button>}
            </div>
          )}
          {c.type === 'inferred' && <p className="mt-2 text-xs text-muted">An interpretation, not something you wrote.{c.note ? ` (${c.note})` : ''}</p>}
          {c.type === 'unknown' && <p className="mt-2 text-xs text-muted">Echoes won't guess. Guessed details are how false memories form.</p>}
        </div>
      ))}
      {r.source === 'demo' && <DemoLabel>Offline demo answer · word matching, not AI</DemoLabel>}
    </div>
  )
}

export default function EchoRoom() {
  const { id } = useParams()
  const nav = useNavigate()
  const { echo, status, error, reload } = useEcho(id)
  const { ai } = useApp()
  const storeKey = `echoes.chat.${id}`
  const [turns, setTurns] = useState<Turn[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || '[]') as Turn[]
      return saved.map((t) => (t.result || t.error ? t : { ...t, error: 'This question was interrupted before an answer arrived.' }))
    } catch { return [] }
  })
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [vi, setVi] = useState<number | null>(null)
  const [span, setSpan] = useState<{ start: number; end: number } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { try { sessionStorage.setItem(storeKey, JSON.stringify(turns)) } catch { /* convenience only */ } endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, storeKey])

  if (status === 'loading') return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>
  if (status === 'missing') return <ErrorState title="Memory not found" message="This memory doesn't exist in your archive." />
  if (status === 'error' || !echo) return <ErrorState message={error} retry={reload} />
  if (echo.forgottenAt) return <ErrorState title="This memory was forgotten" message="Its key was destroyed, so there is nothing left to ask about." />

  const readable = echo.tellings.filter((t) => t.text != null)
  const telling = readable[vi ?? 0] ?? readable[0]
  if (!telling) return <ErrorState title="Unreadable" message="This memory's stored text was altered and can no longer be decrypted, so it can't be questioned. See Provenance." />

  async function send(question: string) {
    const text = question.trim()
    if (!text || busy) return
    setQ(''); setBusy(true); setSpan(null)
    const turn: Turn = { q: text, tellingId: telling!.id }
    setTurns((t) => [...t, turn])
    try {
      const others = readable.filter((t) => t.id !== telling!.id).map((t) => ({ label: t.label, text: t.text! }))
      const result = await ask(telling!.text!, text, others)
      setTurns((t) => t.map((x) => (x === turn ? { ...x, result } : x)))
    } catch (e) {
      setTurns((t) => t.map((x) => (x === turn ? { ...x, error: (e as Error).message } : x)))
    }
    setBusy(false)
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(q) }
  }

  return (
    <div className="grid xl:grid-cols-[1fr_380px] gap-6 h-full">
      <div className="card flex flex-col min-h-[calc(100vh-6rem)] overflow-hidden">
        <header className="border-b border-bronze/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><button onClick={() => nav(-1)} aria-label="Back" className="text-muted hover:text-ivory"><ArrowLeft size={20} /></button><h1 className="font-serif text-3xl">Echo Room</h1></div>
            <div className="flex items-center gap-2">
              {ai === 'demo' && <DemoLabel>AI offline · demo answers</DemoLabel>}
              {turns.length > 0 && <button className="btn-ghost py-2 text-sm" onClick={() => setTurns([])}><RotateCcw size={14} />New conversation</button>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <EchoArt echo={echo} className="size-20 rounded-xl" />
            <div className="min-w-0">
              <Link to={`/echoes/${echo.id}`} className="font-serif text-2xl hover:text-gold">{echo.title}</Link>
              <p className="text-sm text-muted">{formatDate(echo.memoryDate)}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">{echo.tags.slice(0, 4).map((t) => <TagChip key={t} tag={t} />)}</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6" aria-live="polite">
          {turns.length === 0 && (
            <div className="text-center py-10 space-y-4">
              <p className="font-serif text-2xl">Question this memory</p>
              <p className="text-muted max-w-md mx-auto">Every answer is marked <span className="text-emerald">source-backed</span>, <span className="text-violet">interpretation</span> or <span className="text-amber">unknown</span>. Leading questions get checked against what you actually wrote.</p>
              <div className="flex flex-wrap justify-center gap-2">{(sampleQuestions(echo.title) ?? SUGGESTIONS).map((s) => <button key={s} className="btn-ghost text-sm py-2" onClick={() => send(s)}>{s}</button>)}</div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className="space-y-3">
              <div className="flex justify-end"><p className="max-w-[80%] rounded-2xl rounded-br-md bg-[#2a3140] px-4 py-2.5 text-[15px]">{t.q}</p></div>
              {t.result ? <Answer r={t.result} onShow={setSpan} /> : t.error ? (
                <div role="alert" className="card border-danger/50 p-4 max-w-2xl"><p className="text-danger text-sm">{t.error}</p><button className="text-sm text-gold mt-1 hover:underline" onClick={() => send(t.q)}>Try again</button></div>
              ) : <p className="flex items-center gap-2 text-muted text-sm"><Loader2 size={16} className="animate-spin" />Checking your memory…</p>}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form className="border-t border-bronze/40 p-4 flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); send(q) }}>
          <label className="flex-1"><span className="sr-only">Ask about this memory</span>
            <textarea rows={1} className="input resize-none max-h-40" placeholder="Ask about this memory…  (Enter to send, Shift+Enter for a new line)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          </label>
          <button className="btn-primary px-3.5 py-3" aria-label="Send" disabled={busy || !q.trim()}>{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}</button>
        </form>
      </div>

      <aside className="card p-5 h-fit xl:sticky xl:top-4 space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">The original</h2><span className="text-xs text-emerald">sealed</span></div>
        {readable.length > 1 && (
          <div className="flex flex-wrap gap-2">{readable.map((t, i) => (
            <button key={t.id} onClick={() => { setVi(i); setSpan(null) }} className={`rounded-full border px-3 py-1 text-xs ${telling.id === t.id ? 'bg-gold text-night border-gold' : 'border-bronze/60 text-muted'}`}>{t.label}</button>
          ))}</div>
        )}
        <SourceText text={telling.text!} span={span} className="text-lg" />
        <p className="text-xs text-muted">Questions are answered from this telling only{readable.length > 1 ? '; other tellings are checked by the assumption guard' : ''}.</p>
      </aside>
    </div>
  )
}
