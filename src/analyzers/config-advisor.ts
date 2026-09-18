import type { ConfigAdvice, DoctorReportSummary, FileDiagnostics, TestProfile } from '../types/index.js'

export class ConfigAdvisor {
  /**
   * Generates actionable vitest.config.ts performance recommendations based on suite metrics
   */
  public generateAdvice(
    tests: TestProfile[],
    files: Record<string, FileDiagnostics> = {},
    summary: DoctorReportSummary
  ): ConfigAdvice[] {
    const advices: ConfigAdvice[] = []

    const fileList = Object.values(files)
    const totalStartupTime = fileList.reduce((acc, f) => acc + (f.setup || 0) + (f.environment || 0) + (f.prepare || 0) + (f.imports || 0), 0)
    const workerOverheadCount = summary.categoryCounts['worker-initialization-overhead'] || 0
    const domLeakCount = summary.categoryCounts['dom-leak-accumulation'] || 0
    const serialAsyncCount = summary.categoryCounts['serial-async-execution'] || 0
    const slowEnvCount = summary.categoryCounts['slow-environment'] || 0

    // Advice 1: Disable VM/Worker Isolation (isolate: false)
    if (workerOverheadCount >= 2 || (tests.length >= 5 && totalStartupTime > summary.totalDuration * 0.45 && domLeakCount === 0)) {
      advices.push({
        id: 'disable-isolation',
        title: 'Disable Worker Context Isolation (isolate: false)',
        impact: 'high',
        estimatedSpeedup: '2x - 4x faster execution',
        reason: `${workerOverheadCount > 0 ? `${workerOverheadCount} test files dominated by VM worker startup.` : 'Over 45% of total suite duration is spent initializing isolated VM contexts.'} Unit tests without global mutable state run significantly faster in shared contexts.`,
        prescription: 'Set poolOptions isolate to false for pure unit tests.',
        configSnippet: `// vitest.config.ts
export default defineConfig({
  test: {
    poolOptions: {
      threads: { isolate: false },
      forks: { isolate: false }
    }
  }
})`
      })
    }

    // Advice 2: Switch default environment to 'node'
    if (slowEnvCount >= 2) {
      advices.push({
        id: 'use-node-environment',
        title: 'Switch Default Test Environment to "node"',
        impact: 'medium',
        estimatedSpeedup: '~200ms - 500ms saved per test file',
        reason: 'Heavy DOM simulation (jsdom/happy-dom) detected in test suites that primarily test backend/unit logic.',
        prescription: 'Set global environment to "node" and use // @vitest-environment jsdom only on UI component test files.',
        configSnippet: `// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node'
    // For DOM tests, add at top of file: // @vitest-environment jsdom
  }
})`
      })
    }

    // Advice 3: Enable Targeted Concurrency for Independent Unit Tests
    if (serialAsyncCount >= 1) {
      advices.push({
        id: 'enable-concurrent',
        title: 'Enable Targeted Concurrency for Independent Unit Tests',
        impact: 'high',
        estimatedSpeedup: '30% - 60% faster async suites',
        reason: `${serialAsyncCount} stateless unit test suite(s) running independent asynchronous tasks sequentially.`,
        prescription:
          'Use describe.concurrent or it.concurrent on stateless, independent unit tests.\n⚠️ CAUTION: Avoid enabling global sequence.concurrent on integration tests, database suites, or tests with sequential state dependencies.',
        configSnippet: `// 1. In your stateless unit test files (Recommended):
describe.concurrent('Stateless Parser Suite', () => {
  it('parses data asynchronously', async () => { /* ... */ })
  it('validates schema asynchronously', async () => { /* ... */ })
})

// 2. Or in vitest.config.ts (scoped strictly to pure unit tests):
export default defineConfig({
  test: {
    // ⚠️ Only enable for pure unit tests without shared DB / disk / server state
    // sequence: { concurrent: true }
  }
})`
      })
    }

    // Advice 4: Single thread execution for small suites
    if (tests.length < 15 && summary.totalDuration > 2500 && workerOverheadCount >= 1) {
      advices.push({
        id: 'single-thread-small-suite',
        title: 'Use Single Thread Pool for Small Suites',
        impact: 'medium',
        estimatedSpeedup: '~1.5s overhead elimination',
        reason: 'For small test suites (<15 tests), multi-process worker spawning adds more coordination latency than actual test execution.',
        prescription: 'Enable singleThread in poolOptions to run all tests sequentially within a single warm worker.',
        configSnippet: `// vitest.config.ts
export default defineConfig({
  test: {
    poolOptions: {
      threads: { singleThread: true }
    }
  }
})`
      })
    }

    return advices
  }
}
