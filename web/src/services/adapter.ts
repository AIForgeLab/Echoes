import type { AppUser, Claim, Echo, EchoDetail, EchoPatch, NewEchoInput } from '../types'

export interface AuthApi {
  getUser(): Promise<AppUser | null>
  onChange(cb: (user: AppUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** Returns needsConfirmation=true when the provider requires an email confirmation step. */
  signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  updateProfile(patch: { name: string }): Promise<AppUser>
  enterDemo?(): Promise<void>
}

/** Every data operation the UI uses. Demo (browser storage) and Supabase both implement it. */
export interface DataAdapter {
  mode: 'demo' | 'live'
  auth: AuthApi
  listEchoes(): Promise<Echo[]>
  getEcho(id: string): Promise<EchoDetail | null>
  createEcho(input: NewEchoInput): Promise<string>
  /** Adds a new sealed telling. The original is never overwritten. */
  retell(id: string, input: { text: string; toldOn: string | null; claims: Claim[] }): Promise<void>
  /** Saves claims extracted later (e.g. when Pentimento needs them). */
  saveClaims(id: string, versionNo: number, claims: Claim[]): Promise<void>
  updateMeta(id: string, patch: EchoPatch): Promise<void>
  /** Crypto-shredding: delete derived data, destroy the key, keep a tombstone. */
  forget(id: string): Promise<void>
  /** Demo of an attacker with database access changing one word. */
  tamper(id: string, versionNo: number): Promise<string>
  /** Forget every memory. */
  forgetAll(): Promise<number>
  resetDemo?(): Promise<void>
}

export class NotFoundError extends Error {}

export function tellingLabel(versionNo: number, toldOn: string | null): string {
  return toldOn ? `Telling ${versionNo} · ${toldOn.slice(0, 4)}` : `Telling ${versionNo}`
}

export function tamperText(text: string): { text: string; word: string } {
  const words = text.split(' ')
  let i = words.findIndex((w) => /^father\b/i.test(w))
  if (i < 0) i = Math.max(0, words.findIndex((w) => w.replace(/\W/g, '').length > 4))
  const original = words[i] ?? ''
  const replaced = /^father/i.test(original) ? original.replace(/father/i, 'uncle') : `${original.replace(/\W+$/, '')}s${original.match(/\W+$/)?.[0] ?? ''}`
  words[i] = replaced
  return { text: words.join(' '), word: replaced }
}
