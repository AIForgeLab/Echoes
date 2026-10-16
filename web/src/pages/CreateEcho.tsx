import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Eye, Link2, Loader2, MessageCircle, ShieldCheck, Sparkles, Upload, Wand2, X } from 'lucide-react'
import { ART_STYLES, CATEGORIES, type ArtStyle, type Category, type EnhanceResult } from '../types'
import { contentHash } from '../lib/seal'
import { portraitUri } from '../lib/portrait'
import { prepareImage } from '../lib/image'
import { formatDate, cx } from '../lib/format'
import { enhance } from '../services/ai'
import { data } from '../services/data'
import { useApp } from '../state/AppState'
import { useToast } from '../components/Toast'
import { DemoLabel, PageHeader, TagChip } from '../components/ui'

const MAX = 2000
const SUGGESTED = ['childhood', 'travel', 'learning', 'family', 'friends', 'career', 'ideas']
const STEPS = ['Write', 'Enhance', 'Customize', 'Review'] as const
const DRAFT_KEY = 'echoes.draft.v1'

interface Draft {
  title: string; text: string; memoryDate: string; toldOn: string; tags: string[]
  category: Category; style: ArtStyle; cover: string | null; enhanced: EnhanceResult | null; useSummary: boolean
}
const EMPTY: Draft = { title: '', text: '', memoryDate: '', toldOn: new Date().toISOString().slice(0, 10), tags: [], category: 'Personal', style: 'Cinematic', cover: null, enhanced: null, useSummary: true }

