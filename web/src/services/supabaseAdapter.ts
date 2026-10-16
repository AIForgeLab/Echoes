// LIVE adapter: Supabase Auth + Postgres. Row Level Security (supabase/schema.sql) limits every
// query to the signed-in user's rows; this code never relies on hiding UI to enforce access.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { AppUser, Claim, Echo, EchoDetail, Telling } from '../types'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { decrypt, newKey, openField, sealField } from '../lib/vault'
import { NotFoundError, tellingLabel, type DataAdapter } from './adapter'
import { anchorClaims } from '../lib/claims'
import { sealTelling } from './sealing'

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  return client
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Throw on an auth error, otherwise return the response unchanged. */
function ok<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message)
  return res
}

const toUser =(u: User | null | undefined): AppUser | null =>
  u ? { id: u.id, email: u.email ?? '', name: (u.user_metadata?.full_name as string) || (u.email ?? '').split('@')[0] || 'You' } : null

interface Row {
  id: string; title: string | null; summary: string | null; summary_generated: boolean; category: Echo['category']
  memory_date: string | null; cover: string | null; style: Echo['style']; favourite: boolean; created_at: string
  updated_at: string; forgotten_at: string | null
  tags: { tag: string }[]
  memory_keys: { key_b64: string } | { key_b64: string }[] | null
  versions: { id: string; version_no: number; told_on: string | null; ciphertext: string; iv: string; content_hash: string | null; prev_hash: string; chain_hash: string; sealed_at: string }[]
}

const SELECT = 'id,title,summary,summary_generated,category,memory_date,cover,style,favourite,created_at,updated_at,forgotten_at,tags(tag),memory_keys(key_b64),versions(id,version_no,told_on,ciphertext,iv,content_hash,prev_hash,chain_hash,sealed_at)'

const keyOf = (r: Row) => (Array.isArray(r.memory_keys) ? r.memory_keys[0]?.key_b64 : r.memory_keys?.key_b64) ?? null

async function toEcho(r: Row): Promise<Echo> {
  const latest = [...r.versions].sort((a, b) => b.version_no - a.version_no)[0]
  return {
    id: r.id, title: r.title ?? 'A forgotten memory', summary: await openField(keyOf(r), r.summary), summaryGenerated: r.summary_generated,
    category: r.category, tags: r.tags.map((t) => t.tag), memoryDate: r.memory_date, cover: r.cover, style: r.style,
    favourite: r.favourite, createdAt: r.created_at, updatedAt: r.updated_at, forgottenAt: r.forgotten_at,
    text: latest ? await decrypt(keyOf(r), latest.ciphertext, latest.iv) : null,
    hash: latest?.content_hash ?? null, tellingCount: r.versions.length,
  }
}

/** Facts and their quotes are encrypted with the memory's key: a quote is the memory's own words. */
async function insertClaims(memoryId: string, versionId: string, claims: Claim[], key: string) {
  if (!claims.length) return
  const rows = await Promise.all(claims.map(async (c, i) => ({
    memory_id: memoryId, version_id: versionId, idx: i, text: await sealField(key, c.text), quote: await sealField(key, c.quote), start_char: c.start, end_char: c.end,
  })))
  check(await supabase().from('claims').insert(rows))
}

/** Encrypted claim rows for the create_memory / retell_memory database functions. */
async function claimRows(claims: Claim[], key: string) {
  return Promise.all(claims.map(async (c, i) => ({ idx: i, text: await sealField(key, c.text), quote: await sealField(key, c.quote), start_char: c.start, end_char: c.end })))
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args)
  if (error) throw error.code === 'P0002' ? new NotFoundError(error.message) : new Error(error.message)
  return data as T
}

// Replacing tags is one transaction (set_memory_tags), and refuses forgotten memories.
async function setTags(memoryId: string, tags: string[]) {
  await rpc('set_memory_tags', { p_memory: memoryId, p_tags: tags })
}

