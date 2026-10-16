// OFFLINE DEMO "AI": simple, transparent word-matching rules, used only when the Echoes AI server
// isn't reachable. Every result it produces is labelled "demo" in the UI. It follows the same
// Truth Boundary contract as the real pipeline: nothing counts as "said" without an exact quote.
import { canonicalize } from './seal'
import type { AlignResult, AskResult, Assumption, AnswerClaim, Category, Claim, DriftPair, EnhanceResult } from '../types'

const STOP = new Set(
  'a an the and or but so of to in on at for with from by as is was were be been being am are it its this that these those i me my we our you your he she his her they them their there here what which who whom whose when where why how did do does done had has have having not no yes than then too very can could would should will just about into over after before because while if also only own same such more most some any all each both few other up down out off again further once day time made make makes every first still means mean tiny little much many really always never today yesterday sunday monday week year years thing things felt feel lot whole'.split(' '),
)
// Words that ask for evaluation rather than assert a fact
const ASKING = new Set('important matter matters mattered mean meant meaning feel felt feeling proud happy sad think thought significant special remember remembered why moment'.split(' '))
const SYNONYMS: Record<string, string> = { dad: 'father', papa: 'father', daddy: 'father', mom: 'mother', mum: 'mother', mama: 'mother', built: 'build', building: 'build', kid: 'child', wanted: 'want' }

export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z']/g, '').replace(/'s$/, '')
  if (SYNONYMS[w]) return SYNONYMS[w]
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  return SYNONYMS[w] ?? w
}

export function contentWords(text: string): string[] {
  return text.split(/\s+/).map(stem).filter((w) => w.length > 2 && !STOP.has(w))
}

export function sentences(text: string): { s: string; start: number; end: number }[] {
  const out: { s: string; start: number; end: number }[] = []
  const re = /[^.!?]+[.!?]?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const s = raw.trim()
    if (s) out.push({ s, start: m.index + lead, end: m.index + lead + s.length })
  }
  return out
}

const CATEGORY_WORDS: [Category, string[]][] = [
  ['Travel', ['trip', 'travel', 'flight', 'mountain', 'journey', 'city', 'beach', 'abroad']],
  ['Learning', ['learn', 'code', 'coding', 'study', 'class', 'debug', 'book', 'lesson', 'course']],
  ['Projects', ['project', 'build', 'robot', 'fair', 'prototype', 'hackathon', 'app']],
  ['People', ['friend', 'friends', 'family', 'father', 'mother', 'brother', 'sister', 'grandma', 'people']],
  ['Ideas', ['idea', 'thought', 'imagine', 'concept', 'plan']],
]

export function demoEnhance(raw: string): EnhanceResult {
  const text = canonicalize(raw)
  const words = contentWords(text)
  const freq = new Map<string, number>()
  for (const w of words) if (w.length > 3) freq.set(w, (freq.get(w) ?? 0) + 1)
  const tags = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([w]) => w)
  const cat = CATEGORY_WORDS.find(([, ws]) => ws.some((w) => words.includes(stem(w))))?.[0] ?? 'Personal'
  const sents = sentences(text)
  const first = sents[0]?.s ?? text
  const titleWords = (tags.slice(0, 2).length ? tags.slice(0, 2) : ['untitled', 'echo']).map((w) => w[0]!.toUpperCase() + w.slice(1))
  return {
    source: 'demo',
    title: titleWords.join(' & '),
    summary: first.length > 160 ? `${first.slice(0, 157)}…` : first,
    category: cat,
    tags,
    claims: sents.map((x) => ({ text: x.s, quote: x.s, start: x.start, end: x.end })),
  }
}

const has = (pool: Set<string>, w: string) => pool.has(w)

