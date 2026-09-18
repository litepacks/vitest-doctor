import fs from 'node:fs'
import path from 'node:path'
import type { BudgetEvaluationResult, DoctorConfig, DoctorReport } from '../types/index.js'

export class GitHubSummaryFormatter {
  constructor(private config: DoctorConfig = {}) {}

  /**
   * Generates GitHub Flavored Markdown summary suitable for $GITHUB_STEP_SUMMARY
   */
  public format(report: DoctorReport, budgetEvaluation?: BudgetEvaluationResult): string {
    const passed = budgetEvaluation ? budgetEvaluation.passed : (report.summary.suspiciousCount === 0)
    const statusIcon = passed ? '✅' : '⚠️'
    const statusText = passed ? 'PASSED' : (budgetEvaluation && !budgetEvaluation.passed ? 'FAILED (Budget Violations)' : 'PASSED WITH WARNINGS')
    const totalSec = (report.summary.totalDuration / 1000).toFixed(2)
    const avoidableSec = (report.summary.estimatedAvoidableMs / 1000).toFixed(2)

    const lines: string[] = []

    lines.push(`## 🩺 Vitest Doctor Performance Report ${statusIcon}`)
    const gitSnippet = report.git?.branch ? ` &nbsp;|&nbsp; **Branch:** \`${report.git.branch}\` (\`${report.git.commitShortHash || report.git.commitHash?.slice(0, 7) || 'HEAD'}\`)` : ''
    lines.push(`> **Status:** \`${statusText}\` &nbsp;|&nbsp; **Suite Duration:** \`${totalSec}s\` &nbsp;|&nbsp; **Total Tests:** \`${report.summary.totalTests}\`${gitSnippet}\n`)

    // Budget Violations Alert
    if (budgetEvaluation && !budgetEvaluation.passed && budgetEvaluation.violations.length > 0) {
      lines.push(`> [!CAUTION]`)
      lines.push(`> ### 🚨 Performance Budget Violations (${budgetEvaluation.violations.length})`)
      lines.push(`>`)
      for (const v of budgetEvaluation.violations) {
        lines.push(`> - **${v.rule}**: ${v.message} *(Limit: \`${v.expected}\`, Actual: \`${v.actual}\`)*`)
      }
      lines.push('')
    }

    // Key Performance Metrics Table
    lines.push(`### 📊 Key Performance Metrics`)
    lines.push(`| Metric | Value | Baseline / Target |`)
    lines.push(`| :--- | :--- | :--- |`)
    lines.push(`| **Total Test Suite Duration** | \`${totalSec}s\` (${report.summary.totalDuration}ms) | - |`)
    lines.push(`| **Median (p50) / p95 Duration** | \`${report.stats.median.toFixed(0)}ms\` / \`${report.stats.p95.toFixed(0)}ms\` | - |`)
    lines.push(`| **Suspicious / Slow Tests** | \`${report.summary.suspiciousCount}\` | \`0\` target |`)
    lines.push(`| **Estimated Avoidable Latency** | \`~${avoidableSec}s\` (${report.summary.estimatedAvoidableMs}ms) | \`0ms\` |`)
    if (report.summary.doctorOverheadPercent !== undefined) {
      lines.push(`| **Doctor Profiler Overhead** | \`${report.summary.doctorOverheadPercent}%\` (${report.summary.doctorDurationMs || 0}ms) | \`<5%\` |`)
    }
    lines.push('')

    // Suspicious Tests Table
    if (report.suspiciousTests && report.suspiciousTests.length > 0) {
      lines.push(`### 🔍 Top Suspicious & Slow Tests (${Math.min(report.suspiciousTests.length, 10)})`)
      lines.push(`| Test | File | Duration | Primary Root Cause | Recommendation |`)
      lines.push(`| :--- | :--- | :--- | :--- | :--- |`)

      const topTests = report.suspiciousTests.slice(0, 10)
      for (const test of topTests) {
        const primaryDiag = test.diagnoses && test.diagnoses[0]
        const causeBadge = primaryDiag ? `\`${primaryDiag.cause}\`` : '`slow`'
        const suggestion = primaryDiag?.suggestion ? primaryDiag.suggestion.replace(/\|/g, '\\|') : '-'
        const relFile = this.config.cwd ? path.relative(this.config.cwd, test.file) : test.file

        lines.push(`| **${test.name.replace(/\|/g, '\\|')}** | \`${relFile}\` | **${test.duration}ms** | ${causeBadge} | ${suggestion} |`)
      }
      lines.push('')
    }

    // Performance Regressions Table
    if (report.regressions && report.regressions.length > 0) {
      lines.push(`### 📈 Performance Regressions (${report.regressions.length})`)
      lines.push(`| Test | File | Baseline | Current | Change |`)
      lines.push(`| :--- | :--- | :--- | :--- | :--- |`)

      for (const reg of report.regressions) {
        const relFile = this.config.cwd ? path.relative(this.config.cwd, reg.file) : reg.file
        lines.push(`| **${reg.name.replace(/\|/g, '\\|')}** | \`${relFile}\` | \`${reg.previousDuration}ms\` | **${reg.currentDuration}ms** | 🔴 **+${reg.percentageChange.toFixed(0)}%** |`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * Writes summary directly to $GITHUB_STEP_SUMMARY if available
   */
  public writeToStepSummary(report: DoctorReport, budgetEvaluation?: BudgetEvaluationResult): boolean {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY
    if (!summaryFile) return false

    try {
      const markdown = this.format(report, budgetEvaluation)
      fs.appendFileSync(summaryFile, `\n${markdown}\n`, 'utf-8')
      return true
    } catch (err) {
      console.warn('[vitest-doctor] Failed to write to GITHUB_STEP_SUMMARY:', err)
      return false
    }
  }
}
