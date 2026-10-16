import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../state/AppState'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, authReady } = useApp()
  const loc = useLocation()
  if (!authReady) return <div className="starfield min-h-screen grid place-items-center text-muted">Opening your archive…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}
