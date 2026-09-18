import path from 'node:path'
import pc from 'picocolors'
import type { DoctorConfig, DoctorReport, SlowCause, TestProfile } from '../types/index.js'

export class TerminalFormatter {
  constructor(private config: DoctorConfig = {}) {}

  public format(report: DoctorReport): string {
    const lines: string[] = []
    const divider = pc.dim('─'.repeat(50))
    const cwd = this.config.cwd || process.cwd()

    // Title
    lines.push('')
    lines.push(pc.bold(pc.cyan('Vitest Doctor')))
    lines.push(divider)

    // Suite Overview
    const totalSec = (report.summary.totalDuration / 1000).toFixed(1)
    const gitInfo = report.git?.branch ? ` ${pc.dim(`(${report.git.branch}@${report.git.commitShortHash || report.git.commitHash?.slice(0, 7)})`)}` : ''
    lines.push(`${pc.bold(report.summary.totalTests.toString())} tests analyzed${gitInfo}`)
    lines.push(`${pc.dim(`${totalSec}s total`)}`)
    lines.push('')

    // Quick summary highlights
    const suspiciousCount = report.summary.suspiciousCount
    const catCounts = report.summary.categoryCounts || ({} as Record<SlowCause, number>)
    if (suspiciousCount > 0) {
      lines.push(pc.yellow(`• ${suspiciousCount} suspicious / slow test${suspiciousCount === 1 ? '' : 's'}`))
    }

    if (catCounts['barrel-import-churn'] > 0) lines.push(pc.yellow(`• ${catCounts['barrel-import-churn']} barrel import churn bottleneck(s)`))
    if (catCounts['unawaited-promise'] > 0) lines.push(pc.red(`• ${catCounts['unawaited-promise']} unawaited async matcher / promise(s)`))
    if (catCounts['unrestored-fake-timers'] > 0) lines.push(pc.red(`• ${catCounts['unrestored-fake-timers']} unrestored fake timers leak(s)`))
    if (catCounts['serial-async-execution'] > 0) lines.push(pc.cyan(`• ${catCounts['serial-async-execution']} serial async suite(s) (concurrency opportunity)`))
    if (catCounts['worker-initialization-overhead'] > 0) lines.push(pc.dim(`• ${catCounts['worker-initialization-overhead']} worker context / isolate overhead(s)`))
    if (catCounts['module-reset-churn'] > 0) lines.push(pc.dim(`• ${catCounts['module-reset-churn']} module reset churn(s)`))
    if (catCounts['unused-global-setup'] > 0) lines.push(pc.dim(`• ${catCounts['unused-global-setup']} unused global setup bottleneck(s)`))
    if (catCounts['worker-tail-latency'] > 0) lines.push(pc.dim(`• ${catCounts['worker-tail-latency']} worker tail latency hotspot(s)`))
    if (catCounts['dom-leak-accumulation'] > 0) lines.push(pc.red(`• ${catCounts['dom-leak-accumulation']} DOM / component memory leak(s)`))
    if (catCounts['monotonic-heap-leak'] > 0) lines.push(pc.red(`• ${catCounts['monotonic-heap-leak']} monotonic heap memory leak(s)`))
    if (catCounts['retained-mock-calls'] > 0) lines.push(pc.yellow(`• ${catCounts['retained-mock-calls']} retained spy/mock call history leak(s)`))
    if (catCounts['unbounded-event-listeners'] > 0) lines.push(pc.yellow(`• ${catCounts['unbounded-event-listeners']} unbounded event listener leak(s)`))
    if (catCounts['global-state-pollution'] > 0) lines.push(pc.red(`• ${catCounts['global-state-pollution']} globalThis/window state pollution(s)`))
    if (catCounts['large-fixture-retention'] > 0) lines.push(pc.dim(`• ${catCounts['large-fixture-retention']} large fixture in-memory retention(s)`))
    if (catCounts['dangling-async-closure'] > 0) lines.push(pc.dim(`• ${catCounts['dangling-async-closure']} dangling promise / async closure leak(s)`))
    if (catCounts['gc-thrashing'] > 0) lines.push(pc.yellow(`• ${catCounts['gc-thrashing']} Garbage Collection pause thrashing(s)`))
    if (catCounts['heap-space-exhaustion'] > 0) lines.push(pc.bgRed(pc.white(`• ${catCounts['heap-space-exhaustion']} V8 heap exhaustion / OOM danger(s)`)))
    if (catCounts['oversized-snapshot'] > 0) lines.push(pc.dim(`• ${catCounts['oversized-snapshot']} oversized snapshot bottleneck(s)`))
    if (catCounts['resource-contention'] > 0) lines.push(pc.dim(`• ${catCounts['resource-contention']} resource / lock contention(s)`))
    if (catCounts['slow-import'] > 0) lines.push(pc.dim(`• ${catCounts['slow-import']} slow import bottleneck(s)`))
    if (catCounts['slow-before-each'] > 0 || catCounts['slow-after-each'] > 0 || catCounts['slow-before-all'] > 0) {
      const hookTotal = (catCounts['slow-before-each'] || 0) + (catCounts['slow-after-each'] || 0) + (catCounts['slow-before-all'] || 0)
      lines.push(pc.dim(`• ${hookTotal} expensive hook(s)`))
    }
    if (catCounts['cpu-bound'] > 0) lines.push(pc.dim(`• ${catCounts['cpu-bound']} CPU-heavy test(s)`))
    if (catCounts['timer-wait'] > 0) lines.push(pc.dim(`• ${catCounts['timer-wait']} unmocked timer wait(s)`))
    if (catCounts['polling'] > 0) lines.push(pc.dim(`• ${catCounts['polling']} polling / waitFor delay(s)`))
    if (catCounts['network-io'] > 0) lines.push(pc.dim(`• ${catCounts['network-io']} network socket dependency(ies)`))
    if (catCounts['filesystem-io'] > 0) lines.push(pc.dim(`• ${catCounts['filesystem-io']} filesystem I/O bottleneck(s)`))

    lines.push('')

    // Group suspicious tests by file
    const testsByFile = new Map<string, TestProfile[]>()
    for (const test of report.suspiciousTests) {
      const relFile = path.isAbsolute(test.file) ? path.relative(cwd, test.file) : test.file
      const list = testsByFile.get(relFile) || []
      list.push(test)
      testsByFile.set(relFile, list)
    }

    // Print File Diagnostics & Suspicious Tests
    for (const [relFile, tests] of testsByFile.entries()) {
      lines.push(pc.bold(pc.white(relFile)))
      lines.push(divider)

      // File startup breakdown (if available)
      const fileDiag = report.files[relFile] || tests[0]?.fileDiagnostics
      if (fileDiag && (fileDiag.total || 0) > 200) {
        lines.push(pc.dim('File startup:'))
        if (fileDiag.imports) lines.push(`  ${pc.dim('imports')}               ${pc.yellow(this.formatDuration(fileDiag.imports))}`)
        if (fileDiag.environment) lines.push(`  ${pc.dim('environment')}           ${pc.yellow(this.formatDuration(fileDiag.environment))}`)
        if (fileDiag.setup) lines.push(`  ${pc.dim('setup')}                 ${pc.yellow(this.formatDuration(fileDiag.setup))}`)
        if (fileDiag.total) lines.push(`  ${pc.dim('tests')}                 ${this.formatDuration(fileDiag.total)}`)
        lines.push('')
      }

      // Slow tests in file
      for (const test of tests) {
        const durStr = this.formatDuration(test.duration)
        const namePadding = Math.max(2, 50 - test.name.length - durStr.length)
        lines.push(`${test.name}${' '.repeat(namePadding)}${pc.bold(durStr)}`)

        // Hooks breakdown
        if (test.hooks) {
          lines.push('')
          if (test.hooks.beforeEach) lines.push(`  ${pc.dim('beforeEach')}             ${pc.yellow(this.formatDuration(test.hooks.beforeEach))}`)
          const bodyDuration = test.duration - ((test.hooks.beforeEach || 0) + (test.hooks.afterEach || 0))
          if (bodyDuration > 0) lines.push(`  ${pc.dim('test body')}              ${this.formatDuration(bodyDuration)}`)
          if (test.hooks.afterEach) lines.push(`  ${pc.dim('afterEach')}              ${pc.yellow(this.formatDuration(test.hooks.afterEach))}`)
        }

        // Primary Diagnoses
        if (test.diagnoses && test.diagnoses.length > 0) {
          lines.push('')
          for (const diag of test.diagnoses) {
            const badge = this.formatConfidenceBadge(diag.confidence)
            const title = this.formatCauseTitle(diag.cause)
            lines.push(`  ${badge}  ${pc.bold(title)}`)

            if (diag.evidence.length > 0) {
              lines.push(pc.dim('  Evidence:'))
              for (const ev of diag.evidence) {
                lines.push(`    • ${ev}`)
              }
            }

            if (diag.suggestion) {
              lines.push(pc.dim('  Suggestion:'))
              lines.push(`    ${diag.suggestion}`)
            }
            lines.push('')
          }
        }

        lines.push('')
      }
    }

    // Regressions (if any)
    if (report.regressions && report.regressions.length > 0) {
      lines.push(pc.bold(pc.red('Performance Regressions')))
      lines.push(divider)
      for (const reg of report.regressions) {
        lines.push(`${pc.bold(reg.name)} ${pc.dim(`(${reg.file})`)}`)
        lines.push(`  previous:   ${this.formatDuration(reg.previousDuration)}`)
        lines.push(`  current:    ${this.formatDuration(reg.currentDuration)}`)
        const sign = reg.percentageChange > 0 ? '+' : ''
        lines.push(`  change:     ${pc.red(pc.bold(`${sign}${reg.percentageChange.toFixed(0)}%`))}`)
        if (reg.previousGit?.commitShortHash || reg.currentGit?.commitShortHash) {
          const from = reg.previousGit?.commitShortHash || 'baseline'
          const to = reg.currentGit?.commitShortHash || 'HEAD'
          lines.push(`  commits:    ${pc.dim(`${from} ➔ ${to}`)}`)
        }
        if (reg.isNewSlowTest) {
          lines.push(`  ${pc.bgRed(pc.white(' NEW SLOW TEST '))}`)
        }
        lines.push('')
      }
    }

    // Config Advisor Prescriptions
    if (report.advices && report.advices.length > 0) {
      lines.push(pc.bold(pc.magenta('💡 Vitest Config Optimization Advisor')))
      lines.push(divider)
      for (const advice of report.advices) {
        const badge = advice.impact === 'high' ? pc.bgMagenta(pc.white(' HIGH IMPACT ')) : pc.bgCyan(pc.black(' MEDIUM IMPACT '))
        lines.push(`${badge} ${pc.bold(advice.title)} ${pc.green(`(${advice.estimatedSpeedup})`)}`)
        lines.push(`  ${pc.dim('Reason:')}       ${advice.reason}`)
        lines.push(`  ${pc.dim('Prescription:')} ${advice.prescription}`)
        lines.push(`  ${pc.dim('Suggested config:')}`)
        advice.configSnippet.split('\n').forEach(line => {
          lines.push(`    ${pc.cyan(line)}`)
        })
        lines.push('')
      }
    }

    // Bottom Summary
    lines.push(pc.bold('Potential issues'))
    lines.push(divider)
    if (suspiciousCount > 0) lines.push(`${suspiciousCount} slow / suspicious test${suspiciousCount === 1 ? '' : 's'}`)
    if (catCounts['barrel-import-churn'] > 0) lines.push(`${catCounts['barrel-import-churn']} barrel import churn bottlenecks`)
    if (catCounts['unawaited-promise'] > 0) lines.push(`${catCounts['unawaited-promise']} unawaited async matchers / promises`)
    if (catCounts['unrestored-fake-timers'] > 0) lines.push(`${catCounts['unrestored-fake-timers']} unrestored fake timers leaks`)
    if (catCounts['serial-async-execution'] > 0) lines.push(`${catCounts['serial-async-execution']} serial async suites (concurrency opportunity)`)
    if (catCounts['worker-initialization-overhead'] > 0) lines.push(`${catCounts['worker-initialization-overhead']} worker initialization overheads`)
    if (catCounts['module-reset-churn'] > 0) lines.push(`${catCounts['module-reset-churn']} module reset churns`)
    if (catCounts['unused-global-setup'] > 0) lines.push(`${catCounts['unused-global-setup']} unused global setups`)
    if (catCounts['worker-tail-latency'] > 0) lines.push(`${catCounts['worker-tail-latency']} worker tail latency hotspots`)
    if (catCounts['dom-leak-accumulation'] > 0) lines.push(`${catCounts['dom-leak-accumulation']} DOM / component memory leaks`)
    if (catCounts['monotonic-heap-leak'] > 0) lines.push(`${catCounts['monotonic-heap-leak']} monotonic heap memory leaks`)
    if (catCounts['retained-mock-calls'] > 0) lines.push(`${catCounts['retained-mock-calls']} retained mock call history leaks`)
    if (catCounts['unbounded-event-listeners'] > 0) lines.push(`${catCounts['unbounded-event-listeners']} unbounded event listener leaks`)
    if (catCounts['global-state-pollution'] > 0) lines.push(`${catCounts['global-state-pollution']} global scope state pollutions`)
    if (catCounts['large-fixture-retention'] > 0) lines.push(`${catCounts['large-fixture-retention']} large fixture in-memory retentions`)
    if (catCounts['dangling-async-closure'] > 0) lines.push(`${catCounts['dangling-async-closure']} dangling async closures / promises`)
    if (catCounts['gc-thrashing'] > 0) lines.push(`${catCounts['gc-thrashing']} Garbage Collection pause thrashings`)
    if (catCounts['heap-space-exhaustion'] > 0) lines.push(`${catCounts['heap-space-exhaustion']} V8 heap space exhaustions / OOM risks`)
    if (catCounts['oversized-snapshot'] > 0) lines.push(`${catCounts['oversized-snapshot']} oversized snapshots`)
    if (catCounts['resource-contention'] > 0) lines.push(`${catCounts['resource-contention']} resource / lock contentions`)
    if (catCounts['slow-import'] > 0) lines.push(`${catCounts['slow-import']} slow imports`)
    if (catCounts['slow-before-each'] > 0) lines.push(`${catCounts['slow-before-each']} expensive beforeEach hooks`)
    if (catCounts['slow-after-each'] > 0) lines.push(`${catCounts['slow-after-each']} expensive afterEach hooks`)
    if (catCounts['slow-before-all'] > 0) lines.push(`${catCounts['slow-before-all']} slow beforeAll hooks`)
    if (catCounts['cpu-bound'] > 0) lines.push(`${catCounts['cpu-bound']} CPU-bound tests`)
    if (catCounts['timer-wait'] > 0) lines.push(`${catCounts['timer-wait']} timer waits`)
    if (catCounts['polling'] > 0) lines.push(`${catCounts['polling']} polling / waitFor loops`)
    if (catCounts['network-io'] > 0) lines.push(`${catCounts['network-io']} network dependencies`)
    if (catCounts['filesystem-io'] > 0) lines.push(`${catCounts['filesystem-io']} filesystem I/O waits`)
    if (catCounts['child-process'] > 0) lines.push(`${catCounts['child-process']} child process spawns`)

    if (report.summary.estimatedAvoidableMs > 100) {
      const avoidableSec = (report.summary.estimatedAvoidableMs / 1000).toFixed(1)
      lines.push('')
      lines.push(pc.green(pc.bold(`Estimated avoidable time: ~${avoidableSec}s`)))
    }

    if (this.config.showOverhead && report.summary.doctorOverheadPercent !== undefined) {
      lines.push('')
      lines.push(pc.dim(`doctor profiler overhead: ${report.summary.doctorOverheadPercent.toFixed(1)}%`))
    }

    lines.push('')
    return lines.join('\n')
  }

