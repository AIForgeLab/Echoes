import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, KeyRound, Loader2, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppState'
import { data } from '../services/data'
import { recheckAi } from '../services/ai'
import { API_URL, APP_VERSION } from '../config'
import { bundleOf, downloadJson } from '../lib/exportBundle'
import { initials } from '../lib/format'
import { passwordProblems } from './Auth'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { DemoLabel, PageHeader } from '../components/ui'
import type { EchoDetail } from '../types'

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="card p-6 space-y-4">
      <h2 id={id} className="font-serif text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-6 cursor-pointer">
      <span><span className="block text-ivory">{label}</span><span className="block text-sm text-muted">{hint}</span></span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 accent-[#f4d18e]" />
    </label>
  )
}

export default function Settings() {
  const { user, setUser, prefs, setPrefs, ai, echoes, refreshEchoes } = useApp()
  const toast = useToast()
  const nav = useNavigate()
  const [name, setName] = useState(user?.name ?? '')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [aiState, setAiState] = useState(ai)

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try { await fn() } catch (e) { toast('error', (e as Error).message) }
    setBusy(null)
  }

  const savePref = (p: typeof prefs) => { if (!setPrefs(p)) toast('error', 'This browser blocked saving preferences; they apply until you reload.') }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Your profile, privacy and data." />

      <Section title="Profile" id="s-profile">
        <div className="flex items-center gap-4">
          <span className="grid place-items-center size-16 rounded-full bg-[#5b5866] text-xl">{initials(name || user?.name || '')}</span>
          <div className="text-sm"><p className="text-ivory">{user?.email}</p><p className="text-muted">{data.mode === 'demo' ? 'Demo account in this browser' : 'Signed in with Supabase'}</p></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1"><span className="label">Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
          <button className="btn-primary" disabled={busy === 'name' || !name.trim() || name === user?.name}
            onClick={() => run('name', async () => { setUser(await data.auth.updateProfile({ name })); toast('success', 'Profile saved.') })}>Save profile</button>
        </div>
      </Section>

      <Section title="Appearance" id="s-appearance">
        <p className="text-sm text-muted">Echoes uses its dark theme everywhere. These preferences are saved in this browser.</p>
        <Toggle label="Reduce motion" hint="Turns off transitions and animations." checked={prefs.reducedMotion} onChange={(v) => savePref({ ...prefs, reducedMotion: v })} />
        <Toggle label="Subtle visual effects" hint="Removes the star field and softens glows." checked={prefs.effects === 'subtle'} onChange={(v) => savePref({ ...prefs, effects: v ? 'subtle' : 'full' })} />
      </Section>

      <Section title="Privacy and AI" id="s-privacy">
        <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
          <li>Each memory is encrypted in your browser with its own key before it is stored.</li>
          <li>Memories are private to your account. Nothing is shared publicly.</li>
          <li>When you use an AI feature, only that memory's text (and its other tellings, for the assumption check) is sent to the Echoes AI server, which forwards it to Google Gemini. Your other memories are never sent.</li>
          <li>Generated summaries are always stored and shown separately from your own words.</li>
        </ul>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-bronze/40 bg-surface-2 p-4 text-sm">
          <span>AI service: {aiState === 'live' ? <span className="text-emerald">connected ({API_URL})</span> : <><span className="text-amber">offline</span> · answers use the labelled demo rules{!API_URL && ' (VITE_API_URL is not set)'}</>}</span>
          <button className="btn-ghost py-2 text-sm" onClick={async () => setAiState(await recheckAi())}><RefreshCw size={14} />Check again</button>
        </div>
        <Toggle label="AI enhancements when creating" hint="Suggest a summary, tags and facts in step 2 of Create. Off: nothing is sent while creating." checked={prefs.aiEnhance} onChange={(v) => savePref({ ...prefs, aiEnhance: v })} />
      </Section>

      <Section title="Security" id="s-security">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1"><span className="label">New password</span><input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
          <button className="btn-ghost" disabled={busy === 'pw' || !pw}
            onClick={() => { const p = passwordProblems(pw); if (p.length) return toast('error', `Password needs ${p.join(' and ')}.`); run('pw', async () => { await data.auth.updatePassword(pw); setPw(''); toast('success', 'Password changed.') }) }}><KeyRound size={16} />Change password</button>
        </div>
        <button className="btn-ghost" onClick={async () => { await data.auth.signOut(); nav('/') }}><LogOut size={16} />Sign out of this device</button>
      </Section>

      <Section title="Data management" id="s-data">
        <div className="flex flex-wrap gap-3">
          <button className="btn-ghost" disabled={busy === 'export' || !echoes?.length}
            onClick={() => run('export', async () => {
              const all = (await Promise.all((echoes ?? []).map((e) => data.getEcho(e.id)))).filter(Boolean) as EchoDetail[]
              downloadJson(`echoes-archive-${new Date().toISOString().slice(0, 10)}.json`, bundleOf(all))
              toast('success', `Exported ${all.length} memories with their seals.`)
            })}>{busy === 'export' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Export all memories (JSON)</button>
          <button className="btn-danger" onClick={() => setClearOpen(true)} disabled={!echoes?.some((e) => !e.forgottenAt)}><Trash2 size={16} />Forget all memories</button>
          {data.mode === 'demo' && data.resetDemo && (
            <button className="btn-ghost" disabled={busy === 'reset'} onClick={() => run('reset', async () => { await data.resetDemo!(); await refreshEchoes(); toast('success', 'Demo archive reset.') })}><RefreshCw size={16} />Reset demo data</button>
          )}
        </div>
        <div className="text-sm text-muted space-y-1.5">
          <p><strong className="text-ivory">What forgetting does:</strong> deletes summaries, tags and extracted facts, then destroys the memory's encryption key. The remaining ciphertext can never be decrypted, and a tombstone records that something was forgotten.</p>
          <p><strong className="text-ivory">Limits:</strong> {data.mode === 'live'
            ? "each key is stored in the same database as the encrypted text, in a separate access-controlled table. A database backup made before you forget a memory holds both, so that memory can still be read from the backup until the backup is deleted under your database provider's retention schedule."
            : "in demo mode everything lives in this browser's storage, and Echoes keeps no other copies."} Text already sent to the AI provider is covered by that provider's own retention policy, which Echoes cannot control.</p>
          <p><strong className="text-ivory">Deleting your account</strong> requires a server-side action that this app doesn't include yet. {data.mode === 'live' ? 'Forget all memories first, then ask the project owner to remove the account in Supabase.' : 'In demo mode, clearing this site\'s browser data removes everything.'}</p>
        </div>
      </Section>

      <Section title="About" id="s-about">
        <p className="text-ivory">Echoes — The Living Memory Archive <span className="text-muted">· v{APP_VERSION}</span> {data.mode === 'demo' && <DemoLabel>Demo mode</DemoLabel>}</p>
        <p className="text-sm text-muted italic">Preserve the memory. Question the meaning. Verify the truth. Respect the right to forget.</p>
        <p className="text-sm text-muted"><strong className="text-ivory">The Truth Boundary:</strong> every AI answer is split into what you actually wrote (source-backed, with the exact quote checked in code), what the AI infers (interpretation), and what your memory doesn't say (unknown). Leading questions are checked against your words before anything is answered.</p>
        <p className="text-xs text-muted">Built with React, Vite, Tailwind CSS, React Router, React Flow (@xyflow/react), Lucide icons, Supabase, Flask and Google Gemini. Seal portraits follow Perrig &amp; Song's hash visualization (1999). Theatre view after Giulio Camillo's Theatre of Memory.</p>
      </Section>

      <ConfirmDialog open={clearOpen} title="Forget every memory?" confirmLabel="Forget everything" danger typeToConfirm="forget" onClose={() => setClearOpen(false)}
        onConfirm={() => run('clear', async () => { const n = await data.forgetAll(); await refreshEchoes(); setClearOpen(false); toast('success', `${n} memories forgotten. Their keys were destroyed.`) })}>
        <p>Every memory's key will be destroyed. This cannot be undone.</p>
      </ConfirmDialog>
    </div>
  )
}
