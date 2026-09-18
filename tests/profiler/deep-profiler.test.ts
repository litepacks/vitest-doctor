import { describe, it, expect } from 'vitest'
import { DeepProfiler } from '../../src/profiler/deep-profiler.js'
import { AsyncTracker } from '../../src/profiler/async-tracker.js'

describe('Deep Profiler & Async Tracker', () => {
  it('tracks async resources created within test execution', async () => {
    const tracker = new AsyncTracker()
    tracker.start()

    await new Promise<void>(resolve => {
      setTimeout(() => {
        resolve()
      }, 50)
    })

    const stats = tracker.stop()
    expect(stats.createdCounts['Timeout']).toBeGreaterThanOrEqual(1)
  })

  it('measures CPU and ELU signals in deep profiler', async () => {
    const profiler = new DeepProfiler()
    profiler.start()

    // Perform small CPU work
    let sum = 0
    for (let i = 0; i < 500_000; i++) {
      sum += Math.sqrt(i)
    }

    const signals = profiler.stop()
    expect(signals.cpuUserMs).toBeGreaterThanOrEqual(0)
    expect(signals.eventLoopUtilization).toBeGreaterThanOrEqual(0)
    expect(signals.memory?.before).toBeGreaterThan(0)
    expect(signals.memory?.after).toBeGreaterThan(0)
    expect(sum).toBeGreaterThan(0)
  })

  it('profiles async functions cleanly with profileAsync', async () => {
    const profiler = new DeepProfiler()
    const { result, signals } = await profiler.profileAsync(async () => {
      await new Promise(r => setTimeout(r, 20))
      return 'done'
    })

    expect(result).toBe('done')
    expect(signals.asyncResources?.createdCounts['Timeout']).toBeGreaterThanOrEqual(1)
  })
})
