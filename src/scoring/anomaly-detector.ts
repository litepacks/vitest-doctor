import type { DoctorConfig, StatisticalSummary, TestProfile } from '../types/index.js'
import { computeModifiedZScore, computeStatistics } from './statistics.js'

export interface AnomalyDetectionResult {
  stats: StatisticalSummary
  annotatedTests: TestProfile[]
  suspiciousTests: TestProfile[]
}

/**
 * Evaluates test profiles against statistical distribution and absolute thresholds
 */
export function detectAnomalies(
  tests: TestProfile[],
  config: DoctorConfig
): AnomalyDetectionResult {
  const durations = tests.map(t => t.duration)
  const stats = computeStatistics(durations)

  const slowThreshold = config.slow ?? 500
  const verySlowThreshold = config.verySlow ?? 1500
  const relativeEnabled = config.relative ?? true
  const medianMultiplier = config.medianMultiplier ?? 5
  const madMultiplier = config.madMultiplier ?? 3.5

  const annotatedTests: TestProfile[] = tests.map(test => {
    const outlierReasons: string[] = []
    let isOutlier = false

    const relMultiplier = stats.median > 0 ? test.duration / stats.median : 1
    const madScore = computeModifiedZScore(test.duration, stats.median, stats.mad)

    // 1. Absolute thresholds
    if (test.duration >= verySlowThreshold) {
      isOutlier = true
      outlierReasons.push(`Duration (${test.duration.toFixed(0)}ms) exceeds very-slow threshold (${verySlowThreshold}ms)`)
    } else if (test.duration >= slowThreshold) {
      isOutlier = true
      outlierReasons.push(`Duration (${test.duration.toFixed(0)}ms) exceeds slow threshold (${slowThreshold}ms)`)
    }

    // 2. Relative anomaly detection
    // Only apply relative check if duration is meaningfully non-trivial (> 35ms) to prevent noise on microbenchmarks
    if (relativeEnabled && stats.count >= 4 && test.duration >= 35) {
      if (stats.median > 0 && relMultiplier >= medianMultiplier) {
        isOutlier = true
        outlierReasons.push(
          `Duration is ${relMultiplier.toFixed(1)}x the suite median (${stats.median.toFixed(0)}ms)`
        )
      } else if (stats.mad > 0 && madScore >= madMultiplier) {
        isOutlier = true
        outlierReasons.push(
          `Statistical outlier with MAD modified Z-score of ${madScore.toFixed(1)} (threshold: ${madMultiplier})`
        )
      }
    }

    // 3. Heavy hook presence even if total duration didn't breach absolute threshold
    const beforeEachDuration = test.hooks?.beforeEach ?? 0
    const beforeAllDuration = test.hooks?.beforeAll ?? 0
    const afterEachDuration = test.hooks?.afterEach ?? 0

    if (beforeEachDuration >= 300 || (test.duration > 80 && beforeEachDuration / test.duration > 0.65)) {
      isOutlier = true
      outlierReasons.push(`beforeEach hook is disproportionately slow (${beforeEachDuration.toFixed(0)}ms)`)
    }
    if (beforeAllDuration >= 500) {
      isOutlier = true
      outlierReasons.push(`beforeAll hook is slow (${beforeAllDuration.toFixed(0)}ms)`)
    }
    if (afterEachDuration >= 300 || (test.duration > 80 && afterEachDuration / test.duration > 0.65)) {
      isOutlier = true
      outlierReasons.push(`afterEach hook is disproportionately slow (${afterEachDuration.toFixed(0)}ms)`)
    }

    return {
      ...test,
      isOutlier,
      outlierReasons,
      relativeMultiplier: relMultiplier,
      madScore
    }
  })

  // Sort suspicious tests by duration descending, prioritizing very slow and high multipliers
  const topLimit = config.top ?? 20
  const suspiciousTests = annotatedTests
    .filter(t => t.isOutlier)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, topLimit)

  return {
    stats,
    annotatedTests,
    suspiciousTests
  }
}
