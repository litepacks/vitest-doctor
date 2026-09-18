import { describe, it, expect } from 'vitest'

describe('Fast Math & String Utilities', () => {
  it('adds numbers instantaneously', () => {
    expect(1 + 1).toBe(2)
  })

  it('multiplies numbers', () => {
    expect(5 * 5).toBe(25)
  })

  it('reverses strings correctly', () => {
    expect('vitest'.split('').reverse().join('')).toBe('tsetiv')
  })

  it('filters array elements', () => {
    expect([1, 2, 3, 4, 5].filter(x => x > 2)).toEqual([3, 4, 5])
  })
})
