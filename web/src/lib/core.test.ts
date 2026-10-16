import { describe, expect, it } from 'vitest'
import { canonicalize, chainHash, contentHash, verifyChain } from './seal'
import { decrypt, encrypt, newKey } from './vault'
import { portraitSvg } from './portrait'
import { demoAlign, demoAsk, findSpan } from './demoAi'
import { linkBetween } from './connections'
import { tamperText } from '../services/adapter'
import { SEEDS } from '../services/seed'
import type { Echo } from '../types'

const ROBOT_2024 = SEEDS[0]!.tellings[0]!
const ROBOT_2026 = SEEDS[0]!.tellings[1]!

describe('seal', () => {
  it('canonicalizes like the Python API', () => {
    expect(canonicalize('  a\n\n b\t c ')).toBe('a b c')
    expect(canonicalize('é')).toBe('é')
  })
  it('hashes deterministically (known SHA-256 of "abc")', async () => {
    expect(await contentHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('verifies an intact chain and catches an edited telling', async () => {
    const t1 = 'first telling', t2 = 'second telling'
    const h1 = await contentHash(t1), h2 = await contentHash(t2)
    const c1 = await chainHash('genesis', h1, 's1'), c2 = await chainHash(c1, h2, 's2')
    const chain = [
      { versionNo: 1, text: t1, contentHash: h1, prevHash: 'genesis', chainHash: c1, sealedAt: 's1' },
      { versionNo: 2, text: t2, contentHash: h2, prevHash: c1, chainHash: c2, sealedAt: 's2' },
    ]
    expect((await verifyChain(chain)).every((r) => r.ok)).toBe(true)
    const tampered = await verifyChain([{ ...chain[0]!, text: 'first tellings' }, chain[1]!])
    expect(tampered[0]!.ok).toBe(false)
    expect(tampered[0]!.reason).toMatch(/no longer matches/)
  })
})

describe('vault (crypto-shredding)', () => {
  it('round-trips, rejects tampering, and is unreadable without the key', async () => {
    const key = await newKey()
    const { ciphertext, iv } = await encrypt(key, 'secret memory')
    expect(await decrypt(key, ciphertext, iv)).toBe('secret memory')
    const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1)
    expect(await decrypt(key, flipped, iv)).toBeNull()
    expect(await decrypt(null, ciphertext, iv)).toBeNull()
    expect(await decrypt(await newKey(), ciphertext, iv)).toBeNull()
  })
})

describe('portrait', () => {
  it('is deterministic per hash and changes with the hash', async () => {
    const a = await contentHash('When I was ten')
    const b = await contentHash('When I was ten.')
    expect(portraitSvg(a)).toBe(portraitSvg(a))
    expect(portraitSvg(a)).not.toBe(portraitSvg(b))
    expect(portraitSvg(a, 'Watercolor')).not.toBe(portraitSvg(a, 'Cinematic'))
  })
})

describe('demo truth boundary (offline rules)', () => {
  it('quotes the source for a "why" question', () => {
    const r = demoAsk(ROBOT_2024.text, 'Why was this moment important?', [])
    const said = r.claims.find((c) => c.type === 'said')!
    expect(said.quote).toBe('That day inspired me to become an engineer.')
    expect(ROBOT_2024.text.slice(said.start!, said.end!)).toBe(said.quote)
  })
  it('answers unknown instead of guessing', () => {
    const r = demoAsk(ROBOT_2024.text, 'Was my father an engineer?', [])
    expect(r.claims.map((c) => c.type)).toEqual(['unknown'])
    expect(r.claims[0]!.text).toBe('This memory does not say whether your father was an engineer.')
  })
  it('flags a leading question and finds the detail in a later telling', () => {
    const r = demoAsk(ROBOT_2024.text, 'Was Dad proud when the robot won the competition?', [{ label: 'Telling 2 · 2026', text: ROBOT_2026.text }])
    expect(r.assumptions).toHaveLength(1)
    expect(r.assumptions[0]!.status).toBe('not_mentioned')
    expect(r.assumptions[0]!.found_in?.label).toBe('Telling 2 · 2026')
    expect(r.claims.some((c) => c.type === 'said')).toBe(false)
  })
})

describe('demo pentimento', () => {
  it('labels the seeded robot drift', () => {
    const old = ROBOT_2024.claims.map((c) => c.text), nu = ROBOT_2026.claims.map((c) => c.text)
    const { pairs } = demoAlign(old, nu)
    const find = (label: string, s: string) => pairs.find((p) => p.label === label && (p.old === s || p.new === s))
    expect(find('consistent', 'You were ten')).toBeTruthy()
    expect(find('changed', 'Dad and Uncle Raj helped you build it')).toBeTruthy()
    expect(find('omitted', 'It was raining')).toBeTruthy()
    expect(find('new', 'You won the competition')).toBeTruthy()
  })
  it('every seed quote really exists in its telling', () => {
    for (const s of SEEDS) for (const t of s.tellings) for (const c of t.claims) expect(findSpan(t.text, c.quote)).not.toBeNull()
  })
})

describe('connections and tampering helpers', () => {
  const base = { summary: null, summaryGenerated: false, cover: null, style: 'Cinematic', favourite: false, createdAt: '', updatedAt: '', forgottenAt: null, text: '', hash: null, tellingCount: 1 } as const
  it('links memories by shared tags with an honest overlap', () => {
    const a: Echo = { ...base, id: 'a', title: 'A', category: 'Projects', tags: ['robot', 'school'], memoryDate: '2023-12-10' }
    const b: Echo = { ...base, id: 'b', title: 'B', category: 'Travel', tags: ['robot'], memoryDate: '2020-01-01' }
    const l = linkBetween(a, b)!
    expect(l.kinds).toEqual(['shared-tags'])
    expect(l.tagOverlap).toBeCloseTo(0.5)
  })
  it('tamperText changes exactly one word', () => {
    const { text, word } = tamperText('I built my first robot with my father.')
    expect(word).toBe('uncle.')
    expect(text).toBe('I built my first robot with my uncle.')
  })
})
