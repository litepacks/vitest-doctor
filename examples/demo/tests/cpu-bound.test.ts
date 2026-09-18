import { describe, it, expect } from 'vitest'

describe('Image Processing & Crypto (CPU-Bound Demo)', () => {
  it('calculates heavy cryptographic hashes synchronously', () => {
    // Deliberate heavy CPU computation
    let hash = 0
    for (let i = 0; i < 4_000_000; i++) {
      hash = (hash + Math.imul(i, 31) ^ (i % 7)) | 0
    }
    expect(typeof hash).toBe('number')
  })
})
