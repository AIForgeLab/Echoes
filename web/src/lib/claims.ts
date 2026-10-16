import type { Claim } from '../types'
import { canonicalize } from './seal'
import { findSpan } from './demoAi'

/**
 * Ties each fact to where its quote really sits in the text being saved. Facts whose quote is no
 * longer in the text (for example after the text was edited) are dropped instead of saved stale.
 */
export function anchorClaims(text: string, claims: Claim[]): Claim[] {
  const t = canonicalize(text)
  return claims.flatMap((c) => {
    const span = findSpan(t, c.quote)
    return span ? [{ ...c, quote: t.slice(span[0], span[1]), start: span[0], end: span[1] }] : []
  })
}
