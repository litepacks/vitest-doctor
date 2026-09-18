import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { RegressionDetector } from '../../src/history/regression.js'
import type { TestProfile } from '../../src/types/index.js'

describe('Regression Detector', () => {
  const tmpDir = path.resolve(process.cwd(), '.tmp-test-reg')
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

  it('detects significant performance regressions compared to baseline', () => {
    const detector = new RegressionDetector({
      historyPath,
      baselinePath,
      regressionThreshold: 0.5 // +50%
    }, process.cwd())

    // 1. Establish baseline at 100ms
    const baselineTests: TestProfile[] = [
      { id: '1', name: 'search query', file: 'tests/search.test.ts', duration: 100 }
    ]
    detector.getStore().saveBaseline(baselineTests)

    // 2. Current run at 280ms (+180% regression)
    const currentTests: TestProfile[] = [
      { id: '1', name: 'search query', file: 'tests/search.test.ts', duration: 280 }
    ]

    const regressions = detector.analyzeRegressions(currentTests)
    expect(regressions.length).toBe(1)
    expect(regressions[0].previousDuration).toBe(100)
    expect(regressions[0].currentDuration).toBe(280)
    expect(regressions[0].percentageChange).toBe(180)
  })

  it('flags new slow tests that crossed the slow threshold', () => {
    const detector = new RegressionDetector({
      historyPath,
      baselinePath,
      slow: 500,
      regressionThreshold: 0.5
    }, process.cwd())

    // Baseline was 200ms (not slow)
    detector.getStore().saveBaseline([
      { id: '1', name: 'checkout flow', file: 'tests/checkout.test.ts', duration: 200 }
    ])

    // Current is 600ms (now slow!)
    const regressions = detector.analyzeRegressions([
      { id: '1', name: 'checkout flow', file: 'tests/checkout.test.ts', duration: 600 }
    ])

    expect(regressions.length).toBe(1)
    expect(regressions[0].isNewSlowTest).toBe(true)
  })
})
