import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ChevronRight, Home, Images, LineChart, LogOut, Network, Plus, Settings, Sparkles, X, Menu } from 'lucide-react'
import { useApp } from '../state/AppState'
import { data } from '../services/data'
import { initials, cx } from '../lib/format'
import { DemoLabel } from './ui'

const NAV = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/echoes', label: 'My Echoes', icon: Images, end: true },
  { to: '/echoes/new', label: 'Create Echo', icon: Plus },
  { to: '/memory-map', label: 'Memory Map', icon: Network },
  { to: '/insights', label: 'Insights', icon: LineChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate}
          className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] transition border',
            isActive ? 'border-bronze/80 bg-gradient-to-r from-[#3a2a15]/80 to-surface-2/40 text-ivory' : 'border-transparent text-ivory/75 hover:text-ivory hover:bg-surface-2/60')}>
          <Icon size={20} className="text-gold/90" aria-hidden />{label}
        </NavLink>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div>
      <p className="font-serif text-4xl text-ivory flex items-start gap-1">Echoes<Sparkles size={16} className="text-gold mt-1" aria-hidden /></p>
      <p className="text-sm text-ivory/80">The Living Memory Archive</p>
    </div>
  )
}

function Account() {
  const { user } = useApp()
  const nav = useNavigate()
  if (!user) return null
  return (
    <div className="flex items-center gap-3">
      <button onClick={() => nav('/settings')} className="flex flex-1 items-center gap-3 rounded-xl p-1.5 text-left hover:bg-surface-2/70 min-w-0" aria-label="Open account settings">
        <span className="grid place-items-center size-10 rounded-full bg-[#5b5866] text-ivory text-sm font-medium shrink-0">{initials(user.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ivory truncate">{user.name}</span>
          <span className="block text-xs text-muted truncate">{data.mode === 'demo' ? 'Demo account' : user.email}</span>
        </span>
        <ChevronRight size={16} className="text-muted" aria-hidden />
      </button>
      <button className="text-muted hover:text-ivory p-2" aria-label="Sign out" onClick={async () => { await data.auth.signOut(); nav('/') }}><LogOut size={16} /></button>
    </div>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="starfield min-h-screen lg:p-4 lg:flex lg:gap-4">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 card bg-surface/70 sticky top-4 h-[calc(100vh-2rem)] overflow-hidden">
        <div className="p-6 pb-4"><Brand /></div>
        <div className="px-4"><NavItems /></div>
        <div className="relative flex-1 min-h-24 mt-4">
          <img src="/art/portal.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-bottom opacity-90 [mask-image:linear-gradient(to_bottom,transparent,black_25%)]" />
        </div>
        <div className="p-3 border-t border-bronze/30 bg-surface/80 relative">
          {data.mode === 'demo' && <div className="px-2 pb-2"><DemoLabel>Demo mode · stored in this browser</DemoLabel></div>}
          <Account />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-bronze/40 bg-night/90 backdrop-blur px-4 py-3">
        <p className="font-serif text-2xl">Echoes</p>
        <button className="icon-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={18} /></button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70" onClick={() => setOpen(false)}>
          <div className="absolute inset-y-0 left-0 w-[min(300px,85vw)] bg-surface border-r border-bronze/50 p-5 flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between"><Brand /><button className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <NavItems onNavigate={() => setOpen(false)} />
            <div className="mt-auto">{data.mode === 'demo' && <div className="pb-2"><DemoLabel>Demo mode</DemoLabel></div>}<Account /></div>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 px-4 py-6 md:px-8 lg:rounded-2xl lg:border lg:border-bronze/45 lg:bg-surface/40 lg:min-h-[calc(100vh-2rem)]">
        <Outlet />
      </main>
    </div>
  )
}
