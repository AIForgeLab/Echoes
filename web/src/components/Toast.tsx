import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: Kind; text: string }

const Ctx = createContext<(kind: Kind, text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info }
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]" role="status" aria-live="polite">
        {toasts.map((t) => {
          const I = Icon[t.kind]
          return (
            <div key={t.id} className={`card flex items-start gap-3 px-4 py-3 shadow-2xl ${t.kind === 'error' ? 'border-danger/60' : t.kind === 'success' ? 'border-emerald/50' : ''}`}>
              <I size={18} className={t.kind === 'error' ? 'text-danger mt-0.5' : t.kind === 'success' ? 'text-emerald mt-0.5' : 'text-gold mt-0.5'} />
              <p className="text-sm flex-1">{t.text}</p>
              <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-ivory"><X size={16} /></button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
