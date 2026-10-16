import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { data } from '../services/data'
import { enhance } from '../services/ai'
import { useApp } from '../state/AppState'
import { useToast } from './Toast'

/** Retelling adds a new sealed version. The original stays sealed underneath. */
export default function RetellDialog({ echoId, open, onClose, onSaved }: { echoId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const toast = useToast()
  const { prefs } = useApp()
  const [text, setText] = useState('')
  const [toldOn, setToldOn] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const d = ref.current
    if (open && d && !d.open) { d.showModal(); setText(''); setError('') }
    if (!open && d?.open) d.close()
  }, [open])

  async function save() {
    if (text.trim().length < 20) return setError('Write at least a sentence or two.')
    setBusy(true); setError('')
    try {
      let claims: Awaited<ReturnType<typeof enhance>>['claims'] = []
      if (prefs.aiEnhance) {
        try { claims = (await enhance(text)).claims } catch { /* claims can be extracted later in Pentimento */ }
      }
      await data.retell(echoId, { text, toldOn: toldOn || null, claims })
      toast('success', 'New telling sealed. The original is untouched underneath.')
      onSaved()
      onClose()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  return (
    <dialog ref={ref} onClose={onClose} className="card m-auto w-[min(560px,calc(100vw-2rem))] p-0 text-ivory backdrop:bg-black/70">
      <div className="p-6 space-y-4">
        <h2 className="font-serif text-3xl">Retell this memory</h2>
        <p className="text-sm text-muted">Write it again from scratch, without looking at the original. Echoes seals this as a new telling and keeps the original exactly as it was, so you can X-ray how the memory has drifted.</p>
        <textarea className="input min-h-40" value={text} onChange={(e) => setText(e.target.value)} placeholder="When I was ten…" aria-label="Your retelling" maxLength={2000} />
        <label className="block text-sm">Date written<input type="date" className="input mt-1 w-auto" value={toldOn} onChange={(e) => setToldOn(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Seal this telling</button>
        </div>
      </div>
    </dialog>
  )
}
