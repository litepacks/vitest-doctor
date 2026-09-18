import path from 'node:path'
import type { DoctorConfig, DoctorReport } from '../types/index.js'

export class MarkdownFormatter {
  constructor(private config: DoctorConfig = {}) {}

  public format(report: DoctorReport): string {
    const lines: string[] = []
    const cwd = this.config.cwd || process.cwd()

    lines.push('# 🩺 Vitest Doctor Diagnostic Report')
    lines.push('')
    if (report.git) {
      lines.push(`- **Git Branch:** \`${report.git.branch || 'unknown'}\` (\`${report.git.commitShortHash || report.git.commitHash?.slice(0, 7) || 'HEAD'}\`)`)
      if (report.git.author) lines.push(`- **Commit Author:** ${report.git.author}`)
    }
    lines.push(`- **Total Tests:** ${report.summary.totalTests}`)
    lines.push(`- **Total Duration:** ${(report.summary.totalDuration / 1000).toFixed(2)}s`)
    lines.push(`- **Median Test Duration:** ${report.stats.median.toFixed(1)}ms (p95: ${report.stats.p95.toFixed(1)}ms)`)
    lines.push(`- **Suspicious / Slow Tests:** ${report.summary.suspiciousCount}`)
    if (report.summary.estimatedAvoidableMs > 100) {
      lines.push(`- **Estimated Avoidable Latency:** ~${(report.summary.estimatedAvoidableMs / 1000).toFixed(2)}s`)
    }
    lines.push('')

    if (report.suspiciousTests.length > 0) {
      lines.push('## ⚠️ Suspicious Tests & Root Cause Analysis')
      lines.push('')

      for (const test of report.suspiciousTests) {
        const relFile = path.isAbsolute(test.file) ? path.relative(cwd, test.file) : test.file
        lines.push(`### \`${test.name}\` (${test.duration.toFixed(0)}ms)`)
        lines.push(`*File:* \`${relFile}\``)
        lines.push('')

        if (test.hooks?.beforeEach || test.hooks?.afterEach) {
          lines.push('**Hook Breakdown:**')
          if (test.hooks.beforeEach) lines.push(`- \`beforeEach\`: ${test.hooks.beforeEach.toFixed(0)}ms`)
          if (test.hooks.afterEach) lines.push(`- \`afterEach\`: ${test.hooks.afterEach.toFixed(0)}ms`)
          lines.push('')
        }

        if (test.diagnoses && test.diagnoses.length > 0) {
          lines.push('**Diagnoses:**')
          for (const diag of test.diagnoses) {
            lines.push(`- **[${diag.confidence.toUpperCase()}] ${diag.cause}** (Score: ${(diag.score * 100).toFixed(0)}%)`)
            for (const ev of diag.evidence) {
              lines.push(`  - ${ev}`)
            }
            if (diag.suggestion) {
              lines.push(`  - 💡 *Suggestion:* ${diag.suggestion}`)
            }
          }
          lines.push('')
        }
      }
    }

    if (report.regressions && report.regressions.length > 0) {
      lines.push('## 📉 Performance Regressions')
      lines.push('')
      lines.push('| Test | File | Previous | Current | Change | Commits |')
      lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |')
      for (const reg of report.regressions) {
        const sign = reg.percentageChange > 0 ? '+' : ''
        const commits = (reg.previousGit?.commitShortHash || reg.currentGit?.commitShortHash)
          ? `\`${reg.previousGit?.commitShortHash || 'baseline'}\` ➔ \`${reg.currentGit?.commitShortHash || 'HEAD'}\``
          : '-'
        lines.push(`| ${reg.name} | \`${reg.file}\` | ${reg.previousDuration.toFixed(0)}ms | ${reg.currentDuration.toFixed(0)}ms | **${sign}${reg.percentageChange.toFixed(0)}%** | ${commits} |`)
      }
      lines.push('')
    }

    if (report.advices && report.advices.length > 0) {
      lines.push('## 💡 Vitest Config Optimization Prescriptions')
      lines.push('')
      for (const advice of report.advices) {
        lines.push(`### [${advice.impact.toUpperCase()}] ${advice.title} (\`${advice.estimatedSpeedup}\`)`)
        lines.push(`- **Reason:** ${advice.reason}`)
        lines.push(`- **Prescription:** ${advice.prescription}`)
        lines.push('')
        lines.push('```ts')
        lines.push(advice.configSnippet)
        lines.push('```')
        lines.push('')
      }
    }

    return lines.join('\n')
  }
}
