import { describe, it, expect } from 'vitest'
import { FastProfiler } from '../../src/profiler/fast-profiler.js'
import { VitestAdapter } from '../../src/reporter/adapter.js'
import { CauseEngine } from '../../src/analyzers/cause-engine.js'
import type { RuntimeSignals } from '../../src/types/index.js'

describe('Worker Deep Profiling & Signal Bridging', () => {
  const fastProfiler = new FastProfiler()
  const adapter = new VitestAdapter()
  const causeEngine = new CauseEngine()

  it('extracts deep profiling signals and memory stats from task.meta.doctorSignals', () => {
    const mockSignals: RuntimeSignals = {
      cpuUserMs: 120,
      cpuSystemMs: 30,
      cpuPercent: 88,
      eventLoopUtilization: 0.92,
      eventLoopDelayP99Ms: 15,
      eventLoopDelayMeanMs: 3,
      gcDurationMs: 45,
      gcCount: 4,
      heapUsageRatio: 0.75,
      memory: {
        before: 50,
        after: 75,
        delta: 25,
        peak: 80,
        heapLimitMb: 512,
        heapUsedMb: 75,
        gcDurationMs: 45,
        gcCount: 4
      },
      asyncResources: {
        createdCounts: { Timeout: 1 },
        activeCounts: { Timeout: 0 },
        destroyedCounts: { Timeout: 1 },
        maxDurations: { Timeout: 10 }
      }
    }

    const rawTask = {
      id: 'task-1',
      name: 'heavy cpu task',
      file: { filepath: '/tests/cpu.test.ts' },
      meta: {
        doctorSignals: mockSignals
      },
      result: {
        duration: 150,
        state: 'pass'
      }
    }

    const profile = fastProfiler.extractTestProfile(rawTask as any, ['MathSuite'])

    expect(profile.signals).toBeDefined()
    expect(profile.signals?.cpuPercent).toBe(88)
    expect(profile.signals?.eventLoopUtilization).toBe(0.92)
    expect(profile.memory?.delta).toBe(25)

    // Diagnose with CauseEngine
    const diagnoses = causeEngine.diagnose(profile)
    expect(diagnoses.some(d => d.cause === 'cpu-bound')).toBe(true)
  })

  it('traverses nested suites in VitestAdapter and preserves worker meta signals', () => {
    const mockSignals: RuntimeSignals = {
      cpuUserMs: 5,
      cpuSystemMs: 2,
      cpuPercent: 10,
      eventLoopUtilization: 0.05,
      eventLoopDelayP99Ms: 1,
      eventLoopDelayMeanMs: 0.2,
      asyncResources: {
        createdCounts: { Timeout: 6 },
        activeCounts: { Timeout: 0 },
        destroyedCounts: { Timeout: 6 },
        maxDurations: { Timeout: 50 }
      }
    }

    const rawFiles = [
      {
        filepath: '/tests/polling.test.ts',
        name: '/tests/polling.test.ts',
        tasks: [
          {
            name: 'Nested Describe',
            type: 'suite',
            tasks: [
              {
                name: 'polling test case',
                type: 'test',
                meta: {
                  doctorSignals: mockSignals
                },
                result: {
                  duration: 250,
                  state: 'pass'
                }
              }
            ]
          }
        ]
      }
    ]

    const { tests } = adapter.extractTestsFromFiles(rawFiles as any)
    expect(tests.length).toBe(1)
    expect(tests[0].signals).toBeDefined()
    expect(tests[0].signals?.asyncResources?.createdCounts.Timeout).toBe(6)

    const diagnoses = causeEngine.diagnose(tests[0])
    expect(diagnoses.some(d => d.cause === 'polling')).toBe(true)
  })

  it('correctly diagnoses memory pressure when heap usage is high in worker signals', () => {
    const mockSignals: RuntimeSignals = {
      cpuUserMs: 10,
      cpuSystemMs: 5,
      cpuPercent: 15,
      eventLoopUtilization: 0.1,
      eventLoopDelayP99Ms: 2,
      eventLoopDelayMeanMs: 0.5,
      gcDurationMs: 120,
      gcCount: 8,
      heapUsageRatio: 0.94,
      memory: {
        before: 400,
        after: 480,
        delta: 80,
        peak: 490,
        heapLimitMb: 512,
        heapUsedMb: 480,
        gcDurationMs: 120,
        gcCount: 8
      }
    }

    const profile = fastProfiler.extractTestProfile({
      id: 'task-mem',
      name: 'large buffer test',
      file: { filepath: '/tests/mem.test.ts' },
      meta: { doctorSignals: mockSignals },
      result: { duration: 180, state: 'pass' }
    } as any)

    const diagnoses = causeEngine.diagnose(profile)
    expect(diagnoses.some(d => d.cause === 'memory-pressure' || d.cause === 'monotonic-heap-leak' || d.cause === 'gc-thrashing')).toBe(true)
  })
})