export function demoAsk(raw: string, question: string, others: { label: string; text: string }[]): AskResult {
  const text = canonicalize(raw)
  const sents = sentences(text)
  const pool = new Set(contentWords(text))
  const qWords = contentWords(question)
  const factWords = qWords.filter((w) => !ASKING.has(w))
  const yesNo = /^\s*(was|were|did|is|does|had|has|have|do|are)\b/i.test(question)

  // Guard: words the question takes for granted that the memory never uses
  const assumptions: Assumption[] = []
  const clauseMatch = question.match(/\b(when|after|because|since|while|that)\b(.+?)[?.!]?$/i)
  if (clauseMatch) {
    const clause = clauseMatch[2]!.trim()
    const clauseMissing = contentWords(clause).filter((w) => !ASKING.has(w) && !has(pool, w))
    if (clauseMissing.length) {
      let found: Assumption['found_in'] = null
      for (const o of others) {
        const os = sentences(canonicalize(o.text)).find((x) => clauseMissing.some((w) => contentWords(x.s).includes(w)))
        if (os) { found = { label: o.label, quote: os.s }; break }
      }
      assumptions.push({ assumption: clause.replace(/^the /i, 'the '), status: 'not_mentioned', quote: null, start: null, end: null, found_in: found })
    }
  }

  const claims: AnswerClaim[] = []
  const scored = sents
    .map((x) => ({
      ...x,
      score: contentWords(x.s).filter((w) => qWords.includes(w)).length,
      // strong signs that a sentence says why something mattered; "so"/"because" alone often just explain circumstances
      causal: /\b(inspired|made me|that's when|realized|realised|taught me|changed|decided)\b/i.test(x.s) ? 2 : /\b(because|so)\b/i.test(x.s) ? 1 : 0,
    }))
    .sort((a, b) => b.causal - a.causal || b.score - a.score)

  if (yesNo) {
    const full = sents.find((x) => factWords.length > 0 && factWords.every((w) => contentWords(x.s).includes(w)))
    if (full && !assumptions.length) {
      claims.push({ text: `Your memory says: “${full.s}”`, type: 'said', quote: full.s, start: full.start, end: full.end, verified: true, note: null })
    } else {
      const q = question.trim().replace(/[?.!]+$/, '').replace(/\bmy\b/gi, 'your').replace(/\bI\b/g, 'you')
      // "Was your father an engineer" -> "whether your father was an engineer"
      const m = q.match(/^(was|were|is|are)\s+((?:your|the|our|his|her|their)\s+\w+)\s+(.+)$/i)
      const text = m
        ? `This memory does not say whether ${m[2]} ${m[1]!.toLowerCase()} ${m[3]}.`
        : `This memory does not say. Nothing in it answers “${q[0]!.toUpperCase()}${q.slice(1)}?”`
      claims.push({ text, type: 'unknown', quote: null, start: null, end: null, verified: false, note: null })
    }
  } else {
    const asksWhy = /\b(why|important|matter|mean|significant)\b/i.test(question)
    const best = (asksWhy ? scored.find((x) => x.causal > 0) : undefined) ?? [...scored].sort((a, b) => b.score - a.score).find((x) => x.score > 0)
    if (best) {
      claims.push({ text: `Your memory says: “${best.s}”`, type: 'said', quote: best.s, start: best.start, end: best.end, verified: true, note: null })
      claims.push({ text: 'Perhaps it stays with you because it marks a beginning: the moment an interest became part of who you are.', type: 'inferred', quote: null, start: null, end: null, verified: false, note: null })
    } else {
      claims.push({ text: 'This memory does not say anything about that.', type: 'unknown', quote: null, start: null, end: null, verified: false, note: null })
    }
  }
  return { source: 'demo', assumptions, claims }
}

export function demoAlign(oldClaims: string[], newClaims: string[]): AlignResult {
  const ow = oldClaims.map((c) => new Set(contentWords(c)))
  const nw = newClaims.map((c) => new Set(contentWords(c)))
  const cands: { i: number; j: number; score: number }[] = []
  ow.forEach((a, i) =>
    nw.forEach((b, j) => {
      const inter = [...a].filter((w) => b.has(w)).length
      const score = inter / Math.max(1, Math.min(a.size, b.size))
      if (score >= 0.5) cands.push({ i, j, score: score + inter * 0.01 })
    }),
  )
  cands.sort((x, y) => y.score - x.score)
  const usedO = new Set<number>(), usedN = new Set<number>()
  const pairs: DriftPair[] = []
  for (const c of cands) {
    if (usedO.has(c.i) || usedN.has(c.j)) continue
    usedO.add(c.i); usedN.add(c.j)
    const same = ow[c.i]!.size === nw[c.j]!.size && [...ow[c.i]!].every((w) => nw[c.j]!.has(w))
    pairs.push({ label: same ? 'consistent' : 'changed', old: oldClaims[c.i]!, new: newClaims[c.j]! })
  }
  oldClaims.forEach((c, i) => { if (!usedO.has(i)) pairs.push({ label: 'omitted', old: c, new: null }) })
  newClaims.forEach((c, j) => { if (!usedN.has(j)) pairs.push({ label: 'new', old: null, new: c }) })
  const order = { consistent: 0, changed: 1, omitted: 2, new: 3 }
  pairs.sort((a, b) => order[a.label] - order[b.label])
  return { source: 'demo', pairs }
}

/** Exact (or trimmed, case-insensitive) quote location; mirrors api/core.py find_span. */
export function findSpan(text: string, quote: string): [number, number] | null {
  const t = canonicalize(text), q = canonicalize(quote)
  if (!q) return null
  let i = t.indexOf(q)
  if (i >= 0) return [i, i + q.length]
  const trimmed = q.replace(/^[\s"'“”‘’.,;:!?]+|[\s"'“”‘’.,;:!?]+$/g, '')
  if (trimmed.length < 3) return null
  i = t.toLowerCase().indexOf(trimmed.toLowerCase())
  return i >= 0 ? [i, i + trimmed.length] : null
}

export type { Claim }
