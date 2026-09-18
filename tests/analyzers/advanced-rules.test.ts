import { describe, it, expect } from 'vitest'
import { CauseEngine } from '../../src/analyzers/cause-engine.js'
import { StaticAnalyzer } from '../../src/analyzers/static-analyzer.js'
import type { TestProfile } from '../../src/types/index.js'

describe('Advanced Diagnostic Rules (8 New Detectors)', () => {
  const engine = new CauseEngine()
  const analyzer = new StaticAnalyzer()

  it('1. classifies serial-async-execution when multiple async tests run serially in a slow suite', () => {
    const code = `
      import { describe, it } from 'vitest'
      describe('batch suite', () => {
        it('step 1', async () => {})
        it('step 2', async () => {})
        it('step 3', async () => {})
        it('step 4', async () => {})
      })
    `
    const findings = analyzer.analyzeSourceCode('tests/batch.test.ts', code)
    const test: TestProfile = {
      id: 'serial-1',
      name: 'batch operations',
      file: 'tests/batch.test.ts',
      duration: 1200,
      signals: {
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'serial-async-execution')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.suggestion).toContain('describe.concurrent')
  })

  it('2. classifies worker-initialization-overhead when environment/worker startup dominates test duration', () => {
    const test: TestProfile = {
      id: 'worker-init-1',
      name: 'simple unit test',
      file: 'tests/isolated.test.ts',
      duration: 80,
      fileDiagnostics: {
        environment: 550,
        imports: 100,
        setup: 50,
        total: 780
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'worker-initialization-overhead')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.suggestion).toContain('isolate: false')
  })

  it('3. classifies module-reset-churn when vi.resetModules is used in hooks', () => {
    const code = `
      import { beforeEach, vi } from 'vitest'
      beforeEach(() => {
        vi.resetModules()
      })
    `
    const findings = analyzer.analyzeSourceCode('tests/churn.test.ts', code)
    const test: TestProfile = {
      id: 'churn-1',
      name: 'resets config module',
      file: 'tests/churn.test.ts',
      duration: 600,
      signals: {
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'module-reset-churn')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[0]).toContain('vi.resetModules')
    expect(diag?.suggestion).toContain('vi.clearAllMocks')
  })

  it('4. classifies unused-global-setup when expensive setupFiles run on standalone tests', () => {
    const test: TestProfile = {
      id: 'global-setup-1',
      name: 'pure utility test',
      file: 'tests/pure-utils.test.ts',
      duration: 50,
      fileDiagnostics: {
        setup: 450,
        imports: 50,
        total: 550
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'unused-global-setup')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('medium')
    expect(diag?.suggestion).toContain('global setup')
  })

  it('5. classifies worker-tail-latency when long tests run serially at the end of the suite', () => {
    const test: TestProfile = {
      id: 'tail-1',
      name: 'large integration workflow',
      file: 'tests/e2e/workflow.test.ts',
      duration: 3500
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'worker-tail-latency')
    expect(diag).toBeDefined()
    expect(diag?.evidence[0]).toContain('3500ms')
    expect(diag?.suggestion).toContain('Longest Processing Time')
  })

  it('6. classifies dom-leak-accumulation when DOM tests exhibit heap memory growth', () => {
    const code = `
      import { render, screen } from '@testing-library/react'
      import { it } from 'vitest'
      it('renders heavy modal', () => {
        render('<Modal />')
      })
    `
    const findings = analyzer.analyzeSourceCode('tests/modal.test.tsx', code)
    const test: TestProfile = {
      id: 'dom-leak-1',
      name: 'renders heavy modal',
      file: 'tests/modal.test.tsx',
      duration: 650,
      signals: {
        heapDeltaMb: 45,
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'dom-leak-accumulation')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.evidence[1]).toContain('45.0MB')
    expect(diag?.suggestion).toContain('cleanup()')
  })

  it('7. classifies oversized-snapshot when huge snapshot assertions take excessive time', () => {
    const code = `
      import { it, expect } from 'vitest'
      it('matches huge json snapshot', () => {
        expect({ big: 'data' }).toMatchSnapshot()
      })
    `
    const findings = analyzer.analyzeSourceCode('tests/snapshot.test.ts', code)
    const test: TestProfile = {
      id: 'snap-1',
      name: 'matches huge json snapshot',
      file: 'tests/snapshot.test.ts',
      duration: 550,
      signals: {
        cpuPercent: 12,
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'oversized-snapshot')
    expect(diag).toBeDefined()
    expect(diag?.confidence).toBe('high')
    expect(diag?.suggestion).toContain('toMatchObject')
  })

  it('8. classifies resource-contention when concurrent lock/handle contention blocks test execution', () => {
    const test: TestProfile = {
      id: 'contention-1',
      name: 'parallel db worker test',
      file: 'tests/db.test.ts',
      duration: 800,
      signals: {
        cpuPercent: 4,
        asyncResources: {
          createdCounts: { TCPCONNECTWRAP: 10, FSREQCALLBACK: 8 },
          activeCounts: { TCPCONNECTWRAP: 6, FSREQCALLBACK: 4 },
          destroyedCounts: {},
          maxDurations: {}
        }
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'resource-contention')
    expect(diag).toBeDefined()
    expect(diag?.evidence[1]).toContain('lock contention')
    expect(diag?.suggestion).toContain('isolated temporary directories')
  })

  it('9. suppresses serial-async-execution on stateful integration and database suites', () => {
    const code = `
      import { describe, it, beforeAll } from 'vitest'
      import db from '../core/db'
      describe('user CRUD integration suite', () => {
        beforeAll(async () => {
          await db.migrate.latest()
        })
        it('creates user in db', async () => {
          await db('users').insert({ name: 'Alice' })
        })
        it('reads created user', async () => {
          const user = await db('users').first()
        })
        it('updates user', async () => {
          await db('users').where({ name: 'Alice' }).update({ name: 'Bob' })
        })
      })
    `
    const findings = analyzer.analyzeSourceCode('tests/integration/users-db.test.ts', code)
    const test: TestProfile = {
      id: 'db-crud-1',
      name: 'user CRUD integration suite',
      file: 'tests/integration/users-db.test.ts',
      duration: 1200,
      signals: {
        staticFindings: findings
      }
    }

    const diagnoses = engine.diagnose(test, { staticAnalysis: false })
    const diag = diagnoses.find(d => d.cause === 'serial-async-execution')
    expect(diag).toBeUndefined()
  })
})
