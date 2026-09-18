import { describe, it, expect } from 'vitest'

describe('Debounce Notification (Timer Wait Demo)', () => {
  it('waits for real clock debounce timer without fake timers', async () => {
    let triggered = false

    setTimeout(() => {
      triggered = true
    }, 400)

    await new Promise(r => setTimeout(r, 450))
    expect(triggered).toBe(true)
  })
})