function loadDraft(): Draft {
  try { return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') } } catch { return EMPTY }
}

export default function CreateEcho() {
  const nav = useNavigate()
  const toast = useToast()
  const { prefs, refreshEchoes } = useApp()
  const [d, setD] = useState<Draft>(loadDraft)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hash, setHash] = useState<string | null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceError, setEnhanceError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [upload, setUpload] = useState<{ pct: number; error: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))

  useEffect(() => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* draft is a convenience only */ } }, [d])
  useEffect(() => { let on = true; (d.text.trim() ? contentHash(d.text) : Promise.resolve(null)).then((h) => on && setHash(h)); return () => { on = false } }, [d.text])

  function validate(s: number): boolean {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!d.title.trim()) e.title = 'Give your memory a title.'
      if (d.text.trim().length < 20) e.text = 'Write at least a sentence or two (20+ characters).'
      if (d.text.length > MAX) e.text = `Keep it under ${MAX} characters.`
      if (d.memoryDate && d.memoryDate > new Date().toISOString().slice(0, 10)) e.memoryDate = 'That date is in the future.'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const next = () => { if (validate(step)) setStep((s) => Math.min(3, s + 1)) }

  async function runEnhance() {
    setEnhancing(true); setEnhanceError('')
    try {
      const r = await enhance(d.text)
      set({ enhanced: r, tags: d.tags.length ? d.tags : r.tags, category: r.category })
    } catch (e) {
      setEnhanceError((e as Error).message)
    }
    setEnhancing(false)
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9-]/g, '')
    if (t && !d.tags.includes(t) && d.tags.length < 8) set({ tags: [...d.tags, t] })
    setTagInput('')
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    setUpload({ pct: 0, error: '' })
    try {
      const url = await prepareImage(f, 900, (pct) => setUpload({ pct, error: '' }))
      set({ cover: url })
      setUpload(null)
    } catch (e) {
      setUpload({ pct: 0, error: (e as Error).message })
    }
  }

  async function save() {
    if (!validate(0)) { setStep(0); return }
    setSaving(true)
    try {
      const summary = d.enhanced && d.useSummary ? d.enhanced.summary : null
      const id = await data.createEcho({
        title: d.title, text: d.text, memoryDate: d.memoryDate || null, toldOn: d.toldOn || null, tags: d.tags,
        category: d.category, style: d.style, cover: d.cover, summary, summaryGenerated: !!summary, claims: d.enhanced?.claims ?? [],
      })
      try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      await refreshEchoes()
      toast('success', 'Your Echo is sealed.')
      nav(`/echoes/${id}`)
    } catch (e) {
      toast('error', `Not saved: ${(e as Error).message}`)
      setSaving(false)
    }
  }

  const preview = d.cover ?? portraitUri(hash, d.style)

  return (
    <div className="grid 2xl:grid-cols-[1fr_420px] gap-6">
      <div>
        <PageHeader title="Create a New Echo" subtitle="Turn your memory, story or idea into a living, interactive Echo." />
        {/* stepper */}
        <ol className="flex items-center mb-6 max-w-2xl" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <button onClick={() => (i < step || validate(step)) && setStep(i)} className="flex flex-col items-center gap-1.5" aria-current={i === step ? 'step' : undefined}>
                <span className={cx('grid place-items-center size-8 rounded-full border text-sm', i === step ? 'bg-gold text-night border-gold' : i < step ? 'border-gold text-gold' : 'border-bronze text-muted')}>{i + 1}</span>
                <span className={cx('text-sm', i === step ? 'text-gold' : 'text-muted')}>{s}</span>
              </button>
              {i < 3 && <span className={cx('h-px flex-1 mx-2 -mt-6', i < step ? 'bg-gold' : 'bg-bronze/60')} />}
            </li>
          ))}
        </ol>

        <div className="card p-6 space-y-6">
          {step === 0 && (
            <>
              <div>
                <label htmlFor="title" className="font-serif text-2xl block mb-1">Memory title</label>
                <input id="title" className="input" placeholder="My First Robot" value={d.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!errors.title} />
                {errors.title && <p className="text-sm text-danger mt-1">{errors.title}</p>}
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="text" className="font-serif text-2xl">Write Your Memory</label>
                  <span className={cx('text-sm', d.text.length > MAX ? 'text-danger' : 'text-muted')}>{d.text.length}/{MAX}</span>
                </div>
                <p className="text-sm text-muted mb-2">Share your memory, story, experience or idea, in your own words. This original is sealed and never rewritten.</p>
                <textarea id="text" className="input min-h-44" placeholder="Write your memory here…" value={d.text} onChange={(e) => set({ text: e.target.value })} aria-invalid={!!errors.text} />
                {errors.text && <p className="text-sm text-danger mt-1">{errors.text}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mdate" className="label">When did it happen? (optional)</label>
                  <input id="mdate" type="date" className="input" value={d.memoryDate} onChange={(e) => set({ memoryDate: e.target.value })} />
                  {errors.memoryDate && <p className="text-sm text-danger mt-1">{errors.memoryDate}</p>}
                </div>
                <div>
                  <label htmlFor="told" className="label">Date written</label>
                  <input id="told" type="date" className="input" value={d.toldOn} onChange={(e) => set({ toldOn: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-serif text-2xl">Enhance</h2>
              <p className="text-muted">Echoes can suggest a title, a one-line summary, themes and tags, and split your memory into individual facts it can quote later. Your original text is never changed.</p>
              {!prefs.aiEnhance ? (
                <p className="text-amber text-sm">AI enhancement is turned off in Settings. You can skip this step.</p>
              ) : (
                <button className="btn-primary" onClick={runEnhance} disabled={enhancing}>{enhancing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}{d.enhanced ? 'Generate again' : 'Generate summary & themes'}</button>
              )}
              {enhanceError && <p role="alert" className="text-sm text-danger">{enhanceError} You can skip this step; manual creation still works.</p>}
              {d.enhanced && (
                <div className="card bg-surface-2 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-violet text-sm inline-flex items-center gap-1"><Sparkles size={14} />Generated suggestions</span>
                    {d.enhanced.source === 'demo' && <DemoLabel>Offline demo · word matching, not AI</DemoLabel>}
                  </div>
                  <div><p className="text-xs text-muted">Suggested title</p><div className="flex items-center gap-3"><p className="font-serif text-xl">{d.enhanced.title}</p><button className="text-sm text-gold hover:underline" onClick={() => set({ title: d.enhanced!.title })}>Use it</button></div></div>
                  <div>
                    <p className="text-xs text-muted">Summary (stored separately from your words)</p>
                    <p className="text-ivory/90">{d.enhanced.summary}</p>
                    <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" className="accent-[#f4d18e]" checked={d.useSummary} onChange={(e) => set({ useSummary: e.target.checked })} />Keep this summary</label>
                  </div>
                  <div><p className="text-xs text-muted">Theme</p><p>{d.enhanced.category}</p></div>
                  <div><p className="text-xs text-muted mb-1">Tags</p><div className="flex flex-wrap gap-1.5">{d.enhanced.tags.map((t) => <TagChip key={t} tag={t} />)}</div></div>
                  <p className="text-xs text-muted">{d.enhanced.claims.length} facts extracted, each tied to the exact words it came from.</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-2xl">Add Tags</h2>
                <p className="text-sm text-muted mb-2">Tags connect this memory with related ones on the Memory Map.</p>
                <div className="flex flex-wrap gap-1.5 mb-2">{d.tags.map((t) => <TagChip key={t} tag={t} onRemove={() => set({ tags: d.tags.filter((x) => x !== t) })} />)}</div>
                <input className="input" placeholder="e.g. childhood, travel, learning… (press Enter)" value={tagInput} aria-label="Add a tag"
                  onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }} onBlur={() => tagInput && addTag(tagInput)} />
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-sm text-muted">Suggested: {SUGGESTED.filter((t) => !d.tags.includes(t)).map((t) => <TagChip key={t} tag={t} onClick={() => addTag(t)} />)}</div>
              </div>
              <div>
                <label htmlFor="cat" className="font-serif text-2xl block mb-2">Theme</label>
                <select id="cat" className="input w-auto" value={d.category} onChange={(e) => set({ category: e.target.value as Category })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <div>
                <h2 className="font-serif text-2xl">Choose a Style</h2>
                <p className="text-sm text-muted mb-3">The style paints this memory's seal portrait, generated from its fingerprint.</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3" role="radiogroup" aria-label="Visual style">
                  {ART_STYLES.map((s) => (
                    <button key={s} role="radio" aria-checked={d.style === s} onClick={() => set({ style: s })} className="flex flex-col items-center gap-1.5">
                      <img src={portraitUri(hash, s)} alt="" className={cx('aspect-[4/3] w-full rounded-xl object-cover border', d.style === s ? 'border-gold glow' : 'border-bronze/50')} />
                      <span className={cx('text-sm', d.style === s ? 'text-gold' : 'text-ivory/80')}>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="font-serif text-2xl">Add an Image (optional)</h2>
                <p className="text-sm text-muted mb-2">A photo to show on this Echo's card. Without one, the seal portrait is used.</p>
                {d.cover ? (
                  <div className="flex items-center gap-4"><img src={d.cover} alt="Selected" className="h-24 rounded-xl" /><button className="btn-ghost" onClick={() => set({ cover: null })}><X size={16} />Remove image</button></div>
                ) : (
                  <button className="w-full rounded-xl border border-dashed border-bronze/70 py-8 flex flex-col items-center gap-1 hover:border-gold"
                    onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}>
                    <Upload size={22} className="text-gold" /><span>Drag and drop an image here</span><span className="text-sm text-muted">or click to upload · JPG, PNG, WEBP up to 5 MB</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                {upload && !upload.error && <div className="mt-2 h-1.5 rounded bg-surface-2"><div className="h-full rounded bg-gold" style={{ width: `${upload.pct}%` }} /></div>}
                {upload?.error && <p className="text-sm text-danger mt-2">{upload.error}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-serif text-2xl">Review</h2>
              <div><p className="text-xs uppercase tracking-wider text-emerald mb-1">Your original words · will be sealed</p><p className="card bg-surface-2 p-4 font-serif text-xl leading-relaxed whitespace-pre-wrap">{d.text}</p></div>
              {d.enhanced && d.useSummary && <div><p className="text-xs uppercase tracking-wider text-violet mb-1">Generated summary · stored separately</p><p className="text-ivory/85">{d.enhanced.summary}</p></div>}
              <dl className="grid sm:grid-cols-3 gap-3 text-sm">
                <div><dt className="text-muted">Title</dt><dd>{d.title}</dd></div>
                <div><dt className="text-muted">Happened</dt><dd>{formatDate(d.memoryDate || null)}</dd></div>
                <div><dt className="text-muted">Theme · Style</dt><dd>{d.category} · {d.style}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-1.5">{d.tags.map((t) => <TagChip key={t} tag={t} />)}</div>
              <p className="text-sm text-muted">Need a change? Use Back. Your draft is kept while you move between steps.</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-bronze/30 pt-5">
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => { try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } nav('/echoes') }}>Cancel</button>
              {step > 0 && <button className="btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} />Back</button>}
            </div>
            {step < 3 ? (
              <button className="btn-primary" onClick={next}>{step === 1 && !d.enhanced ? 'Skip' : 'Next'}<ArrowRight size={16} /></button>
            ) : (
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}Seal & Save Echo</button>
            )}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <aside className="card p-6 h-fit 2xl:sticky 2xl:top-4 bg-gradient-to-b from-[#16110b] to-surface">
        <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl flex items-center gap-2"><Sparkles size={18} className="text-gold" />Echo Preview</h2><span className="text-xs text-muted inline-flex items-center gap-1"><Eye size={14} />Live</span></div>
        <img src={preview} alt="Preview artwork" className="w-full aspect-[4/3] rounded-xl object-cover border border-bronze/40" />
        <h3 className="font-serif text-4xl mt-4">{d.title || 'Untitled Echo'}</h3>
        <p className="text-muted flex items-center gap-2 mt-1"><CalendarDays size={16} />{formatDate(d.memoryDate || null)}</p>
        <p className="text-ivory/85 mt-3 line-clamp-6 whitespace-pre-wrap">{d.text || 'Your memory will appear here as you write.'}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">{d.tags.map((t) => <TagChip key={t} tag={t} />)}</div>
        <div className="border-t border-bronze/30 mt-5 pt-4">
          <h4 className="font-serif text-xl mb-3">What happens next?</h4>
          <ul className="space-y-3 text-sm text-ivory/85">
            <li className="flex gap-3"><ShieldCheck size={18} className="text-gold shrink-0" />Your words are encrypted and sealed with a SHA-256 fingerprint.</li>
            <li className="flex gap-3"><MessageCircle size={18} className="text-gold shrink-0" />You can question it in the Echo Room. Every answer shows what you said.</li>
            <li className="flex gap-3"><Link2 size={18} className="text-gold shrink-0" />It connects to related memories through shared tags and themes.</li>
            <li className="flex gap-3"><Wand2 size={18} className="text-gold shrink-0" />You can retell it later, or forget it for good.</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
