import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { HistoryStore } from '../../src/history/store.js'
import type { TestProfile } from '../../src/types/index.js'

describe('History Store', () => {
  const tmpDir = path.resolve(process.cwd(), '.tmp-test-history')
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

  it('records runs and calculates historical median duration', () => {
    const store = new HistoryStore(historyPath, baselinePath, process.cwd())

    const run1: TestProfile[] = [
      { id: '1', name: 'test A', file: 'tests/a.test.ts', duration: 100 }
    ]
    store.recordRun(run1)

    const run2: TestProfile[] = [
      { id: '1', name: 'test A', file: 'tests/a.test.ts', duration: 200 }
    ]
    store.recordRun(run2)

    const history = store.loadHistory()
    const record = Object.values(history.tests)[0]
    expect(record).toBeDefined()
    expect(record.runs.length).toBe(2)
    expect(record.medianDuration).toBe(150)
  })

  it('saves and loads baseline snapshot', () => {
    const store = new HistoryStore(historyPath, baselinePath, process.cwd())
    const tests: TestProfile[] = [
      { id: '1', name: 'baseline test', file: 'tests/b.test.ts', duration: 85 }
    ]

    store.saveBaseline(tests)
    const baseline = store.loadBaseline()
    expect(baseline).not.toBeNull()
    const record = Object.values(baseline!.tests)[0]
    expect(record.baselineDuration).toBe(85)
  })
})
