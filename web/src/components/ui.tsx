import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CircleHelp, FlaskConical, Search, Sparkles, type LucideIcon } from 'lucide-react'
import type { ClaimType } from '../types'
import { cx } from '../lib/format'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
      <div>
        <h1 className="font-serif text-4xl md:text-5xl text-ivory flex items-start gap-1">
          {title}<Sparkles size={18} className="text-gold mt-1 shrink-0" aria-hidden />
        </h1>
        {subtitle && <p className="text-muted mt-1 text-lg">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{label}</span>
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" className="input pl-10 rounded-xl" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function StatCard({ icon: Icon, value, label, hint }: { icon: LucideIcon; value: number | string; label: string; hint: string }) {
  return (
    <div className="card flex items-center gap-3 md:gap-4 px-3.5 py-3 md:px-5 md:py-4">
      <span className="hidden sm:grid place-items-center size-12 rounded-xl border border-bronze/60 text-gold shrink-0"><Icon size={22} /></span>
      <div className="min-w-0">
        <p className="text-2xl font-serif text-ivory leading-none">{value}</p>
        <p className="text-sm text-ivory mt-1">{label}</p>
        <p className="text-xs text-muted truncate">{hint}</p>
      </div>
    </div>
  )
}

export function TagChip({ tag, onRemove, active, onClick }: { tag: string; onRemove?: () => void; active?: boolean; onClick?: () => void }) {
  const cls = cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition', active ? 'border-gold bg-gold/15 text-gold' : 'border-bronze/50 bg-surface-2 text-ivory/80')
  if (onClick) return <button type="button" onClick={onClick} className={cx(cls, 'hover:border-gold')}>#{tag}</button>
  return (
    <span className={cls}>
      #{tag}
      {onRemove && <button type="button" aria-label={`Remove tag ${tag}`} onClick={onRemove} className="ml-0.5 text-muted hover:text-ivory">×</button>}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center text-center px-6 py-14 gap-3">
      <span className="grid place-items-center size-14 rounded-full border border-bronze/60 text-gold"><Icon size={26} /></span>
      <h2 className="font-serif text-2xl">{title}</h2>
      {children && <div className="text-muted max-w-md">{children}</div>}
      {action}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, retry }: { title?: string; message: string; retry?: () => void }) {
  return (
    <div className="card border-danger/50 flex flex-col items-center text-center px-6 py-12 gap-3" role="alert">
      <AlertTriangle className="text-danger" size={28} />
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="text-muted max-w-md">{message}</p>
      <div className="flex gap-3">
        {retry && <button className="btn-primary" onClick={retry}>Try again</button>}
        <Link to="/dashboard" className="btn-ghost">Back to dashboard</Link>
      </div>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-surface-2', className)} />
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card overflow-hidden"><Skeleton className="h-40 rounded-none" /><div className="p-4 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-1/3" /><Skeleton className="h-10" /></div></div>
      ))}
    </div>
  )
}

const BOUNDARY: Record<ClaimType, { label: string; icon: LucideIcon; cls: string }> = {
  said: { label: 'Source-backed', icon: CheckCircle2, cls: 'text-emerald border-emerald/40 bg-emerald/10' },
  inferred: { label: 'Interpretation', icon: Sparkles, cls: 'text-violet border-violet/40 bg-violet/10' },
  unknown: { label: 'Unknown', icon: CircleHelp, cls: 'text-amber border-amber/40 bg-amber/10' },
}

export function TruthBoundaryBadge({ type }: { type: ClaimType }) {
  const b = BOUNDARY[type]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', b.cls)}>
      <b.icon size={13} aria-hidden />{b.label}
    </span>
  )
}

export function DemoLabel({ children = 'Demo' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber">
      <FlaskConical size={12} aria-hidden />{children}
    </span>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl border border-bronze/40 bg-surface p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition', value === t.id ? 'bg-surface-2 text-gold border border-bronze/70' : 'text-muted hover:text-ivory border border-transparent')}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
