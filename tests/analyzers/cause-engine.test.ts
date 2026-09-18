import { describe, it, expect } from 'vitest'
import { CauseEngine } from '../../src/analyzers/cause-engine.js'
import type { TestProfile } from '../../src/types/index.js'

describe('Cause Classification Engine', () => {
  const engine = new CauseEngine()

  it('classifies slow-before-each accurately with high confidence', () => {
    const test: TestProfile = {
      id: '1',
      name: 'creates a user',
      file: 'tests/users.test.ts',
      duration: 800,
      hooks: {
        beforeEach: 600
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    expect(diagnoses.length).toBeGreaterThan(0)
    const primary = diagnoses[0]
    expect(primary.cause).toBe('slow-before-each')
    expect(primary.confidence).toBe('high')
    expect(primary.evidence.some(e => e.includes('600ms'))).toBe(true)
    expect(primary.suggestion).toContain('beforeAll')
  })

  it('classifies retry cause', () => {
    const test: TestProfile = {
      id: '2',
      name: 'flaky network test',
      file: 'tests/flaky.test.ts',
      duration: 650,
      retryCount: 2
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const retryDiag = diagnoses.find(d => d.cause === 'retry')
    expect(retryDiag).toBeDefined()
    expect(retryDiag?.confidence).toBe('high')
    expect(retryDiag?.evidence[0]).toContain('retried 2 time(s)')
  })

  it('classifies cpu-bound tests from deep runtime signals', () => {
    const test: TestProfile = {
      id: '3',
      name: 'matrix multiplication',
      file: 'tests/crypto.test.ts',
      duration: 450,
      signals: {
        cpuPercent: 92,
        eventLoopUtilization: 0.88,
        asyncResources: {
          createdCounts: {},
          activeCounts: {},
          destroyedCounts: {},
          maxDurations: {}
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const cpuDiag = diagnoses.find(d => d.cause === 'cpu-bound')
    expect(cpuDiag).toBeDefined()
    expect(cpuDiag?.confidence).toBe('high')
    expect(cpuDiag?.evidence[0]).toContain('92% CPU usage')
  })

  it('classifies timer-wait from unmocked timer async resources', () => {
    const test: TestProfile = {
      id: '4',
      name: 'wait for debounce',
      file: 'tests/timer.test.ts',
      duration: 500,
      signals: {
        cpuPercent: 3,
        asyncResources: {
          createdCounts: { Timeout: 1 },
          activeCounts: {},
          destroyedCounts: { Timeout: 1 },
          maxDurations: { Timeout: 500 }
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const timerDiag = diagnoses.find(d => d.cause === 'timer-wait')
    expect(timerDiag).toBeDefined()
    expect(timerDiag?.confidence).toBe('high')
    expect(timerDiag?.suggestion).toContain('vi.useFakeTimers')
  })

  it('classifies polling loops from repeated timeouts with low CPU', () => {
    const test: TestProfile = {
      id: '5',
      name: 'waits for element',
      file: 'tests/ui.test.ts',
      duration: 600,
      signals: {
        cpuPercent: 8,
        asyncResources: {
          createdCounts: { Timeout: 12 },
          activeCounts: {},
          destroyedCounts: { Timeout: 12 },
          maxDurations: { Timeout: 50 }
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const pollDiag = diagnoses.find(d => d.cause === 'polling')
    expect(pollDiag).toBeDefined()
    expect(pollDiag?.evidence[0]).toContain('12 timer cycles')
  })

  it('classifies network-io from TCP resources and low CPU', () => {
    const test: TestProfile = {
      id: '6',
      name: 'fetches remote api',
      file: 'tests/api.test.ts',
      duration: 400,
      signals: {
        cpuPercent: 12,
        asyncResources: {
          createdCounts: { TCPCONNECTWRAP: 1, TLSWRAP: 1 },
          activeCounts: {},
          destroyedCounts: {},
          maxDurations: {}
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const netDiag = diagnoses.find(d => d.cause === 'network-io')
    expect(netDiag).toBeDefined()
    expect(netDiag?.suggestion).toContain('msw')
  })

  it('classifies filesystem-io from FS async resources', () => {
    const test: TestProfile = {
      id: '7',
      name: 'reads large dump',
      file: 'tests/fs.test.ts',
      duration: 350,
      signals: {
        cpuPercent: 15,
        asyncResources: {
          createdCounts: { FSREQCALLBACK: 3 },
          activeCounts: {},
          destroyedCounts: {},
          maxDurations: {}
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const fsDiag = diagnoses.find(d => d.cause === 'filesystem-io')
    expect(fsDiag).toBeDefined()
    expect(fsDiag?.suggestion).toContain('memfs')
  })

  it('classifies child-process when processes are spawned', () => {
    const test: TestProfile = {
      id: '8',
      name: 'runs external command',
      file: 'tests/exec.test.ts',
      duration: 700,
      signals: {
        asyncResources: {
          createdCounts: { PROCESSWRAP: 1, PIPEWRAP: 2 },
          activeCounts: {},
          destroyedCounts: {},
          maxDurations: {}
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const procDiag = diagnoses.find(d => d.cause === 'child-process')
    expect(procDiag).toBeDefined()
    expect(procDiag?.confidence).toBe('high')
  })

  it('classifies slow-import and slow-environment from file diagnostics', () => {
    const test: TestProfile = {
      id: '9',
      name: 'heavy suite',
      file: 'tests/heavy.test.ts',
      duration: 1200,
      fileDiagnostics: {
        imports: 850,
        environment: 500,
        setup: 350,
        total: 1700
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    expect(diagnoses.some(d => d.cause === 'slow-import')).toBe(true)
    expect(diagnoses.some(d => d.cause === 'slow-environment')).toBe(true)
    expect(diagnoses.some(d => d.cause === 'slow-setup')).toBe(true)
  })
})
