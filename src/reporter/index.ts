import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import type { DoctorConfig, DoctorReport } from '../types/index.js'
import { normalizeConfig } from '../config/schema.js'
import { VitestAdapter, type RawVitestFile } from './adapter.js'
import { ReportCollector } from './collector.js'
import { TerminalFormatter } from '../output/terminal-formatter.js'
import { JsonFormatter } from '../output/json-formatter.js'
import { MarkdownFormatter } from '../output/markdown-formatter.js'
import { HtmlFormatter } from '../output/html-formatter.js'
import { GitHubSummaryFormatter } from '../output/github-summary.js'
import { evaluateBudgets } from '../scoring/budget-evaluator.js'

export class VitestDoctorReporter {
  private config: ReturnType<typeof normalizeConfig>
  private adapter = new VitestAdapter()
  private collector: ReportCollector
  private lastReport: DoctorReport | null = null

  constructor(options: Partial<DoctorConfig> = {}) {
    let mergedOptions = options
    if (process.env.VITEST_DOCTOR_CONFIG) {
      try {
        const envConfig = JSON.parse(process.env.VITEST_DOCTOR_CONFIG)
        mergedOptions = { ...envConfig, ...options }
      } catch {
        // ignore JSON parse errors
      }
    }
    this.config = normalizeConfig(mergedOptions)
    this.collector = new ReportCollector(this.config)
  }

  private isFinished = false

  public onInit(): void {
    this.isFinished = false
  }

  public onTestRunStart(): void {
    this.isFinished = false
  }

  public onCollected(): void {
    // Tests collected hook
  }

  public async onFinished(
    files?: readonly any[],
    _errors?: readonly unknown[],
    _coverage?: unknown,
    _executionTime?: number
  ): Promise<void> {
    if (this.isFinished) return
    this.isFinished = true
    this.processFiles((files || []) as RawVitestFile[])
  }

  public async onTestRunEnd(
    modules?: readonly any[],
    _unhandledErrors?: readonly unknown[],
    _state?: unknown
  ): Promise<void> {
    if (this.isFinished) return
    this.isFinished = true

    const rawFiles: RawVitestFile[] = (modules || []).map((m: any) => {
      if (!m) return {}
      const task = m.task || m
      const diag = typeof m.diagnostic === 'function' ? m.diagnostic() : (m.diagnostic || task.diagnostic)
      const filepath = m.moduleId || m.filepath || task.filepath || task.name
      return {
        ...task,
        filepath,
        name: task.name || filepath,
        diagnostic: diag || {
          setupDuration: task.setupDuration,
          importDurations: task.importDurations,
          collectDuration: task.collectDuration,
          prepareDuration: task.prepareDuration,
          environmentSetupDuration: task.environmentLoad
        }
      }
    })

    this.processFiles(rawFiles)
  }

  private processFiles(files: RawVitestFile[] = []): DoctorReport {
    const { tests, fileDiagnostics } = this.adapter.extractTestsFromFiles(files)
    const report = this.collector.generateReport(tests, fileDiagnostics)
    
    // Evaluate CI performance budgets
    const budgetEvaluation = evaluateBudgets(report, this.config)
    report.budgetEvaluation = budgetEvaluation
    this.lastReport = report

    this.renderOutput(report)

    // In CI mode, fail if budgets or severe regressions are violated
    if (this.config.ci && !budgetEvaluation.passed) {
      console.error(pc.bold(pc.red(`\n[vitest-doctor] ❌ CI Performance Budget Violations (${budgetEvaluation.violations.length}):`)))
      for (const v of budgetEvaluation.violations) {
        console.error(pc.red(`  • [${v.rule}] ${v.message}`))
      }
      console.error('')
      process.exitCode = 1
    }

    return report
  }

  private renderOutput(report: DoctorReport): void {
    const reporters = Array.isArray(this.config.reporter)
      ? this.config.reporter
      : [this.config.reporter || 'terminal']

    const terminalFormatter = new TerminalFormatter(this.config)
    const jsonFormatter = new JsonFormatter()
    const markdownFormatter = new MarkdownFormatter(this.config)
    const htmlFormatter = new HtmlFormatter(this.config)
    const githubSummaryFormatter = new GitHubSummaryFormatter(this.config)

    // Handle stdout reporters
    if (reporters.includes('terminal')) {
      const output = terminalFormatter.format(report)
      console.log(output)
    }

    if (reporters.includes('json') && !this.config.output) {
      console.log(jsonFormatter.format(report))
    }

    if (reporters.includes('markdown') && !this.config.output) {
      console.log(markdownFormatter.format(report))
    }

    if (reporters.includes('html') && !this.config.output) {
      console.log(htmlFormatter.format(report))
    }

    // Write GitHub Actions Step Summary if available
    if (this.config.githubSummary !== false && process.env.GITHUB_STEP_SUMMARY) {
      githubSummaryFormatter.writeToStepSummary(report, report.budgetEvaluation)
    }

    // Handle file output
    if (this.config.output) {
      const outputPath = path.isAbsolute(this.config.output)
        ? this.config.output
        : path.resolve(this.config.cwd, this.config.output)

      const dir = path.dirname(outputPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      if (outputPath.endsWith('.md')) {
        fs.writeFileSync(outputPath, markdownFormatter.format(report), 'utf-8')
      } else if (outputPath.endsWith('.html') || outputPath.endsWith('.htm')) {
        fs.writeFileSync(outputPath, htmlFormatter.format(report), 'utf-8')
      } else {
        fs.writeFileSync(outputPath, jsonFormatter.format(report), 'utf-8')
      }
    }
  }

  public getLastReport(): DoctorReport | null {
    return this.lastReport
  }
}

/**
 * Vitest Reporter factory function
 *
 * Usage in vitest.config.ts:
 * ```ts
 * import { vitestDoctor } from 'vitest-doctor'
 *
 * export default defineConfig({
 *   test: {
 *     reporters: ['default', vitestDoctor({ slow: 500, relative: true })]
 *   }
 * })
 * ```
 */
export function vitestDoctor(options: Partial<DoctorConfig> = {}): VitestDoctorReporter {
  return new VitestDoctorReporter(options)
}

export default VitestDoctorReporter
export * from './adapter.js'
export * from './collector.js'
