// LIVE adapter: Supabase Auth + Postgres. Row Level Security (supabase/schema.sql) limits every
// query to the signed-in user's rows; this code never relies on hiding UI to enforce access.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { AppUser, Claim, Echo, EchoDetail, Telling } from '../types'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { decrypt, encrypt, newKey } from '../lib/vault'
import { NotFoundError, tamperText, tellingLabel, type DataAdapter } from './adapter'
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
    id: r.id, title: r.title ?? 'A forgotten memory', summary: r.summary, summaryGenerated: r.summary_generated,
    category: r.category, tags: r.tags.map((t) => t.tag), memoryDate: r.memory_date, cover: r.cover, style: r.style,
    favourite: r.favourite, createdAt: r.created_at, updatedAt: r.updated_at, forgottenAt: r.forgotten_at,
    text: latest ? await decrypt(keyOf(r), latest.ciphertext, latest.iv) : null,
    hash: latest?.content_hash ?? null, tellingCount: r.versions.length,
  }
}

async function insertClaims(memoryId: string, versionId: string, claims: Claim[]) {
  if (!claims.length) return
  check(await supabase().from('claims').insert(claims.map((c, i) => ({ memory_id: memoryId, version_id: versionId, idx: i, text: c.text, quote: c.quote, start_char: c.start, end_char: c.end }))))
}

async function setTags(memoryId: string, tags: string[]) {
  check(await supabase().from('tags').delete().eq('memory_id', memoryId))
  if (tags.length) check(await supabase().from('tags').insert(tags.map((tag) => ({ memory_id: memoryId, tag }))))
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
    const tellings: Telling[] = []
    for (const v of [...row.versions].sort((a, b) => a.version_no - b.version_no)) {
      tellings.push({
        id: v.id, versionNo: v.version_no, toldOn: v.told_on, label: tellingLabel(v.version_no, v.told_on),
        text: await decrypt(key, v.ciphertext, v.iv), ciphertext: v.ciphertext, contentHash: v.content_hash,
        prevHash: v.prev_hash, chainHash: v.chain_hash, sealedAt: v.sealed_at,
        claims: claims.filter((c) => c.version_id === v.id).map((c) => ({ text: c.text, quote: c.quote, start: c.start_char, end: c.end_char })),
      })
    }
    const detail: EchoDetail = { ...(await toEcho(row)), tellings, tombstone: tomb ? { chainHash: tomb.chain_hash, forgottenAt: tomb.forgotten_at } : null }
    return detail
  },

  async createEcho(input) {
    const mem = check(await supabase().from('memories').insert({
      title: input.title.trim(), summary: input.summary, summary_generated: input.summaryGenerated, category: input.category,
      memory_date: input.memoryDate, cover: input.cover, style: input.style,
    }).select('id').single()) as { id: string }
    const key = await newKey()
    check(await supabase().from('memory_keys').insert({ memory_id: mem.id, key_b64: key }))
    const s = await sealTelling(key, input.text, 'genesis')
    const v = check(await supabase().from('versions').insert({
      memory_id: mem.id, version_no: 1, told_on: input.toldOn, ciphertext: s.ciphertext, iv: s.iv,
      content_hash: s.contentHash, prev_hash: s.prevHash, chain_hash: s.chainHash, sealed_at: s.sealedAt,
    }).select('id').single()) as { id: string }
    await insertClaims(mem.id, v.id, input.claims)
    await setTags(mem.id, input.tags)
    return mem.id
  },

  async retell(id, { text, toldOn, claims }) {
    const k = check(await supabase().from('memory_keys').select('key_b64').eq('memory_id', id).maybeSingle()) as { key_b64: string } | null
    if (!k) throw new Error('This memory has been forgotten and cannot be retold.')
    const last = check(await supabase().from('versions').select('version_no,chain_hash').eq('memory_id', id).order('version_no', { ascending: false }).limit(1).single()) as { version_no: number; chain_hash: string }
    const s = await sealTelling(k.key_b64, text, last.chain_hash)
    const v = check(await supabase().from('versions').insert({
      memory_id: id, version_no: last.version_no + 1, told_on: toldOn, ciphertext: s.ciphertext, iv: s.iv,
      content_hash: s.contentHash, prev_hash: s.prevHash, chain_hash: s.chainHash, sealed_at: s.sealedAt,
    }).select('id').single()) as { id: string }
    await insertClaims(id, v.id, claims)
    check(await supabase().from('memories').update({ updated_at: new Date().toISOString() }).eq('id', id))
  },

  async saveClaims(id, versionNo, claims) {
    const v = check(await supabase().from('versions').select('id').eq('memory_id', id).eq('version_no', versionNo).single()) as { id: string }
    check(await supabase().from('claims').delete().eq('version_id', v.id))
    await insertClaims(id, v.id, claims)
  },

  async updateMeta(id, patch) {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.title !== undefined) row.title = patch.title
    if (patch.category !== undefined) row.category = patch.category
    if (patch.style !== undefined) row.style = patch.style
    if (patch.favourite !== undefined) row.favourite = patch.favourite
    if (patch.memoryDate !== undefined) row.memory_date = patch.memoryDate
    if (patch.cover !== undefined) row.cover = patch.cover
    check(await supabase().from('memories').update(row).eq('id', id))
    if (patch.tags) await setTags(id, patch.tags)
  },

  async forget(id) {
    const vs = check(await supabase().from('versions').select('chain_hash,version_no').eq('memory_id', id).order('version_no', { ascending: false }).limit(1)) as { chain_hash: string }[]
    if (!vs.length) throw new NotFoundError('This memory does not exist in your archive.')
    check(await supabase().from('claims').delete().eq('memory_id', id))
    check(await supabase().from('tags').delete().eq('memory_id', id))
    check(await supabase().from('memory_keys').delete().eq('memory_id', id)) // crypto-shredding
    check(await supabase().from('versions').update({ content_hash: null }).eq('memory_id', id))
    check(await supabase().from('memories').update({ title: null, summary: null, cover: null, favourite: false, forgotten_at: new Date().toISOString() }).eq('id', id))
    check(await supabase().from('tombstones').insert({ memory_id: id, chain_hash: vs[0]!.chain_hash }))
  },

  async tamper(id, versionNo) {
    const k = check(await supabase().from('memory_keys').select('key_b64').eq('memory_id', id).single()) as { key_b64: string }
    const v = check(await supabase().from('versions').select('id,ciphertext,iv').eq('memory_id', id).eq('version_no', versionNo).single()) as { id: string; ciphertext: string; iv: string }
    const plain = await decrypt(k.key_b64, v.ciphertext, v.iv)
    if (plain == null) throw new Error('This telling is already unreadable.')
    const { text, word } = tamperText(plain)
    check(await supabase().from('versions').update(await encrypt(k.key_b64, text)).eq('id', v.id))
    return word
  },

  async forgetAll() {
    const rows = check(await supabase().from('memories').select('id').is('forgotten_at', null)) as { id: string }[]
    for (const r of rows) await supabaseAdapter.forget(r.id)
    return rows.length
  },
}
