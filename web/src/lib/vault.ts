// Per-memory AES-GCM encryption. Destroying a memory's key = crypto-shredding.

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function newKey(): Promise<string> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  return b64(await crypto.subtle.exportKey('raw', key))
}

const importKey = (keyB64: string) => crypto.subtle.importKey('raw', unb64(keyB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

export async function encrypt(keyB64: string, text: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(keyB64), new TextEncoder().encode(text))
  return { ciphertext: b64(ct), iv: b64(iv) }
}

/** Plaintext, or null if the key is gone or the ciphertext was altered (AES-GCM rejects tampering). */
export async function decrypt(keyB64: string | null | undefined, ciphertext: string, iv: string): Promise<string | null> {
  if (!keyB64) return null
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await importKey(keyB64), unb64(ciphertext))
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}