  private formatDuration(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`
    }
    return `${Math.round(ms)}ms`
  }

  private formatConfidenceBadge(confidence: 'low' | 'medium' | 'high'): string {
    switch (confidence) {
      case 'high':
        return pc.bgRed(pc.black(' HIGH '))
      case 'medium':
        return pc.bgYellow(pc.black(' MEDIUM '))
      case 'low':
        return pc.bgBlue(pc.white(' LOW '))
    }
  }

  private formatCauseTitle(cause: SlowCause): string {
    switch (cause) {
      case 'slow-before-each': return 'expensive beforeEach hook'
      case 'slow-before-all': return 'slow beforeAll suite setup'
      case 'slow-after-each': return 'expensive afterEach cleanup'
      case 'slow-import': return 'heavy dependency imports'
      case 'slow-environment': return 'slow test environment initialization'
      case 'slow-setup': return 'slow global setup files'
      case 'cpu-bound': return 'CPU-bound computational bottleneck'
      case 'event-loop-blocked': return 'Node.js event loop blocked'
      case 'timer-wait': return 'unmocked timer / sleep delay'
      case 'network-io': return 'unmocked network socket I/O'
      case 'filesystem-io': return 'synchronous / heavy filesystem I/O'
      case 'child-process': return 'operating system child process spawn'
      case 'memory-pressure': return 'heavy memory allocation / heap surge'
      case 'gc-pressure': return 'Garbage Collection pause pressure'
      case 'polling': return 'asynchronous polling / waitFor loop'
      case 'retry': return 'flaky test retried multiple times'
      case 'serial-async-execution': return 'serial async execution (concurrency opportunity)'
      case 'worker-initialization-overhead': return 'worker context / isolate:true overhead'
      case 'module-reset-churn': return 'vi.resetModules() module cache churn'
      case 'unused-global-setup': return 'unused heavy global setup files'
      case 'worker-tail-latency': return 'worker thread tail latency hotspot'
      case 'dom-leak-accumulation': return 'DOM / UI component memory leak'
      case 'oversized-snapshot': return 'oversized snapshot serialization / diffing'
      case 'resource-contention': return 'parallel worker resource / lock contention'
      case 'monotonic-heap-leak': return 'monotonic heap memory leak'
      case 'retained-mock-calls': return 'retained spy/mock call history accumulation'
      case 'unbounded-event-listeners': return 'unbounded event listener leak'
      case 'global-state-pollution': return 'globalThis/window scope state pollution'
      case 'large-fixture-retention': return 'large fixture in-memory retention'
      case 'dangling-async-closure': return 'dangling unresolved async closure'
      case 'gc-thrashing': return 'Garbage Collection stop-the-world thrashing'
      case 'heap-space-exhaustion': return 'V8 heap space exhaustion (OOM danger)'
      case 'barrel-import-churn': return 'barrel file import churn'
      case 'unawaited-promise': return 'unawaited async matcher / promise'
      case 'unrestored-fake-timers': return 'unrestored fake timers leak'
      case 'unknown': return 'unclassified latency anomaly'
    }
  }
}
