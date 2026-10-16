import { useState } from 'react'
import { Loader2, ScanSearch } from 'lucide-react'
import type { DriftPair, EchoDetail, Telling } from '../types'
import { align, enhance } from '../services/ai'
import { data } from '../services/data'
import { cx } from '../lib/format'
import { DemoLabel } from './ui'

const LABEL: Record<DriftPair['label'], { text: string; cls: string; dot: string }> = {
  consistent: { text: 'Kept', cls: 'border-emerald/40 bg-emerald/10', dot: 'bg-emerald' },
  changed: { text: 'Changed', cls: 'border-flame/50 bg-flame/10', dot: 'bg-flame' },
  omitted: { text: 'Faded away', cls: 'border-danger/40 bg-danger/10', dot: 'bg-danger' },
  new: { text: 'Appeared later', cls: 'border-violet/50 bg-violet/10', dot: 'bg-violet' },
}

/** Pentimento: X-ray two tellings of one memory and see how it drifted. */
export default function Pentimento({ echo, onClaimsSaved }: { echo: EchoDetail; onClaimsSaved: () => void }) {
  const readable = echo.tellings.filter((t) => t.text != null)
  const [a, setA] = useState(0)
  const [b, setB] = useState(Math.max(0, readable.length - 1))
  const [mix, setMix] = useState(1)
  const [pairs, setPairs] = useState<DriftPair[] | null>(null)
  const [source, setSource] = useState<'live' | 'demo' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (readable.length < 2) {
    return <p className="text-muted">Pentimento needs at least two tellings. Use <strong className="text-ivory">Retell</strong> to write this memory again from scratch, without looking, and Echoes will show how it has drifted.</p>
  }
  const older = readable[a]!, newer = readable[b]!

  async function claimsOf(t: Telling): Promise<string[]> {
    if (t.claims.length) return t.claims.map((c) => c.text)
    const r = await enhance(t.text!)
    await data.saveClaims(echo.id, t.versionNo, r.claims)
    onClaimsSaved()
    return r.claims.map((c) => c.text)
  }

  async function run() {
    setBusy(true); setError('')
    try {
      const out = await align(await claimsOf(older), await claimsOf(newer))
      setPairs(out.pairs); setSource(out.source)
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  const pick = (val: number, setter: (n: number) => void, label: string) => (
    <label className="text-sm"><span className="sr-only">{label}</span>
      <select className="input w-auto py-2" value={val} onChange={(e) => { setter(Number(e.target.value)); setPairs(null) }}>
        {readable.map((t, i) => <option key={t.id} value={i}>{t.label}</option>)}
      </select>
    </label>
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">In painting, a <em>pentimento</em> is an earlier version hidden under later paint, revealed by X-ray. Every time you remember, you repaint.</p>
      <p className="text-xs text-muted">A comparison aid, not a verdict: facts are paired by their wording, then an AI labels each pair. Read both tellings before drawing conclusions.</p>
      <div className="flex flex-wrap items-center gap-2">
        {pick(a, setA, 'Earlier telling')}<span className="text-muted text-sm">underneath</span>{pick(b, setB, 'Later telling')}
        <button className="btn-primary" onClick={run} disabled={busy || a === b}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}X-ray</button>
      </div>

      <div className="card bg-surface-2 p-5 grid">
        <p style={{ opacity: 1 - mix, gridArea: '1 / 1' }} className="font-serif text-xl leading-relaxed text-[#9fb8ff]">{older.text}</p>
        <p style={{ opacity: mix, gridArea: '1 / 1' }} className="font-serif text-xl leading-relaxed">{newer.text}</p>
      </div>
      <div>
        <input type="range" min={0} max={1} step={0.01} value={mix} onChange={(e) => setMix(Number(e.target.value))} className="w-full accent-[#f4d18e]" aria-label="Blend between the earlier and later telling" />
        <div className="flex justify-between text-xs text-muted"><span>← {older.label} (underneath)</span><span className="hidden sm:inline">drag to reveal the earlier layer</span><span>{newer.label} (surface) →</span></div>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {pairs && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            {Object.entries(LABEL).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cx('size-2 rounded-full', v.dot)} />{v.text}</span>)}
            {source === 'demo' && <DemoLabel>Offline demo · word overlap, not AI</DemoLabel>}
          </div>
          {pairs.map((p, i) => (
            <div key={i} className={cx('rounded-xl border px-4 py-2.5 text-sm', LABEL[p.label].cls)}>
              <span className="text-[10px] uppercase tracking-wider opacity-80 mr-2">{LABEL[p.label].text}</span>
              {p.label === 'changed' ? <><s className="opacity-60">{p.old}</s> <span className="text-muted">→</span> {p.new}</> : p.label === 'omitted' ? <s>{p.old}</s> : p.new ?? p.old}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
