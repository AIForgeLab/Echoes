import { describe, expect, it } from 'vitest'
import { anchorClaims } from './claims'
import { newKey, openField, sealField } from './vault'

describe('saving AI facts', () => {
  it('re-anchors facts to the text being saved and drops ones whose quote is gone', () => {
    const text = 'When I was ten, I built a robot.  It rained.'
    const out = anchorClaims(text, [
      { text: 'You were ten', quote: 'When I was ten', start: 99, end: 120 },
      { text: 'It snowed', quote: 'It snowed', start: 0, end: 9 },
    ])
    expect(out).toEqual([{ text: 'You were ten', quote: 'When I was ten', start: 0, end: 14 }])
  })
})

describe('field encryption', () => {
  it('hides the words, opens with the right key only, and still reads older plaintext rows', async () => {
    const key = await newKey(), other = await newKey()
    const stored = await sealField(key, 'I built my first robot')
    expect(stored.startsWith('enc:v1:')).toBe(true)
    expect(stored).not.toContain('robot')
    expect(await openField(key, stored)).toBe('I built my first robot')
    expect(await openField(other, stored)).toBeNull()
    expect(await openField(null, stored)).toBeNull()
    expect(await openField(key, 'a fact saved before encryption')).toBe('a fact saved before encryption')
    expect(await openField(key, null)).toBeNull()
  })
})
