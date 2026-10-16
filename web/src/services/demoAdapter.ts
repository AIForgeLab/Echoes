// DEMO adapter: everything lives in this browser's localStorage. Not cloud storage, not secure
// authentication. Encryption, hashing and crypto-shredding still run for real (Web Crypto).
import type { AppUser, Claim, Echo, EchoDetail, EchoPatch, NewEchoInput, Telling } from '../types'
import { sha256Hex, canonicalize } from '../lib/seal'
import { decrypt, encrypt, newKey } from '../lib/vault'
import { NotFoundError, tamperText, tellingLabel, type DataAdapter } from './adapter'
import { sealTelling } from './sealing'
import { SEEDS, seedClaims } from './seed'
import { anchorClaims } from '../lib/claims'

const KEY = 'echoes.demo.v1'
const DEMO_EMAIL = 'demo@echoes.local'

interface StoredTelling {
  id: string
  versionNo: number
  toldOn: string | null
  ciphertext: string
  iv: string
  contentHash: string | null
  prevHash: string
  chainHash: string
  sealedAt: string
  claims: Claim[]
}

interface StoredEcho {
  id: string
  title: string | null
  summary: string | null
  summaryGenerated: boolean
  category: Echo['category']
  tags: string[]
  memoryDate: string | null
  cover: string | null
  style: Echo['style']
  favourite: boolean
  createdAt: string
  updatedAt: string
  forgottenAt: string | null
  key: string | null
  tellings: StoredTelling[]
  tombstone: { chainHash: string; forgottenAt: string } | null
}

interface DemoDb {
  users: Record<string, { id: string; name: string; email: string; passwordHash: string }>
  session: string | null
  data: Record<string, StoredEcho[]>
}

const uid = () => crypto.randomUUID()

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoDb
  } catch { /* fall through to an empty store */ }
  return { users: {}, session: null, data: {} }
}

function save(db: DemoDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    throw new Error('Browser storage is full or blocked, so the demo could not save. Remove an image or reset the demo in Settings.')
  }
}

const listeners = new Set<(u: AppUser | null) => void>()
function currentUser(db: DemoDb): AppUser | null {
  const u = db.session ? Object.values(db.users).find((x) => x.id === db.session) : undefined
  return u ? { id: u.id, name: u.name, email: u.email } : null
}
function emit() {
  const u = currentUser(load())
  listeners.forEach((cb) => cb(u))
}

function requireUser(db: DemoDb): string {
  if (!db.session) throw new Error('Your session has ended. Please sign in again.')
  return db.session
}

async function buildSeed(): Promise<StoredEcho[]> {
  const now = Date.now()
  const out: StoredEcho[] = []
  for (const [i, s] of SEEDS.entries()) {
    const key = await newKey()
    const tellings: StoredTelling[] = []
    let prev = 'genesis'
    for (const [v, t] of s.tellings.entries()) {
      const sealed = await sealTelling(key, t.text, prev)
      tellings.push({ id: uid(), versionNo: v + 1, toldOn: t.toldOn, ...sealed, claims: seedClaims(canonicalize(t.text), t.claims) })
      prev = sealed.chainHash
    }
    const created = new Date(now - (i + 1) * 86400000 * 3).toISOString()
    out.push({
      id: uid(), title: s.title, summary: s.summary, summaryGenerated: true, category: s.category, tags: s.tags,
      memoryDate: s.memoryDate, cover: s.cover, style: s.style, favourite: !!s.favourite, createdAt: created,
      updatedAt: created, forgottenAt: null, key, tellings, tombstone: null,
    })
  }
  return out
}

async function toEcho(r: StoredEcho): Promise<Echo> {
  const latest = [...r.tellings].sort((a, b) => b.versionNo - a.versionNo)[0]
  return {
    id: r.id, title: r.title ?? 'A forgotten memory', summary: r.summary, summaryGenerated: r.summaryGenerated,
    category: r.category, tags: r.tags, memoryDate: r.memoryDate, cover: r.cover, style: r.style, favourite: r.favourite,
    createdAt: r.createdAt, updatedAt: r.updatedAt, forgottenAt: r.forgottenAt,
    text: latest ? await decrypt(r.key, latest.ciphertext, latest.iv) : null,
    hash: latest?.contentHash ?? null, tellingCount: r.tellings.length,
  }
}

function mine(db: DemoDb): StoredEcho[] {
  const id = requireUser(db)
  return (db.data[id] ||= [])
}

function find(db: DemoDb, id: string): StoredEcho {
  const r = mine(db).find((x) => x.id === id)
  if (!r) throw new NotFoundError('This memory does not exist in your archive.')
  return r
}

