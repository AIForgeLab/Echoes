import { canonicalize, chainHash, contentHash } from '../lib/seal'
import { encrypt } from '../lib/vault'

export interface SealedTelling {
  ciphertext: string
  iv: string
  contentHash: string
  prevHash: string
  chainHash: string
  sealedAt: string
}

/** Canonicalise, hash, chain and encrypt one telling. */
export async function sealTelling(keyB64: string, text: string, prevHash: string): Promise<SealedTelling> {
  const canonical = canonicalize(text)
  const cHash = await contentHash(canonical)
  const sealedAt = new Date().toISOString()
  const { ciphertext, iv } = await encrypt(keyB64, canonical)
  return { ciphertext, iv, contentHash: cHash, prevHash, chainHash: await chainHash(prevHash, cHash, sealedAt), sealedAt }
}
