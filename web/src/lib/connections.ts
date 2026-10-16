// Relationships between memories, computed only from real data (tags, category, dates).
import type { Echo } from '../types'

export type LinkKind = 'shared-tags' | 'similar-theme' | 'time-related'

export interface Link {
  a: string
  b: string
  kinds: LinkKind[]
  sharedTags: string[]
  /** Jaccard overlap of tag sets, 0..1 (shown as "tag overlap", not as AI similarity). */
  tagOverlap: number
  daysApart: number | null
  reason: string
}

const TIME_WINDOW_DAYS = 45

export function linkBetween(x: Echo, y: Echo): Link | null {
  const tx = new Set(x.tags), ty = new Set(y.tags)
  const shared = [...tx].filter((t) => ty.has(t))
  const union = new Set([...tx, ...ty]).size || 1
  const kinds: LinkKind[] = []
  if (shared.length) kinds.push('shared-tags')
  if (x.category === y.category) kinds.push('similar-theme')
  let daysApart: number | null = null
  if (x.memoryDate && y.memoryDate) {
    daysApart = Math.round(Math.abs(new Date(x.memoryDate).getTime() - new Date(y.memoryDate).getTime()) / 86400000)
    if (daysApart <= TIME_WINDOW_DAYS) kinds.push('time-related')
  }
  if (!kinds.length) return null
  const reason = shared.length
    ? `Shared tag${shared.length > 1 ? 's' : ''}: ${shared.map((t) => `#${t}`).join(', ')}`
    : kinds.includes('similar-theme')
      ? `Same theme: ${x.category}`
      : `${daysApart} days apart`
  return { a: x.id, b: y.id, kinds, sharedTags: shared, tagOverlap: shared.length / union, daysApart, reason }
}

export function allLinks(echoes: Echo[]): Link[] {
  const live = echoes.filter((e) => !e.forgottenAt)
  const out: Link[] = []
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const l = linkBetween(live[i]!, live[j]!)
      if (l) out.push(l)
    }
  return out
}

export function linksFor(id: string, links: Link[]): (Link & { other: string })[] {
  return links
    .filter((l) => l.a === id || l.b === id)
    .map((l) => ({ ...l, other: l.a === id ? l.b : l.a }))
    .sort((p, q) => q.tagOverlap - p.tagOverlap || (p.daysApart ?? 9999) - (q.daysApart ?? 9999))
}
