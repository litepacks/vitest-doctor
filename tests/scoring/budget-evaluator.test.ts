import { describe, it, expect } from 'vitest'
import { evaluateBudgets } from '../../src/scoring/budget-evaluator.js'
import type { DoctorReport } from '../../src/types/index.js'

describe('BudgetEvaluator', () => {
  const createMockReport = (overrides: Partial<DoctorReport> = {}): DoctorReport => ({
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    stats: {
      count: 10,
      totalDuration: 1200,
      mean: 120,
      median: 80,
      min: 10,
      max: 600,
      p50: 80,
      p75: 150,
      p90: 400,
      p95: 550,
      p99: 600,
      mad: 20,
      stdDev: 90
    },
    tests: [
      { id: 't1', name: 'fast test', file: 't1.test.ts', duration: 20 },
      { id: 't2', name: 'slow test', file: 't2.test.ts', duration: 600 }
    ],
    suspiciousTests: [
      { id: 't2', name: 'slow test', file: 't2.test.ts', duration: 600 }
    ],
    files: {},
    summary: {
      totalTests: 10,
      totalDuration: 1200,
      suspiciousCount: 1,
      categoryCounts: { 'cpu-bound': 1 } as any,
      estimatedAvoidableMs: 400
    },
    ...overrides
  })

  it('passes when no budgets are defined and no severe regressions exist', () => {
    const report = createMockReport()
    const result = evaluateBudgets(report, { ci: true })
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('violates maxTotalDurationMs when suite exceeds time budget', () => {
    const report = createMockReport()
    const result = evaluateBudgets(report, {
      budgets: {
        maxTotalDurationMs: 1000
      }
    })

    expect(result.passed).toBe(false)
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: 'maxTotalDurationMs',
        expected: '1000ms',
        actual: '1200ms'
      })
    )
  })

  it('violates maxSlowTests when slow test count exceeds budget', () => {
    const report = createMockReport()
    const result = evaluateBudgets(report, {
      slow: 500,
      budgets: {
        maxSlowTests: 0
      }
    })

    expect(result.passed).toBe(false)
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: 'maxSlowTests',
        expected: '0',
        actual: '1'
      })
    )
  })

  it('violates failOnP95Ms when 95th percentile duration exceeds threshold', () => {
    const report = createMockReport()
    const result = evaluateBudgets(report, {
      budgets: {
        failOnP95Ms: 500
      }
    })

    expect(result.passed).toBe(false)
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: 'failOnP95Ms',
        expected: '500ms',
        actual: '550ms'
      })
    )
  })

  it('violates failOnRegressionPercent when a test regresses beyond budget threshold', () => {
    const report = createMockReport({
      regressions: [
        {
          testId: 't1',
          name: 'db integration query',
          file: 'db.test.ts',
          previousDuration: 100,
          currentDuration: 250,
          percentageChange: 150,
          isNewSlowTest: false
        }
      ]
    })

    const result = evaluateBudgets(report, {
      budgets: {
        failOnRegressionPercent: 30
      }
    })

    expect(result.passed).toBe(false)
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: 'failOnRegressionPercent',
        actual: '+150%'
      })
    )
  })
})
