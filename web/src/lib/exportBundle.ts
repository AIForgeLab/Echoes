import type { EchoDetail } from '../types'

export function bundleOf(echoes: EchoDetail[]) {
  return {
    format: 'echoes-export-v1',
    exported_at: new Date().toISOString(),
    how_to_verify: 'Run: python tools/verify.py <this file>. It recomputes every SHA-256 seal and chain link without needing Echoes.',
    echoes: echoes.map((e) => ({
      id: e.id, title: e.title, category: e.category, tags: e.tags, memory_date: e.memoryDate, forgotten_at: e.forgottenAt,
      summary: e.summary, summary_generated: e.summaryGenerated,
      tellings: e.tellings.map((t) => ({
        version_no: t.versionNo, told_on: t.toldOn, text: t.text, content_hash: t.contentHash,
        prev_hash: t.prevHash, chain_hash: t.chainHash, sealed_at: t.sealedAt,
      })),
      tombstone: e.tombstone,
    })),
  }
}

export function downloadJson(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
