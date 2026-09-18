import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { HistoryStore } from '../../src/history/store.js'
import type { GitContext, TestProfile } from '../../src/types/index.js'

describe('HistoryStore Retention & Pruning', () => {
  const tmpDir = path.resolve(process.cwd(), '.tmp-test-prune')
  const historyPath = path.join(tmpDir, 'history.json')
  const baselinePath = path.join(tmpDir, 'baseline.json')

  beforeEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('records runs with git context and enforces sliding window limit', () => {
    const store = new HistoryStore(historyPath, baselinePath, process.cwd(), 3)
    const mockGit: GitContext = {
      commitHash: 'abcdef1234567890abcdef1234567890abcdef12',
      commitShortHash: 'abcdef1',
      branch: 'feature/faster-tests',
      author: 'Vitest Dev',
      message: 'optimize test runner'
    }

    const test: TestProfile = { id: 'test-1', name: 'user flow', file: 'tests/user.test.ts', duration: 100 }

    for (let i = 1; i <= 5; i++) {
      store.recordRun([{ ...test, duration: i * 50 }], mockGit)
    }

    const history = store.loadHistory()
    expect(history.git?.branch).toBe('feature/faster-tests')
    const record = Object.values(history.tests)[0]
    expect(record.runs.length).toBe(3) // bounded to maxRunsPerTest = 3
    expect(record.runs[2].duration).toBe(250)
    expect(record.runs[2].git?.commitShortHash).toBe('abcdef1')
  })

  it('prunes orphaned test records using active test IDs set', () => {
    const store = new HistoryStore(historyPath, baselinePath, process.cwd())

    store.recordRun([
      { id: 'tests/active.test.ts::active 1', name: 'active 1', file: 'tests/active.test.ts', duration: 100 },
      { id: 'tests/deleted.test.ts::deleted test', name: 'deleted test', file: 'tests/deleted.test.ts', duration: 200 }
    ])

    const beforePrune = store.loadHistory()
    const activeKey = Object.keys(beforePrune.tests).find(k => k.includes('active 1'))!
    const staleKey = Object.keys(beforePrune.tests).find(k => k.includes('deleted test'))!
    expect(Object.keys(beforePrune.tests).length).toBe(2)

    // Prune only keeping activeKey
    const result = store.prune({ activeTestIds: [activeKey] })
    expect(result.prunedCount).toBe(1)
    expect(result.remainingCount).toBe(1)

    const afterPrune = store.loadHistory()
    expect(afterPrune.tests[activeKey]).toBeDefined()
    expect(afterPrune.tests[staleKey]).toBeUndefined()
  })

  it('cleans baseline snapshot file', () => {
    const store = new HistoryStore(historyPath, baselinePath, process.cwd())
    store.saveBaseline([{ id: 'base-1', name: 'base', file: 'tests/base.test.ts', duration: 50 }])

    expect(fs.existsSync(baselinePath)).toBe(true)
    const cleaned = store.cleanBaseline()
    expect(cleaned).toBe(true)
    expect(fs.existsSync(baselinePath)).toBe(false)
  })
})
