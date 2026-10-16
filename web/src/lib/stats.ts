import type { Echo } from '../types'
import { allLinks } from './connections'

export function archiveStats(echoes: Echo[]) {
  const live = echoes.filter((e) => !e.forgottenAt)
  const weekAgo = Date.now() - 7 * 86400000
  return {
    total: live.length,
    connections: allLinks(live).filter((l) => l.kinds.includes('shared-tags')).length,
    retold: live.filter((e) => e.tellingCount > 1).length,
    thisWeek: live.filter((e) => new Date(e.createdAt).getTime() >= weekAgo).length,
  }
}

export type ActivityItem = { id: string; echoId: string; text: string; at: string }

export function recentActivity(echoes: Echo[], limit = 6): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const e of echoes) {
    if (e.forgottenAt) items.push({ id: `${e.id}-f`, echoId: e.id, text: 'A memory was forgotten', at: e.forgottenAt })
    else {
      items.push({ id: `${e.id}-c`, echoId: e.id, text: `Created “${e.title}”`, at: e.createdAt })
      if (e.updatedAt !== e.createdAt) items.push({ id: `${e.id}-u`, echoId: e.id, text: e.tellingCount > 1 ? `Retold “${e.title}”` : `Updated “${e.title}”`, at: e.updatedAt })
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}
