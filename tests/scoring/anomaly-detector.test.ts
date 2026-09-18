import { describe, it, expect } from 'vitest'
import { detectAnomalies } from '../../src/scoring/anomaly-detector.js'
import type { TestProfile } from '../../src/types/index.js'

describe('Anomaly Detector', () => {
  const createTest = (id: string, name: string, duration: number, hooks = {}): TestProfile => ({
    id,
    name,
    file: 'tests/example.test.ts',
    duration,
    hooks
  })

  it('detects absolute slow and very slow tests', () => {
    const tests: TestProfile[] = [
      createTest('1', 'fast test 1', 10),
      createTest('2', 'fast test 2', 15),
      createTest('3', 'slow test', 600),
      createTest('4', 'very slow test', 1800)
    ]

    const result = detectAnomalies(tests, { slow: 500, verySlow: 1500, relative: false })

    expect(result.suspiciousTests.length).toBe(2)
    expect(result.suspiciousTests[0].name).toBe('very slow test')
    expect(result.suspiciousTests[0].isOutlier).toBe(true)
    expect(result.suspiciousTests[0].outlierReasons?.[0]).toContain('exceeds very-slow threshold')

    expect(result.suspiciousTests[1].name).toBe('slow test')
    expect(result.suspiciousTests[1].isOutlier).toBe(true)
  })

  it('detects relative anomaly based on median multiplier', () => {
    // 10 tests with 10-15ms duration, one test with 180ms
    // 180ms is under absolute 500ms threshold, but > 10x median (12ms)
    const tests: TestProfile[] = [
      createTest('1', 't1', 10),
      createTest('2', 't2', 12),
      createTest('3', 't3', 11),
      createTest('4', 't4', 13),
      createTest('5', 't5', 12),
      createTest('6', 't6', 14),
      createTest('7', 'relative slow test', 180)
    ]

    const result = detectAnomalies(tests, {
      slow: 500,
      verySlow: 1500,
      relative: true,
      medianMultiplier: 5
    })

    expect(result.suspiciousTests.length).toBe(1)
    expect(result.suspiciousTests[0].name).toBe('relative slow test')
    expect(result.suspiciousTests[0].isOutlier).toBe(true)
    expect(result.suspiciousTests[0].outlierReasons?.some(r => r.includes('the suite median'))).toBe(true)
  })

  it('detects disproportionately slow hooks', () => {
    const tests: TestProfile[] = [
      createTest('1', 'hook heavy test', 350, { beforeEach: 310 })
    ]

    const result = detectAnomalies(tests, { slow: 500, verySlow: 1500, relative: false })
    expect(result.suspiciousTests.length).toBe(1)
    expect(result.suspiciousTests[0].outlierReasons?.some(r => r.includes('beforeEach'))).toBe(true)
  })

  it('respects top limit parameter', () => {
    const tests: TestProfile[] = Array.from({ length: 30 }, (_, i) =>
      createTest(`id-${i}`, `test-${i}`, 600 + i * 10)
    )

    const result = detectAnomalies(tests, { slow: 500, top: 5 })
    expect(result.suspiciousTests.length).toBe(5)
  })
})
