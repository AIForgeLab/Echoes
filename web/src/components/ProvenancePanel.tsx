import { useState } from 'react'
import { CheckCircle2, Copy, Download, FileText, Info, ShieldAlert, Skull, Sparkles, XCircle } from 'lucide-react'
import type { EchoDetail } from '../types'
import type { SealCheck } from '../lib/seal'
import { portraitUri } from '../lib/portrait'
import { formatDateTime, shortHash } from '../lib/format'
import { bundleOf, downloadJson } from '../lib/exportBundle'
import { contentHash } from '../lib/seal'
import { tamperText } from '../services/adapter'
import { data } from '../services/data'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'

export default function ProvenancePanel({ echo, seal, onChanged }: { echo: EchoDetail; seal: SealCheck[]; onChanged: () => void }) {
  const toast = useToast()
  const [tamperOpen, setTamperOpen] = useState(false)
  const live = data.mode === 'live'
  const [sim, setSim] = useState<{ word: string; hash: string } | null>(null)
  const latest = echo.tellings.at(-1)
  const latestSeal = seal.find((s) => s.versionNo === latest?.versionNo)
  const allOk = seal.length > 0 && seal.every((s) => s.ok)

  async function copy(h: string) {
    try { await navigator.clipboard.writeText(h); toast('success', 'Hash copied.') } catch { toast('error', 'Copy failed. Select the hash and copy it manually.') }
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="flex gap-3">
          <figure className="text-center">
            <img src={portraitUri(echo.forgottenAt ? null : latest?.contentHash ?? null, echo.style)} alt="Seal portrait generated from the stored hash" className="size-32 rounded-xl border border-bronze/60" />
            <figcaption className="text-xs text-muted mt-1">Sealed portrait</figcaption>
          </figure>
          {sim && (
            <figure className="text-center">
              <img src={portraitUri(sim.hash, echo.style)} alt="Portrait generated from the simulated, altered text" className="size-32 rounded-xl border border-danger/70" />
              <figcaption className="text-xs text-danger mt-1">If one word changed</figcaption>
            </figure>
          )}
          {latestSeal && !latestSeal.ok && latestSeal.recomputedHash && (
            <figure className="text-center">
              <img src={portraitUri(latestSeal.recomputedHash, echo.style)} alt="Portrait generated from the text as it is now" className="size-32 rounded-xl border border-danger/70" />
              <figcaption className="text-xs text-danger mt-1">The text as it is now</figcaption>
            </figure>
          )}
        </div>
        <div className="space-y-3">
          <div className="card bg-surface-2 p-4">
            <p className="text-sm text-ivory/90 flex items-center gap-1.5">Content Hash (SHA-256)
              <span title="The hash is computed from the exact canonical text (Unicode NFC, single spaces). It detects any change to that text. It does not prove the memory is historically true." className="text-muted cursor-help"><Info size={14} /></span>
            </p>
            <div className="flex items-center justify-between gap-3 mt-1">
              <code className="text-sm text-muted break-all">{echo.forgottenAt ? 'destroyed with the key' : shortHash(latest?.contentHash)}</code>
              {latest?.contentHash && <button className="text-muted hover:text-gold" aria-label="Copy full hash" onClick={() => copy(latest.contentHash!)}><Copy size={16} /></button>}
            </div>
          </div>
          <div className={`flex items-center gap-2 text-sm ${allOk ? 'text-emerald' : 'text-danger'}`}>
            {allOk ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            {echo.forgottenAt ? 'Forgotten: nothing left to verify' : allOk ? 'Verified just now: every telling matches its seal' : 'Integrity check failed: see below'}
          </div>
          <p className="text-xs text-muted">A hash shows whether this exact text changed. It cannot show whether the memory itself is true.</p>
        </div>
      </div>

      {sim && (
        <div role="status" className="card border-danger/50 bg-danger/5 p-4 text-sm space-y-1">
          <p className="text-danger font-medium">Simulation: one word changed to “{sim.word}”</p>
          <p>The altered copy hashes to <code className="text-muted">{shortHash(sim.hash)}</code>, but the seal says <code className="text-muted">{shortHash(latest?.contentHash)}</code>. Echoes would flag this telling as changed.</p>
          <p className="text-xs text-muted">Nothing was saved: the stored memory is untouched. <button className="text-gold hover:underline" onClick={() => setSim(null)}>Clear</button></p>
        </div>
      )}

      <div>
        <h3 className="font-serif text-xl mb-2">Seal chain</h3>
        <ol className="space-y-2">
          {echo.tellings.map((t) => {
            const s = seal.find((x) => x.versionNo === t.versionNo)
            return (
              <li key={t.id} className="card bg-surface-2 p-3 flex items-start gap-3">
                {s?.ok ? <CheckCircle2 size={18} className="text-emerald mt-0.5" /> : <XCircle size={18} className="text-danger mt-0.5" />}
                <div className="min-w-0 text-sm">
                  <p>{t.label} · sealed {formatDateTime(t.sealedAt)}</p>
                  <p className="text-xs text-muted break-all">links to {t.prevHash === 'genesis' ? 'genesis (first telling)' : shortHash(t.prevHash)} · chain {shortHash(t.chainHash)}</p>
                  {s && !s.ok && <p className="text-xs text-danger">{s.reason}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div>
        <h3 className="font-serif text-xl mb-2">History</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-3"><FileText size={16} className="text-gold mt-0.5" /><span>Original content stored · {formatDateTime(echo.tellings[0]?.sealedAt)}</span></li>
          {echo.summary && <li className="flex gap-3"><Sparkles size={16} className="text-violet mt-0.5" /><span>{echo.summaryGenerated ? 'Summary generated and stored separately from the original' : 'Summary written by you'}</span></li>}
          {echo.tellings.length > 1 && <li className="flex gap-3"><FileText size={16} className="text-gold mt-0.5" /><span>{echo.tellings.length - 1} retelling{echo.tellings.length > 2 ? 's' : ''} added; the original is unchanged</span></li>}
          {echo.tombstone && <li className="flex gap-3"><Skull size={16} className="text-muted mt-0.5" /><span>Forgotten {formatDateTime(echo.tombstone.forgottenAt)} · tombstone {shortHash(echo.tombstone.chainHash)}</span></li>}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button className="btn-ghost" onClick={() => downloadJson(`echo-${echo.title.toLowerCase().replace(/\W+/g, '-')}.json`, bundleOf([echo]))}><Download size={16} />Export sealed bundle</button>
        {!echo.forgottenAt && latest?.text && <button className="btn-ghost" onClick={() => setTamperOpen(true)}><ShieldAlert size={16} />Simulate tampering (demo)</button>}
      </div>

      <ConfirmDialog open={tamperOpen} title="Simulate tampering?" confirmLabel={live ? 'Run the simulation' : 'Change one word'} danger={!live} onClose={() => setTamperOpen(false)}
        onConfirm={async () => {
          try {
            if (live) {
              // Never write to a real memory: change a copy in the browser and compare hashes.
              const { text, word } = tamperText(latest!.text!)
              setSim({ word, hash: await contentHash(text) })
              setTamperOpen(false)
              return
            }
            const word = await data.tamper(echo.id, latest!.versionNo)
            toast('info', `One word was secretly changed to “${word}”. Watch the seal.`)
            setTamperOpen(false)
            onChanged()
          } catch (e) { toast('error', (e as Error).message) }
        }}>
        {live ? (
          <p>Echoes changes one word in a copy of the latest telling, in your browser only, and checks it against the seal. Your stored memory is not changed.</p>
        ) : (
          <>
            <p>This acts like someone with access to the stored data: it re-encrypts the latest telling with one word changed, without updating its seal.</p>
            <p>In demo mode it alters the copy kept in this browser. Reset demo data in Settings to undo it.</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}
