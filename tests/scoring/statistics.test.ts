import { describe, it, expect } from 'vitest'
import {
  calculateMedian,
  calculateMAD,
  calculatePercentile,
  computeStatistics,
  computeModifiedZScore
} from '../../src/scoring/statistics.js'

describe('Statistical Utilities', () => {
  it('calculates percentiles correctly', () => {
    const data = [10, 20, 30, 40, 50]
    expect(calculatePercentile(data, 0)).toBe(10)
    expect(calculatePercentile(data, 0.5)).toBe(30)
    expect(calculatePercentile(data, 1.0)).toBe(50)
  })

  it('calculates median for even and odd count lists', () => {
    expect(calculateMedian([5, 1, 3])).toBe(3)
    expect(calculateMedian([10, 20, 30, 40])).toBe(25)
    expect(calculateMedian([])).toBe(0)
    expect(calculateMedian([42])).toBe(42)
  })

  it('calculates Median Absolute Deviation (MAD)', () => {
    // Dataset: [1, 2, 3, 4, 5, 6, 7, 8, 9] -> Median = 5
    // Deviations: [4, 3, 2, 1, 0, 1, 2, 3, 4] -> Sorted: [0, 1, 1, 2, 2, 3, 3, 4, 4] -> Median = 2
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(calculateMAD(data)).toBe(2)
    expect(calculateMAD([])).toBe(0)
    expect(calculateMAD([5])).toBe(0)
  })

  it('computes full statistics distribution', () => {
    const durations = [10, 12, 14, 15, 16, 18, 20, 25, 30, 100]
    const stats = computeStatistics(durations)

    expect(stats.count).toBe(10)
    expect(stats.totalDuration).toBe(260)
    expect(stats.mean).toBe(26)
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(100)
    expect(stats.median).toBe(17)
    expect(stats.p95).toBeGreaterThan(30)
    expect(stats.stdDev).toBeGreaterThan(0)
    expect(stats.mad).toBeGreaterThan(0)
  })

  it('handles empty distribution gracefully', () => {
    const stats = computeStatistics([])
    expect(stats.count).toBe(0)
    expect(stats.mean).toBe(0)
    expect(stats.median).toBe(0)
    expect(stats.totalDuration).toBe(0)
  })

  it('computes Modified Z-Score', () => {
    const median = 20
    const mad = 5
    // M = 0.6745 * |100 - 20| / 5 = 0.6745 * 80 / 5 = 10.792
    const z = computeModifiedZScore(100, median, mad)
    expect(z).toBeCloseTo(10.792, 2)
    expect(computeModifiedZScore(20, median, 0)).toBe(0)
  })
})
