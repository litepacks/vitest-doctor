import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { pruneCommand } from '../../src/cli/commands/prune.js'
import { HistoryStore } from '../../src/history/store.js'

describe('CLI Prune Command', () => {
  const tmpDir = path.resolve(process.cwd(), '.tmp-cli-prune')
  const historyPath = path.join(tmpDir, 'history.json')
  const baselinePath = path.join(tmpDir, 'baseline.json')

  beforeEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('runs pruneCommand and removes orphaned file records', async () => {
    const store = new HistoryStore(historyPath, baselinePath, tmpDir)
    store.recordRun([
      { id: 'non-existent-test', name: 'missing test', file: 'tests/does-not-exist.test.ts', duration: 100 }
    ])

    expect(Object.keys(store.loadHistory().tests).length).toBe(1)

    const exitCode = await pruneCommand(
      { historyPath, baselinePath },
      undefined,
      { cleanBaseline: false },
      tmpDir
    )

    expect(exitCode).toBe(0)
    const afterHistory = store.loadHistory()
    expect(Object.keys(afterHistory.tests).length).toBe(0)
  })

  it('cleans baseline snapshot when cleanBaseline option is true', async () => {
    const store = new HistoryStore(historyPath, baselinePath, tmpDir)
    store.saveBaseline([
      { id: 'base-1', name: 'baseline', file: 'tests/base.test.ts', duration: 80 }
    ])

    expect(fs.existsSync(baselinePath)).toBe(true)

    const exitCode = await pruneCommand(
      { historyPath, baselinePath },
      undefined,
      { cleanBaseline: true },
      tmpDir
    )

    expect(exitCode).toBe(0)
    expect(fs.existsSync(baselinePath)).toBe(false)
  })
})
