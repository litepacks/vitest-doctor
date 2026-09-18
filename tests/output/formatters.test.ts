import { describe, it, expect } from 'vitest'
import { TerminalFormatter } from '../../src/output/terminal-formatter.js'
import { JsonFormatter } from '../../src/output/json-formatter.js'
import { MarkdownFormatter } from '../../src/output/markdown-formatter.js'
import { HtmlFormatter } from '../../src/output/html-formatter.js'
import type { DoctorReport } from '../../src/types/index.js'

describe('Output Formatters', () => {
  const mockReport: DoctorReport = {
    version: '0.1.0',
    timestamp: '2026-09-16T12:00:00.000Z',
    stats: {
      count: 10,
      totalDuration: 5400,
      mean: 540,
      median: 250,
      min: 10,
      max: 1800,
      p50: 250,
      p75: 600,
      p90: 1200,
      p95: 1500,
      p99: 1800,
      mad: 150,
      stdDev: 400
    },
    tests: [],
    suspiciousTests: [
      {
        id: '1',
        name: 'heavy user creation',
        file: 'tests/users.test.ts',
        duration: 850,
        hooks: {
          beforeEach: 550,
          afterEach: 40
        },
        diagnoses: [
          {
            cause: 'slow-before-each',
            confidence: 'high',
            score: 0.95,
            evidence: ['beforeEach took 550ms', '65% of test duration in beforeEach'],
            suggestion: 'Move reusable setup to beforeAll().'
          }
        ]
      }
    ],
    files: {
      'tests/users.test.ts': {
        imports: 650,
        environment: 100,
        setup: 50,
        total: 800,
        slowImports: [{ name: 'heavy-dep', duration: 450 }]
      }
    },
    summary: {
      totalTests: 10,
      totalDuration: 5400,
      suspiciousCount: 1,
      categoryCounts: {
        'slow-before-each': 1,
        'slow-before-all': 0,
        'slow-after-each': 0,
        'slow-import': 1,
        'slow-environment': 0,
        'slow-setup': 0,
        'cpu-bound': 0,
        'event-loop-blocked': 0,
        'timer-wait': 0,
        'network-io': 0,
        'filesystem-io': 0,
        'child-process': 0,
        'memory-pressure': 0,
        'gc-pressure': 0,
        'polling': 0,
        'retry': 0,
        'serial-async-execution': 0,
        'worker-initialization-overhead': 0,
        'module-reset-churn': 0,
        'unused-global-setup': 0,
        'worker-tail-latency': 0,
        'dom-leak-accumulation': 0,
        'oversized-snapshot': 0,
        'resource-contention': 0,
        'unknown': 0
      },
      estimatedAvoidableMs: 800
    }
  }

  const stripAnsi = (str: string) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')

  it('formats terminal output with rich structure', () => {
    const formatter = new TerminalFormatter()
    const output = stripAnsi(formatter.format(mockReport))

    expect(output).toContain('Vitest Doctor')
    expect(output).toContain('10 tests analyzed')
    expect(output).toContain('heavy user creation')
    expect(output).toContain('beforeEach')
    expect(output).toContain('HIGH')
    expect(output).toContain('Suggestion:')
    expect(output).toContain('Potential issues')
  })

  it('formats JSON output with valid schema', () => {
    const formatter = new JsonFormatter()
    const jsonStr = formatter.format(mockReport)
    const parsed = JSON.parse(jsonStr)

    expect(parsed.version).toBe('0.1.0')
    expect(parsed.summary.totalTests).toBe(10)
    expect(parsed.suspiciousTests[0].diagnoses[0].cause).toBe('slow-before-each')
  })

  it('formats Markdown output', () => {
    const formatter = new MarkdownFormatter()
    const md = formatter.format(mockReport)

    expect(md).toContain('# 🩺 Vitest Doctor Diagnostic Report')
    expect(md).toContain('heavy user creation')
    expect(md).toContain('[HIGH] slow-before-each')
  })

  it('formats HTML output with 100% offline self-contained styles and Waterfall timeline', () => {
    const formatter = new HtmlFormatter()
    const html = formatter.format(mockReport)

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).not.toContain('https://unpkg.com')
    expect(html).toContain('Vitest Doctor')
    expect(html).toContain('heavy user creation')
    expect(html).toContain('HIGH Severity')
    expect(html).toContain('Slow Before Each')
    expect(html).toContain('Waterfall Timeline')
    expect(html).toContain('downloadJsonReport')
  })

  it('renders Config Advisor prescriptions across terminal, markdown, and html formatters', () => {
    const reportWithAdvice: DoctorReport = {
      ...mockReport,
      advices: [
        {
          id: 'disable-isolation',
          title: 'Disable Worker Context Isolation (isolate: false)',
          impact: 'high',
          estimatedSpeedup: '2x - 4x faster execution',
          reason: 'Unit tests without global state mutation run faster.',
          prescription: 'Set poolOptions isolate to false.',
          configSnippet: 'threads: { isolate: false }'
        }
      ]
    }

    const termOut = stripAnsi(new TerminalFormatter().format(reportWithAdvice))
    expect(termOut).toContain('Vitest Config Optimization Advisor')
    expect(termOut).toContain('Disable Worker Context Isolation')
    expect(termOut).toContain('isolate: false')

    const mdOut = new MarkdownFormatter().format(reportWithAdvice)
    expect(mdOut).toContain('## 💡 Vitest Config Optimization Prescriptions')
    expect(mdOut).toContain('[HIGH] Disable Worker Context Isolation')
    expect(mdOut).toContain('threads: { isolate: false }')

    const htmlOut = new HtmlFormatter().format(reportWithAdvice)
    expect(htmlOut).toContain('Vitest Config Optimization Advisor')
    expect(htmlOut).toContain('Disable Worker Context Isolation')
    expect(htmlOut).toContain('1 Prescription')
  })

  it('renders Git context metadata across formatters', () => {
    const reportWithGit: DoctorReport = {
      ...mockReport,
      git: {
        branch: 'feature/fast-runner',
        commitHash: '1234567890abcdef1234567890abcdef12345678',
        commitShortHash: '1234567',
        author: 'Vitest Author'
      }
    }

    const termOut = stripAnsi(new TerminalFormatter().format(reportWithGit))
    expect(termOut).toContain('feature/fast-runner@1234567')

    const mdOut = new MarkdownFormatter().format(reportWithGit)
    expect(mdOut).toContain('**Git Branch:** `feature/fast-runner` (`1234567`)')
    expect(mdOut).toContain('**Commit Author:** Vitest Author')

    const htmlOut = new HtmlFormatter().format(reportWithGit)
    expect(htmlOut).toContain('feature/fast-runner@1234567')
  })
})
