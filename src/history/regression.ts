import type { DoctorConfig, GitContext, TestProfile, TestRegression } from '../types/index.js'
import { getTestIdentity } from './identity.js'
import { HistoryStore } from './store.js'

export class RegressionDetector {
  private store: HistoryStore

  constructor(
    private config: DoctorConfig = {},
    private cwd = process.cwd()
  ) {
    this.store = new HistoryStore(
      config.historyPath,
      config.baselinePath,
      cwd,
      config.maxHistoryEntries
    )
  }

  /**
   * Compares current tests against baseline or history
   */
  public analyzeRegressions(tests: TestProfile[], currentGit?: GitContext): TestRegression[] {
    const regressions: TestRegression[] = []
    const baseline = this.store.loadBaseline()
    const history = this.store.loadHistory()

    const threshold = this.config.regressionThreshold ?? 0.5 // e.g. 50% slower
    const slowThreshold = this.config.slow ?? 500

    for (const test of tests) {
      const id = getTestIdentity(test.file, test.suitePath, test.name, this.cwd)

      // Check baseline first, then history median
      const baselineRecord = baseline?.tests[id]
      const historyRecord = history.tests[id]

      const previousDuration = baselineRecord?.baselineDuration ?? historyRecord?.medianDuration
      const previousGit = baselineRecord?.git || baseline?.git || historyRecord?.git || history.git

      if (previousDuration !== undefined && previousDuration > 0) {
        const delta = test.duration - previousDuration
        const percentageChange = (delta / previousDuration) * 100

        // Only flag meaningful slowdowns (at least 40ms absolute difference)
        if (percentageChange >= threshold * 100 && delta >= 40) {
          const isNewSlowTest = previousDuration < slowThreshold && test.duration >= slowThreshold
          regressions.push({
            testId: id,
            name: test.name,
            file: test.file,
            previousDuration,
            currentDuration: test.duration,
            percentageChange,
            isNewSlowTest,
            previousGit,
            currentGit
          })
        }
      }
    }

    // Sort by largest percentage degradation
    regressions.sort((a, b) => b.percentageChange - a.percentageChange)
    return regressions
  }

  public getStore(): HistoryStore {
    return this.store
  }
}
