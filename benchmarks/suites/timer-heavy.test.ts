import { describe, it, expect } from 'vitest'

describe('Benchmark: Timer Heavy', () => {
  it('timer task 1', async () => {
    await new Promise(r => setTimeout(r, 20))
    expect(true).toBe(true)
  })

  it('timer task 2', async () => {
    await new Promise(r => setTimeout(r, 30))
    expect(true).toBe(true)
  })
})
