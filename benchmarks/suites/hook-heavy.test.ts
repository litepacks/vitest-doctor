import { describe, it, expect, beforeEach } from 'vitest'

describe('Benchmark: Hook Heavy', () => {
  beforeEach(async () => {
    await new Promise(r => setTimeout(r, 10))
  })

  it('hook test 1', () => {
    expect(1).toBe(1)
  })

  it('hook test 2', () => {
    expect(2).toBe(2)
  })
})
