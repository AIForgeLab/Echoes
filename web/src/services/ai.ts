// AI calls. Live = the Echoes API server (api/app.py), which holds the Gemini key.
// When that server isn't configured or reachable, a clearly labelled offline demo is used instead.
// A request that fails on a reachable live server is reported as an error, never faked.
import { API_URL, DEMO_MODE } from '../config'
import { demoAlign, demoAsk, demoEnhance, findSpan } from '../lib/demoAi'
import { canonicalize } from '../lib/seal'
import { CATEGORIES, type AlignResult, type AskResult, type Category, type EnhanceResult } from '../types'
import { supabase } from './supabaseAdapter'

export type AiStatus = 'live' | 'demo'

let statusPromise: Promise<AiStatus> | null = null

export function aiStatus(): Promise<AiStatus> {
  if (!statusPromise) {
    statusPromise = (async () => {
      if (!API_URL) return 'demo'
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 2500)
        const res = await fetch(`${API_URL}/health`, { signal: ctrl.signal })
        clearTimeout(t)
        return res.ok ? 'live' : 'demo'
      } catch {
        return 'demo'
      }
    })()
  }
  return statusPromise
}

export function recheckAi() {
  statusPromise = null
  return aiStatus()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!DEMO_MODE) {
    const { data } = await supabase().auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new Error('The Echoes AI server could not be reached. Check that it is running, then try again.')
  }
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Your session has expired. Please sign in again.')
  if (!res.ok) throw new Error((json as { error?: string }).error || `The AI service failed (${res.status}).`)
  return json as T
}

export async function enhance(text: string): Promise<EnhanceResult> {
  if ((await aiStatus()) === 'demo') return demoEnhance(text)
  const out = await post<{ title: string; summary: string; category: string; tags: string[]; claims: EnhanceResult['claims'] }>('/extract', { text: canonicalize(text) })
  const category: Category = (CATEGORIES as readonly string[]).includes(out.category) ? (out.category as Category) : 'Personal'
  return { source: 'live', ...out, category }
}

export async function ask(text: string, question: string, others: { label: string; text: string }[]): Promise<AskResult> {
  if ((await aiStatus()) === 'demo') return demoAsk(text, question, others)
  const out = await post<Omit<AskResult, 'source'>>('/ask', { text: canonicalize(text), question, others })
  // Defence in depth: re-check every "said" quote in the browser as well.
  const claims = out.claims.map((c) => {
    if (c.type !== 'said') return c
    const span = c.quote ? findSpan(text, c.quote) : null
    return span ? c : { ...c, type: 'inferred' as const, verified: false, note: 'demoted: quote not found in the memory' }
  })
  return { source: 'live', assumptions: out.assumptions, claims }
}

export async function align(oldClaims: string[], newClaims: string[]): Promise<AlignResult> {
  if ((await aiStatus()) === 'demo') return demoAlign(oldClaims, newClaims)
  const out = await post<Omit<AlignResult, 'source'>>('/align', { old: oldClaims, new: newClaims })
  return { source: 'live', pairs: out.pairs }
}
