import { describe, it, expect } from 'vitest'
import { StaticAnalyzer } from '../../src/analyzers/static-analyzer.js'
import { CauseEngine } from '../../src/analyzers/cause-engine.js'
import type { TestProfile } from '../../src/types/index.js'

describe('AST Diagnostics: Barrel Imports, Unawaited Promises & Unrestored Timers', () => {
  const analyzer = new StaticAnalyzer()
  const causeEngine = new CauseEngine({ slow: 100 })

  it('detects barrel imports from index files and multi-export packages', () => {
    const code = `
import { Button, Modal, Dropdown, Table } from './components'
import { authService, userService } from '../services/index'
import { formatTime, formatDate } from './utils'
import { helper } from './helpers/index.ts'

it('renders buttons', () => {
  expect(1).toBe(1)
})
`
    const findings = analyzer.analyzeSourceCode('ui.test.ts', code)
    const barrelFindings = findings.filter(f => f.type === 'barrel-import')
    expect(barrelFindings.length).toBe(4)
    expect(barrelFindings.map(b => b.name)).toEqual([
      './components',
      '../services/index',
      './utils',
      './helpers/index.ts'
    ])
  })

  it('diagnoses barrel-import-churn when import time is high', () => {
    const test: TestProfile = {
      id: 'ui-1',
      name: 'renders complex dashboard',
      file: 'ui.test.ts',
      duration: 350,
      fileDiagnostics: {
        imports: 280,
        total: 400
      },
      signals: {
        staticFindings: [
          {
            type: 'barrel-import',
            name: '@/components',
            file: 'ui.test.ts',
            line: 2,
            column: 1
          }
        ]
      }
    }

    const diagnoses = causeEngine.diagnose(test, {})
    const barrelDiag = diagnoses.find(d => d.cause === 'barrel-import-churn')
    expect(barrelDiag).toBeDefined()
    expect(barrelDiag?.confidence).toBe('medium')
    expect(barrelDiag?.evidence[0]).toContain("Barrel import '@/components'")
  })

  it('detects unawaited expect(...).resolves / rejects calls', () => {
    const code = `
import { it, expect } from 'vitest'

it('tests promise resolution', () => {
  expect(Promise.resolve(42)).resolves.toBe(42)
  expect(Promise.reject('error')).rejects.toBe('error')
})

it('properly awaits', async () => {
  await expect(Promise.resolve(42)).resolves.toBe(42)
})
`
    const findings = analyzer.analyzeSourceCode('promise.test.ts', code)
    const unawaitedFindings = findings.filter(f => f.type === 'unawaited-promise')
    expect(unawaitedFindings.length).toBe(2)
    expect(unawaitedFindings[0].snippet).toContain('expect(Promise.resolve(42)).resolves')
  })

  it('diagnoses unawaited-promise in CauseEngine', () => {
    const test: TestProfile = {
      id: 'async-1',
      name: 'missing await test',
      file: 'promise.test.ts',
      duration: 120,
      signals: {
        staticFindings: [
          {
            type: 'unawaited-promise',
            name: 'expect(...).resolves missing await',
            file: 'promise.test.ts',
            line: 5,
            column: 3,
            snippet: 'expect(Promise.resolve(42)).resolves.toBe(42)'
          }
        ]
      }
    }

    const diagnoses = causeEngine.diagnose(test, {})
    const unawaitedDiag = diagnoses.find(d => d.cause === 'unawaited-promise')
    expect(unawaitedDiag).toBeDefined()
    expect(unawaitedDiag?.confidence).toBe('high')
    expect(unawaitedDiag?.suggestion).toContain('Add "await" before expect(...).resolves')
  })

  it('detects unrestored fake timers without cleanup', () => {
    const leakingCode = `
import { it, vi } from 'vitest'

it('uses fake timer', () => {
  vi.useFakeTimers()
  setTimeout(() => {}, 100)
  vi.advanceTimersByTime(100)
})
`
    const findings = analyzer.analyzeSourceCode('leaking-timer.test.ts', leakingCode)
    const unrestored = findings.filter(f => f.type === 'unrestored-fake-timers')
    expect(unrestored.length).toBe(1)
  })

  it('does not flag unrestored fake timers when vi.useRealTimers is present', () => {
    const cleanCode = `
import { it, afterEach, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

it('uses fake timer safely', () => {
  vi.useFakeTimers()
  setTimeout(() => {}, 100)
  vi.advanceTimersByTime(100)
})
`
    const findings = analyzer.analyzeSourceCode('clean-timer.test.ts', cleanCode)
    const unrestored = findings.filter(f => f.type === 'unrestored-fake-timers')
    expect(unrestored.length).toBe(0)
  })

  it('diagnoses unrestored-fake-timers in CauseEngine', () => {
    const test: TestProfile = {
      id: 'timer-1',
      name: 'leaking timers test',
      file: 'leaking-timer.test.ts',
      duration: 180,
      signals: {
        staticFindings: [
          {
            type: 'unrestored-fake-timers',
            name: 'vi.useFakeTimers without cleanup',
            file: 'leaking-timer.test.ts',
            line: 4,
            column: 3
          }
        ]
      }
    }

    const diagnoses = causeEngine.diagnose(test, {})
    const timerDiag = diagnoses.find(d => d.cause === 'unrestored-fake-timers')
    expect(timerDiag).toBeDefined()
    expect(timerDiag?.confidence).toBe('high')
    expect(timerDiag?.suggestion).toContain('vi.useRealTimers')
  })
})
