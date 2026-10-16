import { Link, useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppState'
import { data } from '../services/data'
import { useToast } from '../components/Toast'
import { DemoLabel } from '../components/ui'
import { useState } from 'react'

export default function Landing() {
  const { user } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function demo() {
    setBusy(true)
    try {
      await data.auth.enterDemo!()
      nav('/dashboard')
    } catch (e) {
      toast('error', (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="starfield min-h-screen grid place-items-center px-4 py-10">
      <div className="card w-full max-w-md overflow-hidden flex flex-col items-center text-center bg-gradient-to-b from-[#1a140c] to-night">
        <div className="pt-12 px-8">
          <h1 className="font-serif text-7xl text-ivory">Echoes</h1>
          <p className="text-lg text-ivory/90 mt-1">The Living Memory Archive</p>
          <p className="text-muted mt-5 leading-relaxed">Preserve the memory.<br />Question the meaning.<br />Verify the truth.<br />Respect the right to forget.</p>
        </div>
        <img src="/art/portal.jpg" alt="A glowing golden portal rising over still water at dusk" className="w-full h-72 object-cover object-center -mt-2 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_75%,transparent)]" />
        <div className="w-full px-8 pb-10 -mt-4 flex flex-col gap-3">
          {user ? (
            <Link to="/dashboard" className="btn-primary w-full py-3">Continue to your archive</Link>
          ) : (
            <>
              <Link to="/signup" className="btn-primary w-full py-3">Get Started</Link>
              <Link to="/login" className="btn-ghost w-full py-3 rounded-full">Sign In</Link>
              {data.mode === 'demo' && (
                <button onClick={demo} disabled={busy} className="text-sm text-gold hover:underline mt-1">
                  {busy ? 'Preparing sample memories…' : 'Explore the demo archive →'}
                </button>
              )}
            </>
          )}
          <p className="text-sm text-muted mt-3">Your memories. Your control. Always.</p>
          <ul className="flex justify-center gap-4 text-xs text-muted mt-1">
            <li className="flex items-center gap-1"><Lock size={12} className="text-gold" />Encrypted per memory</li>
            <li className="flex items-center gap-1"><ShieldCheck size={12} className="text-gold" />Sealed originals</li>
            <li className="flex items-center gap-1"><Trash2 size={12} className="text-gold" />Real forgetting</li>
          </ul>
          {data.mode === 'demo' && <div className="mt-2"><DemoLabel>Demo mode: data stays in this browser</DemoLabel></div>}
        </div>
      </div>
    </div>
  )
}
