import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { GitHubSummaryFormatter } from '../../src/output/github-summary.js'
import type { DoctorReport } from '../../src/types/index.js'

describe('GitHubSummaryFormatter', () => {
  const tmpSummaryFile = path.resolve(process.cwd(), '.tmp_github_step_summary.md')

  beforeEach(() => {
    if (fs.existsSync(tmpSummaryFile)) {
      fs.unlinkSync(tmpSummaryFile)
    }
  })

  afterEach(() => {
    if (fs.existsSync(tmpSummaryFile)) {
      fs.unlinkSync(tmpSummaryFile)
    }
    delete process.env.GITHUB_STEP_SUMMARY
  })

  const mockReport: DoctorReport = {
    version: '0.2.0',
    timestamp: '2026-09-17T08:00:00.000Z',
    stats: {
      count: 20,
      totalDuration: 2500,
      mean: 125,
      median: 30,
      min: 5,
      max: 900,
      p50: 30,
      p75: 80,
      p90: 400,
      p95: 750,
      p99: 900,
      mad: 15,
      stdDev: 110
    },
    tests: [],
    suspiciousTests: [
      {
        id: 't-slow',
        name: 'heavy network query test',
        file: '/app/tests/net.test.ts',
        duration: 900,
        diagnoses: [
          {
            cause: 'network-io',
            confidence: 'high',
            score: 0.9,
            evidence: ['unmocked fetch calls detected'],
            suggestion: 'Mock HTTP endpoints with msw or vi.fn().'
          }
        ]
      }
    ],
    files: {},
    regressions: [
      {
        testId: 't-slow',
        name: 'heavy network query test',
        file: '/app/tests/net.test.ts',
        previousDuration: 200,
        currentDuration: 900,
        percentageChange: 350,
        isNewSlowTest: false
      }
    ],
    summary: {
      totalTests: 20,
      totalDuration: 2500,
      suspiciousCount: 1,
      categoryCounts: { 'network-io': 1 } as any,
      estimatedAvoidableMs: 700,
      doctorOverheadPercent: 0.25,
      doctorDurationMs: 6
    }
  }

  it('formats clean Markdown step summary with KPI tables and regressions', () => {
    const formatter = new GitHubSummaryFormatter({ cwd: '/app' })
    const markdown = formatter.format(mockReport)

    expect(markdown).toContain('## 🩺 Vitest Doctor Performance Report')
    expect(markdown).toContain('heavy network query test')
    expect(markdown).toContain('`network-io`')
    expect(markdown).toContain('+350%')
    expect(markdown).toContain('2.50s')
  })

  it('includes CAUTION callout when budget violations exist', () => {
    const formatter = new GitHubSummaryFormatter()
    const markdown = formatter.format(mockReport, {
      passed: false,
      violations: [
        {
          rule: 'maxTotalDurationMs',
          expected: '2000ms',
          actual: '2500ms',
          message: 'Total test suite duration exceeded budget limit of 2000ms'
        }
      ]
    })

    expect(markdown).toContain('> [!CAUTION]')
    expect(markdown).toContain('Performance Budget Violations (1)')
    expect(markdown).toContain('maxTotalDurationMs')
  })

  it('writes summary to GITHUB_STEP_SUMMARY file path when environment variable is present', () => {
    process.env.GITHUB_STEP_SUMMARY = tmpSummaryFile
    const formatter = new GitHubSummaryFormatter()

    const written = formatter.writeToStepSummary(mockReport)
    expect(written).toBe(true)
    expect(fs.existsSync(tmpSummaryFile)).toBe(true)

    const content = fs.readFileSync(tmpSummaryFile, 'utf-8')
    expect(content).toContain('Vitest Doctor Performance Report')
  })
})