export const supabaseAdapter: DataAdapter = {
  mode: 'live',
  auth: {
    async getUser() {
      const { data } = await supabase().auth.getSession()
      return toUser(data.session?.user)
    },
    onChange(cb) {
      const { data } = supabase().auth.onAuthStateChange((_e, s) => cb(toUser(s?.user)))
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      ok(await supabase().auth.signInWithPassword({ email, password }))
    },
    async signUp(name, email, password) {
      const res = ok(await supabase().auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/login` } }))
      return { needsConfirmation: !res.data.session }
    },
    async signOut() { ok(await supabase().auth.signOut()) },
    async requestPasswordReset(email) {
      ok(await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` }))
    },
    async updatePassword(password) { ok(await supabase().auth.updateUser({ password })) },
    async updateProfile({ name }) {
      const res = ok(await supabase().auth.updateUser({ data: { full_name: name } }))
      return toUser(res.data.user)!
    },
  },

  async listEchoes() {
    const rows = check(await supabase().from('memories').select(SELECT).order('created_at', { ascending: false })) as unknown as Row[]
    return Promise.all(rows.map(toEcho))
  },

  async getEcho(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null
    const row = check(await supabase().from('memories').select(SELECT).eq('id', id).maybeSingle()) as unknown as Row | null
    if (!row) return null
    const claims = check(await supabase().from('claims').select('version_id,text,quote,start_char,end_char,idx').eq('memory_id', id).order('idx')) as
      { version_id: string; text: string; quote: string; start_char: number; end_char: number }[]
    const tomb = check(await supabase().from('tombstones').select('chain_hash,forgotten_at').eq('memory_id', id).maybeSingle()) as { chain_hash: string; forgotten_at: string } | null
    const key = keyOf(row)
    const opened = await Promise.all(claims.map(async (c) => ({ versionId: c.version_id, text: await openField(key, c.text), quote: await openField(key, c.quote), start: c.start_char, end: c.end_char })))
    const tellings: Telling[] = []
    for (const v of [...row.versions].sort((a, b) => a.version_no - b.version_no)) {
      tellings.push({
        id: v.id, versionNo: v.version_no, toldOn: v.told_on, label: tellingLabel(v.version_no, v.told_on),
        text: await decrypt(key, v.ciphertext, v.iv), ciphertext: v.ciphertext, contentHash: v.content_hash,
        prevHash: v.prev_hash, chainHash: v.chain_hash, sealedAt: v.sealed_at,
        claims: opened.flatMap((c) => (c.versionId === v.id && c.text != null && c.quote != null ? [{ text: c.text, quote: c.quote, start: c.start, end: c.end }] : [])),
      })
    }
    const detail: EchoDetail = { ...(await toEcho(row)), tellings, tombstone: tomb ? { chainHash: tomb.chain_hash, forgottenAt: tomb.forgotten_at } : null }
    return detail
  },

  // One transaction (create_memory in supabase/schema.sql): memory, key, first telling, facts and tags
  // are saved together or not at all. Everything sensitive is encrypted here, before it leaves the browser.
  async createEcho(input) {
    const key = await newKey()
    const s = await sealTelling(key, input.text, 'genesis')
    return rpc<string>('create_memory', {
      p_title: input.title.trim(), p_summary: input.summary ? await sealField(key, input.summary) : null,
      p_summary_generated: input.summaryGenerated, p_category: input.category, p_memory_date: input.memoryDate,
      p_cover: input.cover, p_style: input.style, p_key: key, p_told_on: input.toldOn,
      p_ciphertext: s.ciphertext, p_iv: s.iv, p_content_hash: s.contentHash, p_chain_hash: s.chainHash, p_sealed_at: s.sealedAt,
      p_claims: await claimRows(anchorClaims(input.text, input.claims), key), p_tags: input.tags,
    })
  },

  async retell(id, { text, toldOn, claims }) {
    const k = check(await supabase().from('memory_keys').select('key_b64').eq('memory_id', id).maybeSingle()) as { key_b64: string } | null
    if (!k) throw new Error('This memory has been forgotten and cannot be retold.')
    const last = check(await supabase().from('versions').select('version_no,chain_hash').eq('memory_id', id).order('version_no', { ascending: false }).limit(1).single()) as { version_no: number; chain_hash: string }
    const s = await sealTelling(k.key_b64, text, last.chain_hash)
    // One transaction (retell_memory): it also refuses if another retelling landed in the meantime.
    await rpc('retell_memory', {
      p_memory: id, p_told_on: toldOn, p_ciphertext: s.ciphertext, p_iv: s.iv, p_content_hash: s.contentHash,
      p_prev_hash: s.prevHash, p_chain_hash: s.chainHash, p_sealed_at: s.sealedAt,
      p_claims: await claimRows(anchorClaims(text, claims), k.key_b64),
    })
  },

  async saveClaims(id, versionNo, claims) {
    const k = check(await supabase().from('memory_keys').select('key_b64').eq('memory_id', id).maybeSingle()) as { key_b64: string } | null
    if (!k) throw new Error('This memory has been forgotten.')
    const v = check(await supabase().from('versions').select('id').eq('memory_id', id).eq('version_no', versionNo).single()) as { id: string }
    check(await supabase().from('claims').delete().eq('version_id', v.id))
    await insertClaims(id, v.id, claims, k.key_b64)
  },

  async updateMeta(id, patch) {
    const m = check(await supabase().from('memories').select('forgotten_at').eq('id', id).maybeSingle()) as { forgotten_at: string | null } | null
    if (!m) throw new NotFoundError('This memory does not exist in your archive.')
    if (m.forgotten_at) throw new Error('This memory has been forgotten and can no longer be changed.')
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.title !== undefined) row.title = patch.title
    if (patch.category !== undefined) row.category = patch.category
    if (patch.style !== undefined) row.style = patch.style
    if (patch.favourite !== undefined) row.favourite = patch.favourite
    if (patch.memoryDate !== undefined) row.memory_date = patch.memoryDate
    if (patch.cover !== undefined) row.cover = patch.cover
    check(await supabase().from('memories').update(row).eq('id', id).is('forgotten_at', null))
    if (patch.tags) await setTags(id, patch.tags)
  },

  // One database transaction (forget_memory in supabase/schema.sql): all steps happen or none do,
  // and calling it again on a forgotten memory is harmless.
  async forget(id) {
    const { error } = await supabase().rpc('forget_memory', { p_memory: id })
    if (error) throw error.code === 'P0002' ? new NotFoundError(error.message) : new Error(error.message)
  },

  // Real memories are never altered on purpose: in live mode the Provenance panel only simulates
  // tampering on a copy in the browser. This guard makes sure no code path can write it.
  async tamper() {
    throw new Error('Tampering is only simulated in live mode; stored memories are never changed.')
  },

  async forgetAll() {
    const rows = check(await supabase().from('memories').select('id').is('forgotten_at', null)) as { id: string }[]
    let done = 0
    for (const r of rows) {
      try { await supabaseAdapter.forget(r.id); done++ } catch (e) {
        throw new Error(`Forgot ${done} of ${rows.length} memories; the others were not changed. ${(e as Error).message}`)
      }
    }
    return rows.length
  },
}
