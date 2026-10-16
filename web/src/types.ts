export const CATEGORIES = ['Personal', 'Learning', 'Projects', 'Travel', 'People', 'Ideas'] as const
export type Category = (typeof CATEGORIES)[number]

export const ART_STYLES = ['Cinematic', 'Watercolor', 'Sketch', 'Minimal', 'Fantasy'] as const
export type ArtStyle = (typeof ART_STYLES)[number]

/** One atomic fact extracted from a telling, with its exact source span. */
export interface Claim {
  text: string
  quote: string
  start: number
  end: number
}

/** One sealed telling (version) of a memory. */
export interface Telling {
  id: string
  versionNo: number
  toldOn: string | null
  label: string
  /** Decrypted text, or null when unreadable (key destroyed or ciphertext altered). */
  text: string | null
  ciphertext: string
  contentHash: string | null
  prevHash: string
  chainHash: string
  sealedAt: string
  claims: Claim[]
}

export interface Echo {
  id: string
  title: string
  summary: string | null
  summaryGenerated: boolean
  category: Category
  tags: string[]
  memoryDate: string | null
  cover: string | null
  style: ArtStyle
  favourite: boolean
  createdAt: string
  updatedAt: string
  forgottenAt: string | null
  /** Text of the latest telling (decrypted), for previews. */
  text: string | null
  /** Content hash of the latest telling (drives the seal portrait). */
  hash: string | null
  tellingCount: number
}

export interface EchoDetail extends Echo {
  tellings: Telling[]
  tombstone: { chainHash: string; forgottenAt: string } | null
}

export interface NewEchoInput {
  title: string
  text: string
  memoryDate: string | null
  toldOn: string | null
  tags: string[]
  category: Category
  style: ArtStyle
  cover: string | null
  summary: string | null
  summaryGenerated: boolean
  claims: Claim[]
}

export type EchoPatch = Partial<Pick<Echo, 'title' | 'tags' | 'category' | 'style' | 'favourite' | 'memoryDate' | 'cover'>>

export interface AppUser {
  id: string
  email: string
  name: string
}

// ---- AI results -------------------------------------------------------------

export type AiSource = 'live' | 'demo'

export interface EnhanceResult {
  source: AiSource
  title: string
  summary: string
  category: Category
  tags: string[]
  claims: Claim[]
}

export type ClaimType = 'said' | 'inferred' | 'unknown'

export interface AnswerClaim {
  text: string
  type: ClaimType
  quote: string | null
  start: number | null
  end: number | null
  verified: boolean
  note: string | null
}

export interface Assumption {
  assumption: string
  status: 'supported' | 'not_mentioned' | 'contradicted'
  quote: string | null
  start: number | null
  end: number | null
  found_in: { label: string; quote: string } | null
}

export interface AskResult {
  source: AiSource
  assumptions: Assumption[]
  claims: AnswerClaim[]
}

export type DriftLabel = 'consistent' | 'changed' | 'omitted' | 'new'

export interface DriftPair {
  label: DriftLabel
  old: string | null
  new: string | null
}

export interface AlignResult {
  source: AiSource
  pairs: DriftPair[]
}
