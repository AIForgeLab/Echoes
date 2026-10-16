import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppUser, Echo } from '../types'
import { data } from '../services/data'
import { loadPrefs, savePrefs, type Prefs } from '../lib/prefs'
import { aiStatus, type AiStatus } from '../services/ai'

interface AppState {
  user: AppUser | null
  authReady: boolean
  echoes: Echo[] | null
  echoesError: string | null
  refreshEchoes: () => Promise<void>
  setUser: (u: AppUser | null) => void
  prefs: Prefs
  setPrefs: (p: Prefs) => boolean
  ai: AiStatus | null
}

const Ctx = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [echoes, setEchoes] = useState<Echo[] | null>(null)
  const [echoesError, setEchoesError] = useState<string | null>(null)
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs)
  const [ai, setAi] = useState<AiStatus | null>(null)

  useEffect(() => {
    data.auth.getUser().then((u) => { setUser(u); setAuthReady(true) }).catch(() => setAuthReady(true))
    const off = data.auth.onChange((u) => setUser(u))
    aiStatus().then(setAi)
    return off
  }, [])

  const refreshEchoes = useCallback(async () => {
    try {
      setEchoesError(null)
      setEchoes(await data.listEchoes())
    } catch (e) {
      setEchoesError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    if (user) refreshEchoes()
    else setEchoes(null)
  }, [user, refreshEchoes])

  useEffect(() => {
    document.documentElement.dataset.motion = prefs.reducedMotion ? 'reduced' : 'full'
    document.documentElement.dataset.effects = prefs.effects
  }, [prefs])

  const setPrefs = useCallback((p: Prefs) => { setPrefsState(p); return savePrefs(p) }, [])

  const value = useMemo(
    () => ({ user, authReady, echoes, echoesError, refreshEchoes, setUser, prefs, setPrefs, ai }),
    [user, authReady, echoes, echoesError, refreshEchoes, prefs, setPrefs, ai],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppStateProvider')
  return v
}
