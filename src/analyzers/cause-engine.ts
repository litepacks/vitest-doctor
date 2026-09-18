import type { Diagnosis, DoctorConfig, StaticFinding, TestProfile } from '../types/index.js'
import { StaticAnalyzer } from './static-analyzer.js'

export class CauseEngine {
  private staticAnalyzer = new StaticAnalyzer()

  /**
   * Analyzes a test profile and produces ranked diagnoses
   */
  public diagnose(
    test: TestProfile,
    config: DoctorConfig = {}
  ): Diagnosis[] {
    const diagnoses: Diagnosis[] = []
    const duration = test.duration || 1
    const hooks = test.hooks || {}
    const fileDiag = test.fileDiagnostics || {}
    const signals = test.signals || {}
    const asyncRes = signals.asyncResources
    const memory = signals.memory

    // 1. Static Analysis (if enabled and file exists)
    let staticFindings: StaticFinding[] = test.signals?.staticFindings || []
    if (config.staticAnalysis !== false && test.file && test.file !== 'unknown' && staticFindings.length === 0) {
      staticFindings = this.staticAnalyzer.analyzeFile(test.file)
      test.signals = {
        ...test.signals,
        staticFindings
      }
    }

    // Helper for finding static items
    const findStatic = (type: StaticFinding['type'], namePrefix?: string) =>
      staticFindings.filter(f => f.type === type && (!namePrefix || f.name.includes(namePrefix)))

    // Rule 1: retry
    if (test.retryCount && test.retryCount > 0) {
      diagnoses.push({
        cause: 'retry',
        confidence: 'high',
        score: 0.98,
        evidence: [
          `Test was retried ${test.retryCount} time(s) before completing`,
          `Retries multiplied total test run duration`
        ],
        suggestion: 'Fix flakiness or underlying race condition causing initial execution failure.'
      })
    }

    // Rule 2: slow-before-each
    const beforeEachMs = hooks.beforeEach || 0
    if (beforeEachMs >= 150 || (duration > 60 && beforeEachMs / duration > 0.45)) {
      const pct = Math.round((beforeEachMs / duration) * 100)
      const isHigh = beforeEachMs >= 350 || pct >= 60
      const staticHooks = findStatic('hook', 'beforeEach')
      const evidence = [
        `beforeEach took ${beforeEachMs.toFixed(0)}ms`,
        `${pct}% of total test duration is spent in beforeEach hook`
      ]
      if (staticHooks.length > 0) {
        evidence.push(`beforeEach defined at ${test.file}:${staticHooks[0].line}`)
      }

      diagnoses.push({
        cause: 'slow-before-each',
        confidence: isHigh ? 'high' : 'medium',
        score: Math.min(0.99, 0.7 + (pct / 100) * 0.28),
        evidence,
        suggestion: 'Consider moving immutable or reusable initialization to beforeAll(), or use lightweight lazy fixtures.'
      })
    }

    // Rule 3: slow-before-all
    const beforeAllMs = hooks.beforeAll || 0
    if (beforeAllMs >= 300) {
      const isHigh = beforeAllMs >= 700
      const staticHooks = findStatic('hook', 'beforeAll')
      const evidence = [`beforeAll hook took ${beforeAllMs.toFixed(0)}ms to complete`]
      if (staticHooks.length > 0) {
        evidence.push(`beforeAll defined at ${test.file}:${staticHooks[0].line}`)
      }

      diagnoses.push({
        cause: 'slow-before-all',
        confidence: isHigh ? 'high' : 'medium',
        score: Math.min(0.95, 0.65 + (beforeAllMs / 2000) * 0.3),
        evidence,
        suggestion: 'Consider lazy initialization, database container reuse, or global setup workers.'
      })
    }

    // Rule 4: slow-after-each
    const afterEachMs = hooks.afterEach || 0
    if (afterEachMs >= 150 || (duration > 60 && afterEachMs / duration > 0.45)) {
      const pct = Math.round((afterEachMs / duration) * 100)
      const isHigh = afterEachMs >= 350 || pct >= 60
      const staticHooks = findStatic('hook', 'afterEach')
      const evidence = [
        `afterEach cleanup took ${afterEachMs.toFixed(0)}ms`,
        `${pct}% of test duration is spent in afterEach cleanup`
      ]
      if (staticHooks.length > 0) {
        evidence.push(`afterEach defined at ${test.file}:${staticHooks[0].line}`)
      }

      diagnoses.push({
        cause: 'slow-after-each',
        confidence: isHigh ? 'high' : 'medium',
        score: Math.min(0.98, 0.7 + (pct / 100) * 0.28),
        evidence,
        suggestion: 'Consider lightweight in-memory resets instead of heavy database/state purges in afterEach().'
      })
    }

    // Rule 5: slow-import
    const importMs = fileDiag.imports || 0
    const fileTotal = fileDiag.total || 0
    if (importMs >= 300 || (fileTotal > 200 && importMs / fileTotal > 0.5)) {
      const isHigh = importMs >= 700 || (fileTotal > 200 && importMs / fileTotal > 0.65)
      const staticImports = findStatic('import')
      const evidence = [`Module import duration was ${importMs.toFixed(0)}ms`]
      if (fileTotal > 0) {
        evidence.push(`${Math.round((importMs / fileTotal) * 100)}% of file startup was spent resolving imports`)
      }
      if (staticImports.length > 0) {
        evidence.push(`${staticImports.length} static imports found in test file`)
      }

      diagnoses.push({
        cause: 'slow-import',
        confidence: isHigh ? 'high' : 'medium',
        score: Math.min(0.95, 0.7 + (importMs / 2000) * 0.25),
        evidence,
        suggestion: 'Consider dynamic import(), modular barrel imports, or mocking heavy dependencies.'
      })
    }

    // Rule 6: slow-environment
    const envMs = fileDiag.environment || 0
    if (envMs >= 350) {
      diagnoses.push({
        cause: 'slow-environment',
        confidence: envMs >= 700 ? 'high' : 'medium',
        score: Math.min(0.92, 0.65 + (envMs / 2000) * 0.25),
        evidence: [
          `Test environment initialization took ${envMs.toFixed(0)}ms`,
          'Heavy DOM simulation (jsdom/happy-dom) or custom environment overhead'
        ],
        suggestion: 'Switch to the "node" environment for pure logic/unit tests where DOM APIs are not required.'
      })
    }

    // Rule 7: slow-setup
    const setupMs = fileDiag.setup || 0
    if (setupMs >= 300) {
      diagnoses.push({
        cause: 'slow-setup',
        confidence: setupMs >= 600 ? 'high' : 'medium',
        score: Math.min(0.9, 0.65 + (setupMs / 1500) * 0.25),
        evidence: [`Test setup files took ${setupMs.toFixed(0)}ms before test execution`],
        suggestion: 'Review vitest setupFiles configuration to eliminate redundant global setup.'
      })
    }

    // Deep Profiling Signals Analysis
    const cpuPercent = signals.cpuPercent ?? 0
    const elu = signals.eventLoopUtilization ?? 0
    const eluDelayP99 = signals.eventLoopDelayP99Ms ?? 0
    const timeoutCounts = asyncRes?.createdCounts?.Timeout ?? 0
    const tcpCounts = (asyncRes?.createdCounts?.TCPWRAP ?? 0) + (asyncRes?.createdCounts?.TCPCONNECTWRAP ?? 0) + (asyncRes?.createdCounts?.TLSWRAP ?? 0)
    const fsCounts = (asyncRes?.createdCounts?.FSREQCALLBACK ?? 0) + (asyncRes?.createdCounts?.FSREQPROMISE ?? 0)
    const processCounts = (asyncRes?.createdCounts?.PROCESSWRAP ?? 0) + (asyncRes?.createdCounts?.PIPEWRAP ?? 0)
    const memDelta = memory?.delta ?? test.memory?.delta ?? (signals as any).heapDeltaMb ?? 0

    // Rule 8: polling (multiple timeouts + low CPU + long duration)
    const staticTimers = findStatic('timer')
    const hasWaitFor = staticTimers.some(t => t.name === 'waitFor' || t.name === 'delay' || t.name === 'sleep')
    if ((timeoutCounts >= 4 && cpuPercent < 35 && duration >= 150) || (hasWaitFor && duration >= 200 && cpuPercent < 35)) {
      const evidence = [
        `Possible polling/wait loop detected (${timeoutCounts} timer cycles during ${duration.toFixed(0)}ms)`,
        `Low CPU utilization (${cpuPercent.toFixed(0)}%) during execution`
      ]
      const waitForItem = staticTimers.find(t => t.name === 'waitFor')
      if (waitForItem) {
        evidence.push(`waitFor call detected at ${test.file}:${waitForItem.line}`)
      }

      diagnoses.push({
        cause: 'polling',
        confidence: timeoutCounts >= 8 || (hasWaitFor && timeoutCounts >= 3) ? 'high' : 'medium',
        score: 0.85,
        evidence,
        suggestion: 'Replace polling/waitFor loops with event-driven notification promises or shorter poll intervals.'
      })
    }

    // Rule 9: timer-wait (single or few unmocked timeouts + low CPU)
    else if ((timeoutCounts > 0 && cpuPercent < 25 && duration >= 80) || (staticTimers.length > 0 && !hasWaitFor && duration >= 100 && cpuPercent < 30)) {
      const fakeTimers = findStatic('fake-timer')
      const isUnmocked = fakeTimers.length === 0
      const evidence = [
        `Timeout async resources detected (${timeoutCounts} timeout(s))`,
        `Low CPU utilization (${cpuPercent.toFixed(0)}%) indicates idle timer waiting`
      ]
      if (staticTimers.length > 0) {
        evidence.push(`Timer call '${staticTimers[0].name}' at ${test.file}:${staticTimers[0].line}`)
      }
      if (isUnmocked && staticTimers.length > 0) {
        evidence.push('No vi.useFakeTimers() configuration detected in test file')
      }

      diagnoses.push({
        cause: 'timer-wait',
        confidence: isUnmocked && (timeoutCounts > 0 || staticTimers.length > 0) ? 'high' : 'medium',
        score: 0.88,
        evidence,
        suggestion: 'Use vi.useFakeTimers() and vi.advanceTimersByTime() to instantly advance time without real clock waiting.'
      })
    }

    // Rule 10: cpu-bound
    if ((cpuPercent >= 70 && duration >= 80) || (elu >= 0.75 && duration >= 80)) {
      const isHigh = cpuPercent >= 85 || elu >= 0.85
      diagnoses.push({
        cause: 'cpu-bound',
        confidence: isHigh ? 'high' : 'medium',
        score: Math.min(0.96, 0.7 + (cpuPercent / 100) * 0.25),
        evidence: [
          `High CPU consumption: ${cpuPercent.toFixed(0)}% CPU usage during ${duration.toFixed(0)}ms`,
          `Event loop utilization: ${(elu * 100).toFixed(0)}%`
        ],
        suggestion: 'Optimize computational loops, use smaller mock datasets, or offload heavy calculations to worker threads.'
      })
    }

    // Rule 11: event-loop-blocked
    if (eluDelayP99 >= 50 && duration >= 70) {
      diagnoses.push({
        cause: 'event-loop-blocked',
        confidence: eluDelayP99 >= 100 ? 'high' : 'medium',
        score: Math.min(0.95, 0.7 + (eluDelayP99 / 500) * 0.25),
        evidence: [
          `Event loop p99 delay reached ${eluDelayP99.toFixed(1)}ms`,
          'Synchronous code blocked the Node.js event loop'
        ],
        suggestion: 'Break synchronous long-running operations into asynchronous chunks using setImmediate() or worker threads.'
      })
    }

    // Rule 12: network-io
    const staticNet = findStatic('network')
    if (tcpCounts > 0 || staticNet.length > 0) {
      if (cpuPercent < 40 && duration >= 80) {
        const evidence = [
          `Network socket activity detected (${tcpCounts} TCP/TLS resources)`
        ]
        if (staticNet.length > 0) {
          evidence.push(`Network call '${staticNet[0].name}' found at ${test.file}:${staticNet[0].line}`)
        }
        evidence.push(`Low CPU utilization (${cpuPercent.toFixed(0)}%) during network I/O wait`)

        diagnoses.push({
          cause: 'network-io',
          confidence: tcpCounts > 0 && staticNet.length > 0 ? 'high' : 'medium',
          score: 0.86,
          evidence,
          suggestion: 'Mock HTTP/network requests using msw, vi.fn(), or nock to eliminate real socket latency.'
        })
      }
    }

    // Rule 13: filesystem-io
    const staticIo = findStatic('io')
    if (fsCounts > 0 || staticIo.length > 0) {
      if (cpuPercent < 45 && duration >= 70) {
        const evidence = [
          `Filesystem operations detected (${fsCounts} FS async requests)`
        ]
        if (staticIo.length > 0) {
          evidence.push(`FS call '${staticIo[0].name}' at ${test.file}:${staticIo[0].line}`)
        }

        diagnoses.push({
          cause: 'filesystem-io',
          confidence: fsCounts >= 2 || (staticIo.length > 0 && fsCounts > 0) ? 'high' : 'medium',
          score: 0.84,
          evidence,
          suggestion: 'Use in-memory mock filesystems (e.g. memfs) or lightweight temporary directories.'
        })
      }
    }

    // Rule 14: child-process
    const staticProc = findStatic('child-process')
    if (processCounts > 0 || staticProc.length > 0) {
      const evidence = [
        `Child process activity detected (${processCounts} process/pipe resources)`
      ]
      if (staticProc.length > 0) {
        evidence.push(`Process execution '${staticProc[0].name}' at ${test.file}:${staticProc[0].line}`)
      }

      diagnoses.push({
        cause: 'child-process',
        confidence: 'high',
        score: 0.94,
        evidence,
        suggestion: 'Avoid spawning real operating system child processes during unit tests; mock command outputs.'
      })
    }

    // Rule 15: memory-pressure & gc-pressure
    if (memDelta >= 25) {
      const isHigh = memDelta >= 60
      diagnoses.push({
        cause: 'memory-pressure',
        confidence: isHigh ? 'high' : 'medium',
        score: Math.min(0.9, 0.65 + (memDelta / 200) * 0.25),
        evidence: [
          `Heap memory increased by +${memDelta.toFixed(1)}MB during test execution`
        ],
        suggestion: 'Check for large object allocations, uncollected fixture arrays, or state retention between runs.'
      })
    }

    // Rule 16: serial-async-execution (stateless unit test concurrency)
    const asyncTests = findStatic('async-test')
    const hasConcurrent = findStatic('concurrent').length > 0
    const asyncCount = asyncTests.length || (fileDiag.asyncTestsCount || 0)

    // Stateful / Sequential / Integration safety checks:
    const imports = findStatic('import')
    const hasDbOrOrm =
      imports.some(i => /knex|sqlite|pg|mysql|prisma|typeorm|mongoose|orm|database|supertest/i.test(i.name)) ||
      findStatic('database-call').length > 0 ||
      findStatic('stateful-op').length > 0
    const hasFsMutation = findStatic('io').some(f => /write|unlink|mkdir|remove|rmdir/i.test(f.name))
    const isIntegrationPath = /(?:integration|e2e|db|orm|api|server|crud|system)/i.test(test.file)
    const isStateful = hasDbOrOrm || hasFsMutation || isIntegrationPath

    if (!hasConcurrent && asyncCount >= 3 && duration >= 80 && !isStateful) {
      diagnoses.push({
        cause: 'serial-async-execution',
        confidence: asyncCount >= 4 ? 'high' : 'medium',
        score: 0.91,
        evidence: [
          `${asyncCount} independent stateless async tests are executing sequentially in this file`,
          'No describe.concurrent or test.concurrent declaration found',
          'Tests appear stateless (no database, filesystem mutation, or shared lifecycle state detected)'
        ],
        suggestion: 'Convert suite to describe.concurrent or tests to it.concurrent to execute independent stateless async tests in parallel.'
      })
    }

    // Rule 17: worker-initialization-overhead
    const fileStartup = fileDiag.total || 0
    if (fileStartup >= 300 && (duration < 150 || (fileDiag.totalTestBodyDuration && fileDiag.totalTestBodyDuration < 200 && fileStartup > fileDiag.totalTestBodyDuration * 2))) {
      diagnoses.push({
        cause: 'worker-initialization-overhead',
        confidence: fileStartup >= 600 ? 'high' : 'medium',
        score: 0.89,
        evidence: [
          `File startup & VM worker initialization took ${fileStartup.toFixed(0)}ms while test execution took ${duration.toFixed(0)}ms`,
          'Worker isolation overhead (isolate: true) dominates test runtime'
        ],
        suggestion: 'For pure unit tests without global state mutation, consider setting isolate: false or singleThread: true in poolOptions.'
      })
    }

    // Rule 18: module-reset-churn
    const moduleResets = findStatic('module-reset')
    if (moduleResets.length > 0) {
      diagnoses.push({
        cause: 'module-reset-churn',
        confidence: 'high',
        score: 0.95,
        evidence: [
          `Module reset call '${moduleResets[0].name}' detected at ${test.file}:${moduleResets[0].line}`,
          'Forces Vite/Node to invalidate module cache and re-evaluate import dependencies on every test'
        ],
        suggestion: 'Replace vi.resetModules() with vi.clearAllMocks() or vi.restoreAllMocks(), and limit module resetting only to specific tests.'
      })
    }

    // Rule 19: unused-global-setup
    const setupTime = fileDiag.setup || 0
    const staticImports = findStatic('import')
    if (
      setupTime >= 250 &&
      staticImports.length <= 4 &&
      !staticImports.some(i => i.name.includes('setup') || i.name.includes('test-utils') || i.name.includes('msw') || i.name.includes('db'))
    ) {
      diagnoses.push({
        cause: 'unused-global-setup',
        confidence: setupTime >= 500 ? 'high' : 'medium',
        score: 0.85,
        evidence: [
          `Global setupFiles took ${setupTime.toFixed(0)}ms before executing this file`,
          `Test file contains only ${staticImports.length} lightweight imports and does not use heavy global setup fixtures`
        ],
        suggestion: 'Move heavy global setup files to per-project setupFiles or directory-specific configurations rather than running globally for every test file.'
      })
    }

    // Rule 20: worker-tail-latency
    if (duration >= 800 && (test.isOutlier || duration >= (config.slow ?? 500))) {
      diagnoses.push({
        cause: 'worker-tail-latency',
        confidence: 'medium',
        score: 0.82,
        evidence: [
          `Elevated file execution duration (${duration.toFixed(0)}ms) creates worker thread tail latency at the end of the test run`
        ],
        suggestion: 'Reorder test execution using Longest Processing Time (LPT) scheduling so heavy test files start first on available workers.'
      })
    }

    // Rule 21: dom-leak-accumulation
    const domFindings = findStatic('dom-test')
    const hasCleanup = domFindings.some(d => d.name.includes('cleanup'))
    if (domFindings.length > 0 && (memDelta >= 15 || fileDiag.domElementsRetained)) {
      const evidence = [
        `DOM / UI component rendering detected (${domFindings.map(d => d.name).slice(0, 3).join(', ')})`,
        `Heap memory increased by +${memDelta.toFixed(1)}MB during test execution`
      ]
      if (!hasCleanup) {
        evidence.push('No explicit cleanup() call detected in test file')
      }

      diagnoses.push({
        cause: 'dom-leak-accumulation',
        confidence: !hasCleanup && memDelta >= 25 ? 'high' : 'medium',
        score: 0.90,
        evidence,
        suggestion: 'Call cleanup() or unmount() in afterEach() to prevent detached DOM trees from leaking memory across tests.'
      })
    }

    // Rule 22: oversized-snapshot
    const snapshots = findStatic('snapshot')
    if (snapshots.length > 0 && (duration >= 100 || snapshots.length >= 3)) {
      diagnoses.push({
        cause: 'oversized-snapshot',
        confidence: snapshots.length >= 3 || duration >= 250 ? 'high' : 'medium',
        score: 0.87,
        evidence: [
          `Snapshot assertion '${snapshots[0].name}' found at ${test.file}:${snapshots[0].line} (${snapshots.length} snapshot call(s))`,
          'Snapshot serialization and AST diffing add wall-clock latency'
        ],
        suggestion: 'Assert specific fields using toMatchObject() or expect() assertions rather than serializing large objects to disk snapshots.'
      })
    }

    // Rule 23: resource-contention
    const ioCounts = (asyncRes?.createdCounts?.FSREQCALLBACK || 0) + (asyncRes?.createdCounts?.FSREQPROMISE || 0) + (asyncRes?.createdCounts?.TCPCONNECTWRAP || 0)
    if (ioCounts >= 4 && cpuPercent < 25 && duration >= 200) {
      diagnoses.push({
        cause: 'resource-contention',
        confidence: 'medium',
        score: 0.83,
        evidence: [
          `High async I/O activity (${ioCounts} requests) with low CPU (${cpuPercent.toFixed(0)}%) during parallel run`,
          'Possible filesystem lock contention, SQLite database lock, or socket port competition across workers'
        ],
        suggestion: 'Ensure parallel test workers use isolated temporary directories, randomized ports, or dedicated database schemas.'
      })
    }

    // Rule 24: monotonic-heap-leak
    if (memDelta >= 20 && !findStatic('dom-test').length) {
      diagnoses.push({
        cause: 'monotonic-heap-leak',
        confidence: memDelta >= 50 ? 'high' : 'medium',
        score: Math.min(0.95, 0.7 + (memDelta / 200) * 0.25),
        evidence: [
          `Heap memory increased by +${memDelta.toFixed(1)}MB during test execution without release`,
          'Persistent heap growth indicates retained object graphs or closures across tests'
        ],
        suggestion: 'Ensure test fixtures, singletons, and cached state are released in afterEach().'
      })
    }

    // Rule 25: retained-mock-calls
    const spyFindings = findStatic('spy-mock')
    const mockCalls = signals.mockCallsCount ?? signals.memory?.mockCallsCount ?? 0
    if (mockCalls >= 100 || (spyFindings.length > 0 && memDelta >= 10)) {
      diagnoses.push({
        cause: 'retained-mock-calls',
        confidence: mockCalls >= 500 || spyFindings.length >= 3 ? 'high' : 'medium',
        score: 0.91,
        evidence: [
          `Retained mock call history detected (${mockCalls > 0 ? `${mockCalls} invocations` : `${spyFindings.length} spy/mock(s)`})`,
          'Accumulated arguments in mock.calls arrays prevent garbage collection of call parameters'
        ],
        suggestion: 'Call vi.clearAllMocks() or vi.restoreAllMocks() in afterEach() to release retained mock invocation histories.'
      })
    }

    // Rule 26: unbounded-event-listeners
    const listenersDelta = signals.listenersDelta ?? signals.memory?.listenersDelta ?? 0
    const eventListeners = findStatic('event-listener')
    if (listenersDelta > 0 || (eventListeners.length > 0 && memDelta >= 8)) {
      diagnoses.push({
        cause: 'unbounded-event-listeners',
        confidence: listenersDelta >= 5 ? 'high' : 'medium',
        score: 0.89,
        evidence: [
          `Unbounded event listeners detected (+${listenersDelta > 0 ? listenersDelta : eventListeners.length} active listener(s) retained)`,
          'Listeners attached to emitters or process singletons retain enclosing scopes in memory'
        ],
        suggestion: 'Explicitly remove event listeners with emitter.off() / removeListener() in afterEach() or use AbortSignal.'
      })
    }

    // Rule 27: global-state-pollution
    const globalKeys = signals.globalKeysDelta ?? signals.memory?.globalKeysDelta ?? []
    const globalAssignments = findStatic('global-assignment')
    if (globalKeys.length > 0 || globalAssignments.length > 0) {
      const keysList = globalKeys.length > 0 ? globalKeys.join(', ') : globalAssignments.map(g => g.name).slice(0, 3).join(', ')
      diagnoses.push({
        cause: 'global-state-pollution',
        confidence: 'high',
        score: 0.93,
        evidence: [
          `Global scope pollution detected: [${keysList}] modified on globalThis/window`,
          'Unreverted global properties cause cross-test state leaks and prevent object reclamation'
        ],
        suggestion: 'Revert all global mutations in afterEach() or avoid assigning state to globalThis/window.'
      })
    }

    // Rule 28: large-fixture-retention
    const jsonFixtureImports = staticImports.filter(i => i.name.endsWith('.json') || i.name.includes('fixture') || i.name.includes('mock-data'))
    if ((jsonFixtureImports.length > 0 && memDelta >= 15) || (fileDiag.imports && fileDiag.imports >= 400 && jsonFixtureImports.length > 0)) {
      diagnoses.push({
        cause: 'large-fixture-retention',
        confidence: 'high',
        score: 0.92,
        evidence: [
          `Large fixture import '${jsonFixtureImports[0].name}' retained in module scope`,
          `Heap delta of +${memDelta.toFixed(1)}MB during test suite execution`
        ],
        suggestion: 'Load large JSON fixtures dynamically inside test blocks or read via streams instead of top-level imports.'
      })
    }

    // Rule 29: dangling-async-closure
    const activePromises = asyncRes?.activeCounts?.PROMISE ?? 0
    const activeTimeouts = asyncRes?.activeCounts?.Timeout ?? 0
    if ((activePromises > 0 || activeTimeouts > 0) && duration >= 80) {
      diagnoses.push({
        cause: 'dangling-async-closure',
        confidence: activePromises > 0 ? 'high' : 'medium',
        score: 0.88,
        evidence: [
          `Unresolved async handles at test completion (${activePromises} Promise(s), ${activeTimeouts} Timeout(s))`,
          'Dangling promises preserve their closure context and variables in memory indefinitely'
        ],
        suggestion: 'Ensure all asynchronous promises resolve or reject, and clear all active intervals/timeouts before test ends.'
      })
    }

    // Rule 30: gc-thrashing
    const gcDuration = signals.gcDurationMs ?? signals.memory?.gcDurationMs ?? 0
    const gcCount = signals.gcCount ?? signals.memory?.gcCount ?? 0
    if (gcDuration >= 80 || (duration >= 100 && gcDuration / duration >= 0.20) || gcCount >= 8) {
      diagnoses.push({
        cause: 'gc-thrashing',
        confidence: gcDuration >= 150 || gcCount >= 15 ? 'high' : 'medium',
        score: 0.94,
        evidence: [
          `High Garbage Collection overhead: ${gcDuration.toFixed(0)}ms spent in GC across ${gcCount} cycle(s)`,
          `${Math.round((gcDuration / duration) * 100)}% of test duration was consumed by V8 GC pauses`
        ],
        suggestion: 'Reduce temporary object allocations in hot loops, reuse buffers, and avoid large string concatenations.'
      })
    }

    // Rule 31: heap-space-exhaustion
    const heapRatio = signals.heapUsageRatio ?? (signals.memory?.heapUsedMb && signals.memory?.heapLimitMb ? signals.memory.heapUsedMb / signals.memory.heapLimitMb : 0)
    if (heapRatio >= 0.80) {
      const pct = Math.round(heapRatio * 100)
      diagnoses.push({
        cause: 'heap-space-exhaustion',
        confidence: 'high',
        score: 0.97,
        evidence: [
          `Worker heap memory usage reached ${pct}% of V8 heap limit`,
          'Critical OOM (Out Of Memory) crash risk for this test process'
        ],
        suggestion: 'Increase Node.js max-old-space-size or split heavy suites across multiple worker threads with poolOptions.'
      })
    }

    // Rule 32: barrel-import-churn
    const barrelImports = findStatic('barrel-import')
    const importTime = fileDiag.imports || 0
    if (barrelImports.length > 0 && (importTime >= 150 || (duration >= 100 && importTime >= 80))) {
      const isHigh = importTime >= 400 || barrelImports.length >= 3
      const firstBarrel = barrelImports[0]
      const evidence = [
        `Barrel import '${firstBarrel.name}' detected at ${test.file}:${firstBarrel.line}`,
        `Module resolution & import initialization took ${importTime.toFixed(0)}ms for this file`
      ]
      if (barrelImports.length > 1) {
        evidence.push(`${barrelImports.length} barrel import statements found in test source`)
      }

      diagnoses.push({
        cause: 'barrel-import-churn',
        confidence: isHigh ? 'high' : 'medium',
        score: Math.min(0.96, 0.72 + (importTime / 2000) * 0.24),
        evidence,
        suggestion: `Import directly from specific module paths instead of barrel index (e.g. import { ... } from '${firstBarrel.name}/submodule').`
      })
    }

    // Rule 33: unawaited-promise
    const unawaitedPromises = findStatic('unawaited-promise')
    if (unawaitedPromises.length > 0) {
      const firstUnawaited = unawaitedPromises[0]
      diagnoses.push({
        cause: 'unawaited-promise',
        confidence: 'high',
        score: 0.95,
        evidence: [
          `Unawaited asynchronous matcher call detected at ${test.file}:${firstUnawaited.line}`,
          `Snippet: "${firstUnawaited.snippet || 'expect(...).resolves'}"`,
          'Missing await causes tests to terminate prematurely or trigger unhandled promise rejections'
        ],
        suggestion: 'Add "await" before expect(...).resolves / expect(...).rejects or asynchronous function calls.'
      })
    }

    // Rule 34: unrestored-fake-timers
    const unrestoredTimers = findStatic('unrestored-fake-timers')
    if (unrestoredTimers.length > 0) {
      const firstTimer = unrestoredTimers[0]
      diagnoses.push({
        cause: 'unrestored-fake-timers',
        confidence: 'high',
        score: 0.91,
        evidence: [
          `vi.useFakeTimers() configured at ${test.file}:${firstTimer.line} without matching vi.useRealTimers() cleanup`,
          'Unrestored mock timers bleed into subsequent test executions and stall async coordination'
        ],
        suggestion: 'Add afterEach(() => { vi.useRealTimers() }) to properly restore the system clock.'
      })
    }

    // Rule 35: unknown fallback
    if (diagnoses.length === 0 && (test.isOutlier || duration >= (config.slow ?? 500))) {
      diagnoses.push({
        cause: 'unknown',
        confidence: 'low',
        score: 0.4,
        evidence: [
          `Test duration (${duration.toFixed(0)}ms) is elevated without a single dominant cause identified`,
          'Execution may be affected by system load or unprofiled async coordination'
        ],
        suggestion: 'Enable deep profiling (profile: "always") to capture low-level event loop and async resource traces.'
      })
    }

    // Sort by score descending
    diagnoses.sort((a, b) => b.score - a.score)
    return diagnoses
  }
}
