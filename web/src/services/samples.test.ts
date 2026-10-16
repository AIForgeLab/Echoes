import { describe, expect, it } from 'vitest'
import { loadSamples, sampleQuestions, SAMPLES } from './samples'
import { seedClaims } from './seed'
import { canonicalize } from '../lib/seal'
import { CATEGORIES, type Echo, type NewEchoInput } from '../types'
import type { DataAdapter } from './adapter'

describe('sample archive', () => {
  it('every hand-written fact quotes its telling exactly once', () => {
    for (const s of SAMPLES)
      for (const t of s.tellings) {
        const text = canonicalize(t.text)
        expect(seedClaims(text, t.claims)).toHaveLength(t.claims.length)
        for (const c of t.claims) expect(text.split(c.quote).length - 1).toBe(1)
      }
  })

  it('uses the app categories and has one retold memory', () => {
    expect(SAMPLES.every((s) => (CATEGORIES as readonly string[]).includes(s.category))).toBe(true)
    expect(SAMPLES.filter((s) => s.tellings.length > 1).map((s) => s.title)).toEqual(['The Little Circuit That Changed Everything'])
    expect(sampleQuestions('  the day i was born ')).toContain('When was I born?')
  })

  it('loads through the adapter, retells, and skips titles already present', async () => {
    const created: NewEchoInput[] = []
    const retold: string[] = []
    const fake = {
      async createEcho(i: NewEchoInput) { created.push(i); return `id-${created.length}` },
      async retell(id: string) { retold.push(id) },
    } as unknown as DataAdapter
    const existing = [{ title: 'My First Salary', forgottenAt: null }] as Echo[]
    const r = await loadSamples(fake, existing)
    expect(r).toEqual({ added: 5, skipped: 1 })
    expect(created.map((c) => c.title)).not.toContain('My First Salary')
    expect(created.at(-1)?.title).toBe('The Day I Was Born')
    expect(retold).toHaveLength(1)
    expect(created.every((c) => c.claims.length > 0 && c.summary === null)).toBe(true)
  })
})
