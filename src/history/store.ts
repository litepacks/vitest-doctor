import fs from 'node:fs'
import path from 'node:path'
import type { GitContext, HistoryData, TestHistoryRecord, TestProfile } from '../types/index.js'
import { calculateMedian } from '../scoring/statistics.js'
import { getTestIdentity } from './identity.js'

const CURRENT_VERSION = '1.1.0'
const DEFAULT_MAX_RUNS_PER_TEST = 20

export interface PruneResult {
  prunedCount: number
  remainingCount: number
  removedIds: string[]
}

export interface PruneOptions {
  activeTestIds?: string[] | Set<string>
  pruneMissingFiles?: boolean
}

export class HistoryStore {
  private historyFilePath: string
  private baselineFilePath: string
  private maxRunsPerTest: number

  constructor(
    historyPath = '.vitest-doctor/history.json',
    baselinePath = '.vitest-doctor/baseline.json',
    private cwd = process.cwd(),
    maxRunsPerTest = DEFAULT_MAX_RUNS_PER_TEST
  ) {
    this.historyFilePath = path.isAbsolute(historyPath) ? historyPath : path.resolve(cwd, historyPath)
    this.baselineFilePath = path.isAbsolute(baselinePath) ? baselinePath : path.resolve(cwd, baselinePath)
    this.maxRunsPerTest = maxRunsPerTest
  }

  /**
   * Loads history from disk
   */
  public loadHistory(): HistoryData {
    if (!fs.existsSync(this.historyFilePath)) {
      return {
        version: CURRENT_VERSION,
        updatedAt: new Date().toISOString(),
        tests: {}
      }
    }

    try {
      const content = fs.readFileSync(this.historyFilePath, 'utf-8')
      return JSON.parse(content) as HistoryData
    } catch {
      return {
        version: CURRENT_VERSION,
        updatedAt: new Date().toISOString(),
        tests: {}
      }
    }
  }

  /**
   * Saves updated history to disk
   */
  public saveHistory(data: HistoryData): void {
    try {
      const dir = path.dirname(this.historyFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      data.updatedAt = new Date().toISOString()
      fs.writeFileSync(this.historyFilePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[vitest-doctor] Failed to save history to disk:', err)
    }
  }

  /**
   * Records a suite run into history store
   */
  public recordRun(tests: TestProfile[], git?: GitContext): HistoryData {
    const history = this.loadHistory()
    const now = new Date().toISOString()
    if (git) {
      history.git = git
    }

    for (const test of tests) {
      const id = getTestIdentity(test.file, test.suitePath, test.name, this.cwd)
      let record: TestHistoryRecord = history.tests[id]

      if (!record) {
        record = {
          id,
          file: test.file,
          name: test.name,
          suitePath: test.suitePath,
          runs: [],
          medianDuration: test.duration,
          git
        }
        history.tests[id] = record
      } else if (git) {
        record.git = git
      }

      record.runs.push({
        timestamp: now,
        duration: test.duration,
        git
      })

      // Keep sliding window
      if (record.runs.length > this.maxRunsPerTest) {
        record.runs = record.runs.slice(-this.maxRunsPerTest)
      }

      const durations = record.runs.map(r => r.duration)
      record.medianDuration = calculateMedian(durations)
    }

    this.saveHistory(history)
    return history
  }

  /**
   * Saves current test run as the baseline snapshot
   */
  public saveBaseline(tests: TestProfile[], git?: GitContext): void {
    const baseline: HistoryData = {
      version: CURRENT_VERSION,
      updatedAt: new Date().toISOString(),
      git,
      tests: {}
    }

    for (const test of tests) {
      const id = getTestIdentity(test.file, test.suitePath, test.name, this.cwd)
      baseline.tests[id] = {
        id,
        file: test.file,
        name: test.name,
        suitePath: test.suitePath,
        runs: [{
          timestamp: baseline.updatedAt,
          duration: test.duration,
          git
        }],
        medianDuration: test.duration,
        baselineDuration: test.duration,
        git
      }
    }

    try {
      const dir = path.dirname(this.baselineFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.baselineFilePath, JSON.stringify(baseline, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[vitest-doctor] Failed to save baseline:', err)
    }
  }

  /**
   * Loads baseline snapshot if present
   */
  public loadBaseline(): HistoryData | null {
    if (!fs.existsSync(this.baselineFilePath)) {
      return null
    }
    try {
      const content = fs.readFileSync(this.baselineFilePath, 'utf-8')
      return JSON.parse(content) as HistoryData
    } catch {
      return null
    }
  }

  /**
   * Prunes stale tests from history (e.g. deleted files or removed tests)
   */
  public prune(options: PruneOptions = {}): PruneResult {
    const history = this.loadHistory()
    const removedIds: string[] = []
    const activeSet = options.activeTestIds ? new Set(options.activeTestIds) : null

    for (const [id, record] of Object.entries(history.tests)) {
      let isStale = false

      // 1. If active set provided, check membership
      if (activeSet) {
        if (!activeSet.has(id) && !activeSet.has(record.id)) {
          isStale = true
        }
      } else if (options.pruneMissingFiles !== false) {
        // 2. If no activeSet provided, check if file exists on disk
        const fullPath = path.isAbsolute(record.file) ? record.file : path.resolve(this.cwd, record.file)
        if (!fs.existsSync(fullPath)) {
          isStale = true
        }
      }

      if (isStale) {
        delete history.tests[id]
        removedIds.push(id)
      }
    }

    if (removedIds.length > 0) {
      this.saveHistory(history)
    }

    return {
      prunedCount: removedIds.length,
      remainingCount: Object.keys(history.tests).length,
      removedIds
    }
  }

  /**
   * Deletes the baseline snapshot file
   */
  public cleanBaseline(): boolean {
    if (fs.existsSync(this.baselineFilePath)) {
      try {
        fs.unlinkSync(this.baselineFilePath)
        return true
      } catch (err) {
        console.warn('[vitest-doctor] Failed to delete baseline file:', err)
        return false
      }
    }
    return false
  }
}

