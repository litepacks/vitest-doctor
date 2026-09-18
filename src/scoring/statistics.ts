import type { StatisticalSummary } from '../types/index.js'

/**
 * Calculates quantile from a sorted array of numbers using linear interpolation
 * @param sortedNumbers Ascending sorted array of numbers
 * @param q Quantile between 0 and 1
 */
export function calculatePercentile(sortedNumbers: number[], q: number): number {
  if (sortedNumbers.length === 0) return 0
  if (sortedNumbers.length === 1) return sortedNumbers[0]
  if (q <= 0) return sortedNumbers[0]
  if (q >= 1) return sortedNumbers[sortedNumbers.length - 1]

  const pos = (sortedNumbers.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base

  if (sortedNumbers[base + 1] !== undefined) {
    return sortedNumbers[base] + rest * (sortedNumbers[base + 1] - sortedNumbers[base])
  }
  return sortedNumbers[base]
}

/**
 * Calculates Median of a numeric array
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  return calculatePercentile(sorted, 0.5)
}

/**
 * Calculates Median Absolute Deviation (MAD)
 * MAD = median(|x_i - median(X)|)
 */
export function calculateMAD(numbers: number[], median?: number): number {
  if (numbers.length <= 1) return 0
  const med = median ?? calculateMedian(numbers)
  const deviations = numbers.map(x => Math.abs(x - med))
  return calculateMedian(deviations)
}

/**
 * Calculates comprehensive statistical distribution for a set of durations
 */
export function computeStatistics(durations: number[]): StatisticalSummary {
  const count = durations.length
  if (count === 0) {
    return {
      count: 0,
      totalDuration: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      mad: 0,
      stdDev: 0
    }
  }

  const sorted = [...durations].sort((a, b) => a - b)
  const totalDuration = sorted.reduce((sum, d) => sum + d, 0)
  const mean = totalDuration / count
  const min = sorted[0]
  const max = sorted[count - 1]

  const p50 = calculatePercentile(sorted, 0.5)
  const p75 = calculatePercentile(sorted, 0.75)
  const p90 = calculatePercentile(sorted, 0.9)
  const p95 = calculatePercentile(sorted, 0.95)
  const p99 = calculatePercentile(sorted, 0.99)
  const median = p50

  const mad = calculateMAD(sorted, median)

  // Standard deviation
  const variance = count > 1
    ? sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (count - 1)
    : 0
  const stdDev = Math.sqrt(variance)

  return {
    count,
    totalDuration,
    mean,
    median,
    min,
    max,
    p50,
    p75,
    p90,
    p95,
    p99,
    mad,
    stdDev
  }
}

/**
 * Computes Modified Z-score:
 * M_i = 0.6745 * |x - median| / MAD
 */
export function computeModifiedZScore(value: number, median: number, mad: number): number {
  if (mad === 0) return 0
  return (0.6745 * Math.abs(value - median)) / mad
}
