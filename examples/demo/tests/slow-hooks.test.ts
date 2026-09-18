import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Database User Repository (Heavy Hooks Demo)', () => {
  let simulatedDb: Array<{ id: number; name: string }> = []

  beforeEach(async () => {
    // Deliberate heavy initialization per test (e.g. recreating database schema)
    await new Promise(r => setTimeout(r, 350))
    simulatedDb = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `user-${i}` }))
  })

  afterEach(async () => {
    // Deliberate afterEach purge
    await new Promise(r => setTimeout(r, 50))
    simulatedDb = []
  })

  it('creates a new user record', () => {
    simulatedDb.push({ id: 101, name: 'Alice' })
    expect(simulatedDb.find(u => u.name === 'Alice')).toBeDefined()
  })

  it('finds existing users', () => {
    expect(simulatedDb.find(u => u.id === 5)).toBeDefined()
  })
})