export const demoAdapter: DataAdapter = {
  mode: 'demo',
  auth: {
    async getUser() { return currentUser(load()) },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    async signIn(email, password) {
      const db = load()
      const u = db.users[email.toLowerCase()]
      if (!u || u.passwordHash !== (await sha256Hex(password))) throw new Error('Email or password is incorrect.')
      db.session = u.id
      save(db); emit()
    },
    async signUp(name, email, password) {
      const db = load()
      const k = email.toLowerCase()
      if (db.users[k]) throw new Error('An account with this email already exists in this browser. Sign in instead.')
      const id = uid()
      db.users[k] = { id, name: name.trim(), email: k, passwordHash: await sha256Hex(password) }
      db.data[id] = []
      db.session = id
      save(db); emit()
      return { needsConfirmation: false }
    },
    async signOut() { const db = load(); db.session = null; save(db); emit() },
    async requestPasswordReset() {
      // Demo accounts have no email delivery. The UI says so; nothing is sent.
    },
    async updatePassword(password) {
      const db = load()
      const id = requireUser(db)
      const u = Object.values(db.users).find((x) => x.id === id)!
      u.passwordHash = await sha256Hex(password)
      save(db)
    },
    async updateProfile({ name }) {
      const db = load()
      const id = requireUser(db)
      const u = Object.values(db.users).find((x) => x.id === id)!
      u.name = name.trim()
      save(db); emit()
      return { id: u.id, name: u.name, email: u.email }
    },
    async enterDemo() {
      const db = load()
      let u = db.users[DEMO_EMAIL]
      if (!u) {
        u = { id: uid(), name: 'Jarvis', email: DEMO_EMAIL, passwordHash: await sha256Hex(uid()) }
        db.users[DEMO_EMAIL] = u
        db.data[u.id] = await buildSeed()
      }
      db.session = u.id
      save(db); emit()
    },
  },

  async listEchoes() {
    const db = load()
    return Promise.all(mine(db).map(toEcho))
  },

  async getEcho(id) {
    const db = load()
    const r = mine(db).find((x) => x.id === id)
    if (!r) return null
    const base = await toEcho(r)
    const tellings: Telling[] = []
    for (const t of [...r.tellings].sort((a, b) => a.versionNo - b.versionNo)) {
      tellings.push({
        id: t.id, versionNo: t.versionNo, toldOn: t.toldOn, label: tellingLabel(t.versionNo, t.toldOn),
        text: await decrypt(r.key, t.ciphertext, t.iv), ciphertext: t.ciphertext, contentHash: t.contentHash,
        prevHash: t.prevHash, chainHash: t.chainHash, sealedAt: t.sealedAt, claims: r.key ? t.claims : [],
      })
    }
    const detail: EchoDetail = { ...base, tellings, tombstone: r.tombstone }
    return detail
  },

  async createEcho(input: NewEchoInput) {
    const db = load()
    const key = await newKey()
    const sealed = await sealTelling(key, input.text, 'genesis')
    const now = new Date().toISOString()
    const rec: StoredEcho = {
      id: uid(), title: input.title.trim(), summary: input.summary, summaryGenerated: input.summaryGenerated,
      category: input.category, tags: input.tags, memoryDate: input.memoryDate, cover: input.cover, style: input.style,
      favourite: false, createdAt: now, updatedAt: now, forgottenAt: null, key,
      tellings: [{ id: uid(), versionNo: 1, toldOn: input.toldOn, ...sealed, claims: anchorClaims(input.text, input.claims) }], tombstone: null,
    }
    mine(db).unshift(rec)
    save(db)
    return rec.id
  },

  async retell(id, { text, toldOn, claims }) {
    const db = load()
    const r = find(db, id)
    if (!r.key) throw new Error('This memory has been forgotten and cannot be retold.')
    const last = [...r.tellings].sort((a, b) => b.versionNo - a.versionNo)[0]!
    const sealed = await sealTelling(r.key, text, last.chainHash)
    r.tellings.push({ id: uid(), versionNo: last.versionNo + 1, toldOn, ...sealed, claims: anchorClaims(text, claims) })
    r.updatedAt = new Date().toISOString()
    save(db)
  },

  async saveClaims(id, versionNo, claims) {
    const db = load()
    const t = find(db, id).tellings.find((x) => x.versionNo === versionNo)
    if (t) { t.claims = claims; save(db) }
  },

  async updateMeta(id, patch: EchoPatch) {
    const db = load()
    const r = find(db, id)
    if (r.forgottenAt) throw new Error('A forgotten memory cannot be changed.')
    Object.assign(r, patch, { updatedAt: new Date().toISOString() })
    save(db)
  },

  async forget(id) {
    const db = load()
    const r = find(db, id)
    const head = [...r.tellings].sort((a, b) => b.versionNo - a.versionNo)[0]?.chainHash ?? 'none'
    r.key = null // crypto-shredding: the ciphertext below can never be decrypted again
    r.tellings.forEach((t) => { t.contentHash = null; t.claims = [] })
    Object.assign(r, { title: null, summary: null, tags: [], cover: null, favourite: false, forgottenAt: new Date().toISOString() })
    r.tombstone = { chainHash: head, forgottenAt: r.forgottenAt! }
    save(db)
  },

  async tamper(id, versionNo) {
    const db = load()
    const r = find(db, id)
    const t = r.tellings.find((x) => x.versionNo === versionNo)
    if (!r.key || !t) throw new Error('Nothing readable to tamper with.')
    const plain = await decrypt(r.key, t.ciphertext, t.iv)
    if (plain == null) throw new Error('This telling is already unreadable.')
    const { text, word } = tamperText(plain)
    Object.assign(t, await encrypt(r.key, text)) // ciphertext changes, the seal does not
    save(db)
    return word
  },

  async forgetAll() {
    const db = load()
    const ids = mine(db).filter((r) => !r.forgottenAt).map((r) => r.id)
    for (const id of ids) await demoAdapter.forget(id)
    return ids.length
  },

  async resetDemo() {
    const db = load()
    const id = requireUser(db)
    const isDemo = db.users[DEMO_EMAIL]?.id === id
    db.data[id] = isDemo ? await buildSeed() : []
    save(db)
  },
}
