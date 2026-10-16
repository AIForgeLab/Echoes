// The Seal: canonical text -> SHA-256 -> a hash chain across tellings (like git commits).

/** Unicode NFC + collapse whitespace + trim. Must match canonicalize() in api/core.py. */
export function canonicalize(text: string): string {
  return (text || '').normalize('NFC').replace(/\s+/g, ' ').trim()
}

export async function sha256Hex(str: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const contentHash = (text: string) => sha256Hex(canonicalize(text))

export const chainHash = (prevHash: string, cHash: string, sealedAt: string) => sha256Hex(`${prevHash}|${cHash}|${sealedAt}`)

export interface SealCheck {
  versionNo: number
  ok: boolean
  reason: string | null
  recomputedHash: string | null
}

interface Sealable {
  versionNo: number
  text: string | null
  contentHash: string | null
  prevHash: string
  chainHash: string
  sealedAt: string
}

/** Recompute every hash in the chain. Never reports success without actually checking. */
export async function verifyChain(tellings: Sealable[]): Promise<SealCheck[]> {
  const sorted = [...tellings].sort((a, b) => a.versionNo - b.versionNo)
  const out: SealCheck[] = []
  let expectedPrev = 'genesis'
  for (const t of sorted) {
    if (t.text == null || t.contentHash == null) {
      out.push({ versionNo: t.versionNo, ok: false, reason: t.contentHash == null ? 'forgotten: key destroyed' : 'unreadable: ciphertext was altered', recomputedHash: null })
      expectedPrev = t.chainHash
      continue
    }
    const recomputed = await contentHash(t.text)
    let reason: string | null = null
    if (t.prevHash !== expectedPrev) reason = 'chain link broken: an earlier telling changed or is missing'
    else if (recomputed !== t.contentHash) reason = 'text no longer matches its seal'
    else if ((await chainHash(t.prevHash, t.contentHash, t.sealedAt)) !== t.chainHash) reason = 'chain hash mismatch'
    out.push({ versionNo: t.versionNo, ok: !reason, reason, recomputedHash: recomputed })
    expectedPrev = t.chainHash
  }
  return out
}
