import { describe, it, expect } from 'vitest'
import { CauseEngine } from '../../src/analyzers/cause-engine.js'
import { StaticAnalyzer } from '../../src/analyzers/static-analyzer.js'
import type { TestProfile } from '../../src/types/index.js'

describe('Memory Diagnostics Rules (8 Memory Detectors)', () => {
  const engine = new CauseEngine()
  const analyzer = new StaticAnalyzer()

  it('1. classifies monotonic-heap-leak when heap delta rises without DOM components', () => {
    const test: TestProfile = {
      id: 'mem-1',
      name: 'large dataset accumulator',
      file: 'tests/data-stream.test.ts',
      duration: 700,
      signals: {
        memory: {
          delta: 65
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'monotonic-heap-leak')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('+65.0MB')
    expect(diag?.suggestion).toContain('afterEach')
  })

  it('2. classifies retained-mock-calls when mock.calls accumulation grows unbounded', () => {
    const code = `
      import { it, vi } from 'vitest'
      it('spies service calls', () => {
        vi.spyOn(service, 'process')
      })
    `
    const findings = analyzer.analyzeSourceCode('tests/spy.test.ts', code)
    const test: TestProfile = {
      id: 'mock-1',
      name: 'spies service calls',
      file: 'tests/spy.test.ts',
      duration: 350,
      signals: {
        mockCallsCount: 850,
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'retained-mock-calls')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('850 invocations')
    expect(diag?.suggestion).toContain('vi.clearAllMocks')
  })

  it('3. classifies unbounded-event-listeners when listeners are attached without removal', () => {
    const code = `
      import { it } from 'vitest'
      it('listens to global events', () => {
        process.on('message', () => {})
      })
    `
    const findings = analyzer.analyzeSourceCode('tests/events.test.ts', code)
    const test: TestProfile = {
      id: 'events-1',
      name: 'listens to global events',
      file: 'tests/events.test.ts',
      duration: 300,
      signals: {
        listenersDelta: 8,
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'unbounded-event-listeners')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('+8 active listener(s)')
    expect(diag?.suggestion).toContain('emitter.off')
  })

  it('4. classifies global-state-pollution when globalThis/window properties are modified', () => {
    const test: TestProfile = {
      id: 'global-1',
      name: 'sets global app context',
      file: 'tests/global.test.ts',
      duration: 200,
      signals: {
        globalKeysDelta: ['__APP_INSTANCE__', '__FEATURE_FLAGS__']
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'global-state-pollution')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('__APP_INSTANCE__')
    expect(diag?.suggestion).toContain('Revert all global mutations')
  })

  it('5. classifies large-fixture-retention when heavy json fixtures are imported at module scope', () => {
    const code = `
      import data from './fixtures/big-dump.json'
      import { it } from 'vitest'
      it('processes big dump', () => {})
    `
    const findings = analyzer.analyzeSourceCode('tests/fixture.test.ts', code)
    const test: TestProfile = {
      id: 'fixture-1',
      name: 'processes big dump',
      file: 'tests/fixture.test.ts',
      duration: 400,
      signals: {
        memory: { delta: 25 },
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'large-fixture-retention')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('big-dump.json')
    expect(diag?.suggestion).toContain('streams')
  })

  it('6. classifies dangling-async-closure when active unresolved promises remain at test completion', () => {
    const test: TestProfile = {
      id: 'dangling-1',
      name: 'unsettled promise worker',
      file: 'tests/dangling.test.ts',
      duration: 500,
      signals: {
        asyncResources: {
          createdCounts: { PROMISE: 4 },
          activeCounts: { PROMISE: 2 },
          destroyedCounts: { PROMISE: 2 },
          maxDurations: {}
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'dangling-async-closure')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('2 Promise(s)')
    expect(diag?.suggestion).toContain('resolve or reject')
  })

  it('7. classifies gc-thrashing when high GC pause time consumes test execution', () => {
    const test: TestProfile = {
      id: 'gc-1',
      name: 'object churning loop',
      file: 'tests/churn.test.ts',
      duration: 600,
      signals: {
        gcDurationMs: 220,
        gcCount: 16
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'gc-thrashing')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('220ms spent in GC')
    expect(diag?.suggestion).toContain('temporary object allocations')
  })

  it('8. classifies heap-space-exhaustion when worker approaches V8 heap limit', () => {
    const test: TestProfile = {
      id: 'exhaust-1',
      name: 'near OOM buffer allocator',
      file: 'tests/oom.test.ts',
      duration: 800,
      signals: {
        heapUsageRatio: 0.86
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'heap-space-exhaustion')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('86% of V8 heap limit')
    expect(diag?.suggestion).toContain('max-old-space-size')
  })
})
