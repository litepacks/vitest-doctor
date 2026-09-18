import { describe, it, expect } from 'vitest'
import { ConfigAdvisor } from '../../src/analyzers/config-advisor.js'
import type { DoctorReportSummary, FileDiagnostics, TestProfile } from '../../src/types/index.js'

describe('Config Advisor Prescription Engine', () => {
  const advisor = new ConfigAdvisor()

  const createBaseSummary = (overrides: Partial<DoctorReportSummary> = {}): DoctorReportSummary => ({
    totalTests: 10,
    totalDuration: 2000,
    suspiciousCount: 0,
    categoryCounts: {
      'slow-before-each': 0,
      'slow-before-all': 0,
      'slow-after-each': 0,
      'slow-import': 0,
      'slow-environment': 0,
      'slow-setup': 0,
      'cpu-bound': 0,
      'event-loop-blocked': 0,
      'timer-wait': 0,
      'network-io': 0,
      'filesystem-io': 0,
      'child-process': 0,
      'memory-pressure': 0,
      'gc-pressure': 0,
      'polling': 0,
      'retry': 0,
      'serial-async-execution': 0,
      'worker-initialization-overhead': 0,
      'module-reset-churn': 0,
      'unused-global-setup': 0,
      'worker-tail-latency': 0,
      'dom-leak-accumulation': 0,
      'oversized-snapshot': 0,
      'resource-contention': 0,
      'monotonic-heap-leak': 0,
      'retained-mock-calls': 0,
      'unbounded-event-listeners': 0,
      'global-state-pollution': 0,
      'large-fixture-retention': 0,
      'dangling-async-closure': 0,
      'gc-thrashing': 0,
      'heap-space-exhaustion': 0,
      'barrel-import-churn': 0,
      'unawaited-promise': 0,
      'unrestored-fake-timers': 0,
      'unknown': 0
    },
    estimatedAvoidableMs: 0,
    ...overrides
  })

  it('recommends isolate: false when worker-initialization-overhead is detected', () => {
    const summary = createBaseSummary({
      categoryCounts: {
        ...createBaseSummary().categoryCounts,
        'worker-initialization-overhead': 2
      }
    })

    const tests: TestProfile[] = Array.from({ length: 6 }, (_, i) => ({
      id: `test-${i}`,
      name: `test ${i}`,
      file: `file-${i}.test.ts`,
      duration: 50
    }))

    const advices = advisor.generateAdvice(tests, {}, summary)
    const isolationAdvice = advices.find(a => a.id === 'disable-isolation')
    expect(isolationAdvice).toBeDefined()
    expect(isolationAdvice?.impact).toBe('high')
    expect(isolationAdvice?.configSnippet).toContain('isolate: false')
  })

  it('recommends environment: "node" when multiple slow-environment causes are present', () => {
    const summary = createBaseSummary({
      categoryCounts: {
        ...createBaseSummary().categoryCounts,
        'slow-environment': 3
      }
    })

    const advices = advisor.generateAdvice([], {}, summary)
    const envAdvice = advices.find(a => a.id === 'use-node-environment')
    expect(envAdvice).toBeDefined()
    expect(envAdvice?.configSnippet).toContain("environment: 'node'")
  })

  it('recommends concurrent execution when serial async tests exist', () => {
    const summary = createBaseSummary({
      categoryCounts: {
        ...createBaseSummary().categoryCounts,
        'serial-async-execution': 2
      }
    })

    const advices = advisor.generateAdvice([], {}, summary)
    const concurrentAdvice = advices.find(a => a.id === 'enable-concurrent')
    expect(concurrentAdvice).toBeDefined()
    expect(concurrentAdvice?.prescription).toContain('describe.concurrent')
    expect(concurrentAdvice?.prescription).toContain('CAUTION')
    expect(concurrentAdvice?.configSnippet).toContain('describe.concurrent')
  })

  it('recommends singleThread for small suites with worker overhead', () => {
    const summary = createBaseSummary({
      totalDuration: 3500,
      categoryCounts: {
        ...createBaseSummary().categoryCounts,
        'worker-initialization-overhead': 1
      }
    })

    const tests: TestProfile[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-${i}`,
      name: `test ${i}`,
      file: `file-${i}.test.ts`,
      duration: 30
    }))

    const advices = advisor.generateAdvice(tests, {}, summary)
    const singleThreadAdvice = advices.find(a => a.id === 'single-thread-small-suite')
    expect(singleThreadAdvice).toBeDefined()
    expect(singleThreadAdvice?.configSnippet).toContain('singleThread: true')
  })
})
