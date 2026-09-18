import { describe, it, expect } from 'vitest'

describe('Benchmark: CPU Heavy', () => {
  it('cpu task 1', () => {
    let sum = 0
    for (let i = 0; i < 500_000; i++) sum += (i * 3) ^ (i % 5)
    expect(typeof sum).toBe('number')
  })

  it('cpu task 2', () => {
    let sum = 0
    for (let i = 0; i < 500_000; i++) sum += (i * 7) ^ (i % 3)
    expect(typeof sum).toBe('number')
  })
})
