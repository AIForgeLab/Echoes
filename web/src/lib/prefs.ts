// Per-browser preferences (stored in localStorage on this device only).
export interface Prefs {
  reducedMotion: boolean
  effects: 'full' | 'subtle'
  aiEnhance: boolean
}

const KEY = 'echoes.prefs.v1'
export const DEFAULT_PREFS: Prefs = { reducedMotion: false, effects: 'full', aiEnhance: true }

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(p: Prefs): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}
