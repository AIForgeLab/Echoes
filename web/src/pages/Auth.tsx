import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { data } from '../services/data'
import { DemoLabel } from '../components/ui'

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="starfield min-h-screen grid place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-8 bg-gradient-to-b from-[#16110b] to-surface">
        <Link to="/" className="font-serif text-3xl text-ivory">Echoes</Link>
        <h1 className="font-serif text-4xl mt-6">{title}</h1>
        <p className="text-muted mt-1 mb-6">{subtitle}</p>
        {data.mode === 'demo' && <div className="mb-4"><DemoLabel>Demo mode: accounts exist only in this browser</DemoLabel></div>}
        {children}
      </div>
    </div>
  )
}

function Password({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} className="input pr-11" value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ivory">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )
}

function Feedback({ error, info }: { error?: string; info?: string }) {
  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>
  if (info) return <p role="status" className="text-sm text-emerald">{info}</p>
  return null
}

/** Turn provider errors into something a person can act on. */
export function friendlyAuthError(msg: string): string {
  if (/invalid login credentials/i.test(msg))
    return 'That email and password don\'t match an account. Check for typos (passwords are case-sensitive), make sure you\'re using the email you signed up with, or reset your password.'
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.'
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Wait a minute, then try again.'
  if (/failed to fetch|network/i.test(msg)) return 'Can\'t reach the sign-in service. Check your internet connection.'
  return msg
}

export function passwordProblems(pw: string): string[] {
  const p: string[] = []
  if (pw.length < 8) p.push('at least 8 characters')
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) p.push('letters and a number')
  return p
}

export function Login() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await data.auth.signIn(email.trim(), pw)
      nav(loc.state?.from || '/dashboard', { replace: true })
    } catch (err) {
      setError(friendlyAuthError((err as Error).message))
      setBusy(false)
    }
  }

  return (
    <Shell title="Welcome back" subtitle="Sign in to your memory archive.">
      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        <div><label htmlFor="email" className="label">Email address</label><input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
        <Password id="pw" label="Password" value={pw} onChange={setPw} autoComplete="current-password" />
        <div className="flex justify-end text-sm"><Link to="/forgot-password" className="text-gold hover:underline">Forgot password?</Link></div>
        <Feedback error={error} />
        <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Sign In</button>
        <p className="text-sm text-muted text-center">New to Echoes? <Link to="/signup" className="text-gold hover:underline">Create an account</Link></p>
        {data.mode === 'demo' && (
          <button type="button" className="btn-ghost w-full" onClick={async () => { await data.auth.enterDemo!(); nav('/dashboard') }}>Explore the demo archive instead</button>
        )}
      </form>
    </Shell>
  )
}

export function Signup() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const problems = passwordProblems(pw)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!name.trim()) return setError('Please enter your name.')
    if (problems.length) return setError(`Password needs ${problems.join(' and ')}.`)
    if (pw !== pw2) return setError('The passwords do not match.')
    if (!agree) return setError('Please confirm you understand how Echoes handles your data.')
    setBusy(true)
    try {
      const { needsConfirmation } = await data.auth.signUp(name, email.trim(), pw)
      if (needsConfirmation) { setInfo('Account created. Check your email for a confirmation link, then sign in.'); setBusy(false) }
      else nav('/dashboard', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Shell title="Create your archive" subtitle="Your memories stay private to your account.">
      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="name" className="label">Full name</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>
        <div><label htmlFor="email" className="label">Email address</label><input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
        <Password id="pw" label="Password" value={pw} onChange={setPw} autoComplete="new-password" />
        {pw && <p className={`text-xs ${problems.length ? 'text-amber' : 'text-emerald'}`}>{problems.length ? `Needs ${problems.join(' and ')}` : 'Strong enough'}</p>}
        <Password id="pw2" label="Confirm password" value={pw2} onChange={setPw2} autoComplete="new-password" />
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 accent-[#f4d18e]" />
          I understand my memories are encrypted per memory, and that text is sent to the AI service only when I use AI features.
        </label>
        <Feedback error={error} info={info} />
        <button className="btn-primary w-full py-3" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Create Account</button>
        <p className="text-sm text-muted text-center">Already have an account? <Link to="/login" className="text-gold hover:underline">Sign in</Link></p>
      </form>
    </Shell>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try { await data.auth.requestPasswordReset(email.trim()); setDone(true) } catch (err) { setError((err as Error).message) }
    setBusy(false)
  }
  return (
    <Shell title="Reset your password" subtitle="We'll send a reset link if an account uses this email.">
      {done ? (
        <div className="space-y-4">
          <p className="text-emerald" role="status">
            {data.mode === 'demo' ? 'Demo accounts have no email delivery, so no link was sent. Create a new demo account or use the demo archive.' : 'If an account exists for that address, a reset link is on its way. Check your inbox.'}
          </p>
          <Link to="/login" className="btn-ghost w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="email" className="label">Email address</label><input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <Feedback error={error} />
          <button className="btn-primary w-full py-3" disabled={busy}>Send reset link</button>
          <Link to="/login" className="block text-center text-sm text-gold hover:underline">Back to sign in</Link>
        </form>
      )}
    </Shell>
  )
}

export function ResetPassword() {
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const problems = passwordProblems(pw)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (problems.length) return setError(`Password needs ${problems.join(' and ')}.`)
    if (pw !== pw2) return setError('The passwords do not match.')
    setBusy(true); setError('')
    try { await data.auth.updatePassword(pw); nav('/dashboard', { replace: true }) } catch (err) {
      setError(`${(err as Error).message} The reset link may have expired; request a new one.`)
      setBusy(false)
    }
  }
  return (
    <Shell title="Choose a new password" subtitle="Opened from your reset email.">
      <form onSubmit={submit} className="space-y-4">
        <Password id="pw" label="New password" value={pw} onChange={setPw} autoComplete="new-password" />
        <Password id="pw2" label="Confirm new password" value={pw2} onChange={setPw2} autoComplete="new-password" />
        <Feedback error={error} />
        <button className="btn-primary w-full py-3" disabled={busy}>Update password</button>
        <Link to="/forgot-password" className="block text-center text-sm text-gold hover:underline">Request a new link</Link>
      </form>
    </Shell>
  )
}
