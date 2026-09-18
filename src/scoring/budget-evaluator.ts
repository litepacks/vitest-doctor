import type { BudgetEvaluationResult, BudgetViolation, DoctorConfig, DoctorReport } from '../types/index.js'

function formatMs(ms: number): string {
  if (typeof ms !== 'number' || isNaN(ms)) return '0ms'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  if (ms >= 10) return `${Math.round(ms)}ms`
  if (ms >= 1) return `${ms.toFixed(1)}ms`
  return `${ms.toFixed(2)}ms`
}

/**
 * Evaluates performance budgets and CI quality gates against a diagnostic report
 */
export function evaluateBudgets(
  report: DoctorReport,
  config: DoctorConfig = {}
): BudgetEvaluationResult {
  const violations: BudgetViolation[] = []
  const budgets = config.budgets || {}
  const slowThreshold = config.slow || 500

  // 1. Max Total Duration Budget
  const maxTotal = typeof budgets.maxTotalDurationMs === 'number' ? budgets.maxTotalDurationMs : budgets.maxSuiteDuration
  if (typeof maxTotal === 'number' && maxTotal > 0) {
    if (report.summary.totalDuration > maxTotal) {
      violations.push({
        rule: 'maxTotalDurationMs',
        expected: `${Math.round(maxTotal)}ms`,
        actual: `${Math.round(report.summary.totalDuration)}ms`,
        message: `Total test suite duration (${formatMs(report.summary.totalDuration)}) exceeded budget limit of ${formatMs(maxTotal)}`
      })
    }
  }

  // 2. Max Single Test Duration Budget
  if (typeof budgets.maxTestDuration === 'number' && budgets.maxTestDuration > 0) {
    const overThresholdTests = report.tests.filter(t => t.duration > budgets.maxTestDuration!)
    if (overThresholdTests.length > 0) {
      violations.push({
        rule: 'maxTestDuration',
        expected: `${Math.round(budgets.maxTestDuration)}ms`,
        actual: `${overThresholdTests.length} test(s) exceeded`,
        message: `${overThresholdTests.length} test(s) exceeded max test duration budget of ${formatMs(budgets.maxTestDuration)} (slowest: "${overThresholdTests[0]?.name}" at ${formatMs(overThresholdTests[0]?.duration)})`
      })
    }
  }

  // 3. Max Slow Tests Budget
  if (typeof budgets.maxSlowTests === 'number' && budgets.maxSlowTests >= 0) {
    const slowCount = report.tests.filter(t => t.duration >= slowThreshold).length
    if (slowCount > budgets.maxSlowTests) {
      violations.push({
        rule: 'maxSlowTests',
        expected: `${budgets.maxSlowTests}`,
        actual: `${slowCount}`,
        message: `Found ${slowCount} slow tests (>=${formatMs(slowThreshold)}), exceeding budget limit of ${budgets.maxSlowTests}`
      })
    }
  }

  // 4. Max Suspicious Tests Budget
  if (typeof budgets.maxSuspiciousTests === 'number' && budgets.maxSuspiciousTests >= 0) {
    const suspCount = report.summary.suspiciousCount
    if (suspCount > budgets.maxSuspiciousTests) {
      violations.push({
        rule: 'maxSuspiciousTests',
        expected: `${budgets.maxSuspiciousTests}`,
        actual: `${suspCount}`,
        message: `Found ${suspCount} suspicious test(s), exceeding budget limit of ${budgets.maxSuspiciousTests}`
      })
    }
  }

  // 5. Fail on p95 test duration
  const p95Budget = typeof budgets.failOnP95Ms === 'number' ? budgets.failOnP95Ms : budgets.maxP95Duration
  if (typeof p95Budget === 'number' && p95Budget > 0) {
    if (report.stats.p95 > p95Budget) {
      violations.push({
        rule: 'failOnP95Ms',
        expected: `${Math.round(p95Budget)}ms`,
        actual: `${Math.round(report.stats.p95)}ms`,
        message: `Suite p95 test duration (${formatMs(report.stats.p95)}) exceeded budget limit of ${formatMs(p95Budget)}`
      })
    }
  }

  // 6. Fail on Regression Percentage or Max Regressions
  if (typeof budgets.maxRegressions === 'number' && budgets.maxRegressions >= 0) {
    const regressionCount = report.regressions?.length || 0
    if (regressionCount > budgets.maxRegressions) {
      violations.push({
        rule: 'maxRegressions',
        expected: `${budgets.maxRegressions}`,
        actual: `${regressionCount}`,
        message: `Found ${regressionCount} performance regressions, exceeding allowed budget of ${budgets.maxRegressions}`
      })
    }
  }

  const hasExplicitRegressionBudget = typeof budgets.failOnRegressionPercent === 'number'
  const regressionThresholdPercent = hasExplicitRegressionBudget
    ? (budgets.failOnRegressionPercent! > 1 ? budgets.failOnRegressionPercent! : budgets.failOnRegressionPercent! * 100)
    : (typeof config.regressionThreshold === 'number'
        ? (config.regressionThreshold > 1 ? config.regressionThreshold : config.regressionThreshold * 100)
        : 50)

  if (report.regressions && report.regressions.length > 0) {
    for (const reg of report.regressions) {
      if (reg.percentageChange >= regressionThresholdPercent) {
        violations.push({
          rule: 'failOnRegressionPercent',
          expected: `<+${regressionThresholdPercent}%`,
          actual: `+${reg.percentageChange.toFixed(0)}%`,
          message: `Performance regression in "${reg.name}" (+${reg.percentageChange.toFixed(0)}%, ${formatMs(reg.previousDuration)} ➔ ${formatMs(reg.currentDuration)}) exceeded threshold of +${regressionThresholdPercent}%`
        })
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations
  }
}
