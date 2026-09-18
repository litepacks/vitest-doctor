import type {
  DoctorConfig,
  DoctorReport,
  DoctorReportSummary,
  FileDiagnostics,
  GitContext,
  SlowCause,
  TestProfile,
  TestRegression
} from '../types/index.js'
import { detectAnomalies } from '../scoring/anomaly-detector.js'
import { CauseEngine } from '../analyzers/cause-engine.js'
import { ConfigAdvisor } from '../analyzers/config-advisor.js'
import { RegressionDetector } from '../history/regression.js'
import { getGitContext } from '../history/git.js'
import { OverheadTracker } from '../profiler/overhead.js'

export class ReportCollector {
  private causeEngine = new CauseEngine()
  private configAdvisor = new ConfigAdvisor()
  private overheadTracker = new OverheadTracker()

  constructor(private config: DoctorConfig = {}) {}

  /**
   * Builds full diagnostic report from collected tests and file diagnostics
   */
  public generateReport(
    rawTests: TestProfile[],
    fileDiagnostics: Record<string, FileDiagnostics> = {}
  ): DoctorReport {
    this.overheadTracker.startMeasure()

    // 1. Git Context (if enabled)
    const gitContext: GitContext | undefined =
      this.config.trackGit !== false ? getGitContext(this.config.cwd) : undefined

    // 2. Filter ignored tests or files
    const tests = this.filterIgnored(rawTests)

    // 3. Anomaly Detection & Statistical Distribution
    const { stats, annotatedTests, suspiciousTests } = detectAnomalies(tests, this.config)

    // 4. Root Cause Classification for Suspicious Tests
    const diagnosedSuspiciousTests: TestProfile[] = suspiciousTests.map(test => {
      const diagnoses = this.causeEngine.diagnose(test, this.config)
      return {
        ...test,
        diagnoses
      }
    })

    // 5. Update the annotated tests list with diagnoses for suspicious ones
    const suspiciousMap = new Map(diagnosedSuspiciousTests.map(t => [t.id, t]))
    const finalTests = annotatedTests.map(t => suspiciousMap.get(t.id) || t)

    // 6. Aggregate summary counts and avoidable latency
    const initialCounts: Record<SlowCause, number> = {
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
    }

    let estimatedAvoidableMs = 0

    for (const test of diagnosedSuspiciousTests) {
      if (test.diagnoses) {
        for (const diag of test.diagnoses) {
          initialCounts[diag.cause] = (initialCounts[diag.cause] || 0) + 1

          // Calculate reasonable savings estimates based on cause
          if (diag.cause === 'slow-before-each' && test.hooks?.beforeEach) {
            estimatedAvoidableMs += Math.max(0, test.hooks.beforeEach - 10)
          } else if (diag.cause === 'slow-after-each' && test.hooks?.afterEach) {
            estimatedAvoidableMs += Math.max(0, test.hooks.afterEach - 10)
          } else if (diag.cause === 'timer-wait') {
            estimatedAvoidableMs += Math.max(0, test.duration - 10)
          } else if (diag.cause === 'polling') {
            estimatedAvoidableMs += Math.max(0, test.duration * 0.7)
          } else if (diag.cause === 'retry' && test.retryCount) {
            estimatedAvoidableMs += Math.max(0, test.duration * (test.retryCount / (test.retryCount + 1)))
          } else if (diag.cause === 'network-io') {
            estimatedAvoidableMs += Math.max(0, test.duration * 0.75)
          } else if (diag.cause === 'serial-async-execution') {
            estimatedAvoidableMs += Math.max(0, test.duration * 0.7)
          } else if (diag.cause === 'module-reset-churn') {
            estimatedAvoidableMs += Math.max(0, test.duration * 0.5)
          } else if (diag.cause === 'barrel-import-churn') {
            estimatedAvoidableMs += Math.max(0, (fileDiagnostics[test.file]?.imports || test.duration) * 0.6)
          } else if (diag.cause === 'oversized-snapshot') {
            estimatedAvoidableMs += Math.max(0, test.duration * 0.5)
          } else if (diag.cause === 'gc-thrashing' && (test.signals?.gcDurationMs || test.signals?.memory?.gcDurationMs)) {
            estimatedAvoidableMs += Math.max(0, (test.signals?.gcDurationMs || test.signals?.memory?.gcDurationMs || 0) * 0.8)
          }
        }
      }
    }

    // Include file startup slow imports in counts
    for (const diag of Object.values(fileDiagnostics)) {
      if ((diag.imports || 0) >= 300) {
        initialCounts['slow-import'] = (initialCounts['slow-import'] || 0) + 1
        estimatedAvoidableMs += Math.max(0, (diag.imports || 0) * 0.5)
      }
    }

    // 7. History & Regression
    let regressions: TestRegression[] | undefined
    if (this.config.history !== false) {
      const regressionDetector = new RegressionDetector(this.config, this.config.cwd)
      regressions = regressionDetector.analyzeRegressions(finalTests, gitContext)
      // Save current run into history store with git context
      regressionDetector.getStore().recordRun(finalTests, gitContext)
    }

    this.overheadTracker.endMeasure()

    const totalDuration = stats.totalDuration
    const overheadMs = this.overheadTracker.getTotalOverheadMs()
    const overheadPct = this.overheadTracker.calculateOverheadPercentage(totalDuration)

    const summary: DoctorReportSummary = {
      totalTests: tests.length,
      totalDuration,
      suspiciousCount: diagnosedSuspiciousTests.length,
      categoryCounts: initialCounts,
      estimatedAvoidableMs: Math.round(estimatedAvoidableMs),
      doctorOverheadPercent: Number(overheadPct.toFixed(2)),
      doctorDurationMs: Math.round(overheadMs)
    }

    // 8. Config Advisor Recommendations
    const advices = this.configAdvisor.generateAdvice(finalTests, fileDiagnostics, summary)

    return {
      version: '0.4.1',
      timestamp: new Date().toISOString(),
      git: gitContext,
      stats,
      tests: finalTests,
      suspiciousTests: diagnosedSuspiciousTests,
      files: fileDiagnostics,
      regressions,
      advices,
      summary
    }
  }

  private filterIgnored(tests: TestProfile[]): TestProfile[] {
    const ignoreList = this.config.ignore || []
    if (ignoreList.length === 0) return tests

    return tests.filter(test => {
      return !ignoreList.some(pattern => {
        if (pattern.startsWith('*') || pattern.includes('/')) {
          // Simple glob/path matcher
          const regexStr = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\//g, '\\/')
          const re = new RegExp(regexStr)
          return re.test(test.file)
        }
        return test.file.includes(pattern) || test.name.includes(pattern)
      })
    })
  }

  public getOverheadTracker(): OverheadTracker {
    return this.overheadTracker
  }
}
