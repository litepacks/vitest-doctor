/**
 * Core type definitions for vitest-doctor
 */

export type SlowCause =
  | 'slow-before-each'
  | 'slow-before-all'
  | 'slow-after-each'
  | 'slow-import'
  | 'slow-environment'
  | 'slow-setup'
  | 'cpu-bound'
  | 'event-loop-blocked'
  | 'timer-wait'
  | 'network-io'
  | 'filesystem-io'
  | 'child-process'
  | 'memory-pressure'
  | 'gc-pressure'
  | 'polling'
  | 'retry'
  | 'serial-async-execution'
  | 'worker-initialization-overhead'
  | 'module-reset-churn'
  | 'unused-global-setup'
  | 'worker-tail-latency'
  | 'dom-leak-accumulation'
  | 'oversized-snapshot'
  | 'resource-contention'
  | 'monotonic-heap-leak'
  | 'retained-mock-calls'
  | 'unbounded-event-listeners'
  | 'global-state-pollution'
  | 'large-fixture-retention'
  | 'dangling-async-closure'
  | 'gc-thrashing'
  | 'heap-space-exhaustion'
  | 'barrel-import-churn'
  | 'unawaited-promise'
  | 'unrestored-fake-timers'
  | 'unknown'

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export type ProfileMode = 'auto' | 'always' | 'off'

export type OutputFormat = 'terminal' | 'json' | 'markdown' | 'html'

export interface HookDurations {
  beforeAll?: number
  beforeEach?: number
  afterEach?: number
  afterAll?: number
}

export interface SlowImportInfo {
  name: string
  duration: number
}

export interface FileDiagnostics {
  collect?: number
  setup?: number
  environment?: number
  imports?: number
  prepare?: number
  total?: number
  slowImports?: SlowImportInfo[]
  startTime?: number
  endTime?: number
  testsCount?: number
  asyncTestsCount?: number
  totalTestBodyDuration?: number
  domElementsRetained?: boolean
}

export interface MemoryProfile {
  before?: number
  after?: number
  delta?: number
  peak?: number
  heapLimitMb?: number
  heapUsedMb?: number
  gcDurationMs?: number
  gcCount?: number
  globalKeysDelta?: string[]
  listenersDelta?: number
  mockCallsCount?: number
}

export interface AsyncResourceStats {
  createdCounts: Record<string, number>
  activeCounts: Record<string, number>
  destroyedCounts: Record<string, number>
  maxDurations: Record<string, number>
}

export interface StaticFinding {
  type:
    | 'hook'
    | 'timer'
    | 'io'
    | 'network'
    | 'child-process'
    | 'import'
    | 'fake-timer'
    | 'module-reset'
    | 'snapshot'
    | 'concurrent'
    | 'async-test'
    | 'dom-test'
    | 'spy-mock'
    | 'event-listener'
    | 'global-assignment'
    | 'barrel-import'
    | 'unawaited-promise'
    | 'unrestored-fake-timers'
    | 'database-call'
    | 'stateful-op'
  name: string
  file: string
  line: number
  column: number
  snippet?: string
}

export interface RuntimeSignals {
  cpuUserMs?: number
  cpuSystemMs?: number
  cpuPercent?: number
  eventLoopUtilization?: number
  eventLoopDelayP99Ms?: number
  eventLoopDelayMeanMs?: number
  asyncResources?: AsyncResourceStats
  memory?: MemoryProfile
  staticFindings?: StaticFinding[]
  gcDurationMs?: number
  gcCount?: number
  globalKeysDelta?: string[]
  listenersDelta?: number
  mockCallsCount?: number
  heapUsageRatio?: number
}

export interface Diagnosis {
  cause: SlowCause
  confidence: ConfidenceLevel
  score: number
  evidence: string[]
  suggestion?: string
}

export interface TestProfile {
  id: string
  name: string
  file: string
  suitePath?: string[]
  duration: number
  state?: 'passed' | 'failed' | 'skipped' | 'todo'
  hooks?: HookDurations
  fileDiagnostics?: FileDiagnostics
  retryCount?: number
  memory?: MemoryProfile
  signals?: RuntimeSignals
  isOutlier?: boolean
  outlierReasons?: string[]
  relativeMultiplier?: number
  madScore?: number
  diagnoses?: Diagnosis[]
}

export interface PerformanceBudgets {
  /** Maximum allowable total test suite duration in ms (alias: maxSuiteDuration) */
  maxTotalDurationMs?: number
  maxSuiteDuration?: number
  /** Maximum number of allowed slow tests */
  maxSlowTests?: number
  /** Maximum allowed duration for a single test in ms */
  maxTestDuration?: number
  /** Maximum number of allowed suspicious tests */
  maxSuspiciousTests?: number
  /** Maximum allowed regression percentage before failing CI (e.g. 30 for +30% or 0.3 for +30%) */
  failOnRegressionPercent?: number
  /** Maximum allowed regressions count (alias: failOnRegressionPercent) */
  maxRegressions?: number
  /** Maximum allowed p95 duration in ms (alias: maxP95Duration) */
  failOnP95Ms?: number
  maxP95Duration?: number
}

export interface BudgetViolation {
  rule: keyof PerformanceBudgets | 'regression'
  expected: number | string
  actual: number | string
  message: string
}

export interface BudgetEvaluationResult {
  passed: boolean
  violations: BudgetViolation[]
}

export interface DoctorConfig {
  /** Absolute threshold in ms for slow test classification (default: 500) */
  slow?: number
  /** Absolute threshold in ms for very slow test classification (default: 1500) */
  verySlow?: number
  /** Whether to enable relative anomaly detection based on distribution (default: true) */
  relative?: boolean
  /** Relative multiplier vs median for flagging suspicious tests (default: 5) */
  medianMultiplier?: number
  /** Modified Z-score MAD multiplier for anomaly detection (default: 3.5) */
  madMultiplier?: number
  /** Maximum number of top slow tests to highlight in output (default: 20) */
  top?: number
  /** Deep profiling mode: 'auto' runs fast then profiles suspicious, 'always' profiles all, 'off' disables (default: 'auto') */
  profile?: ProfileMode
  /** Track test performance history across runs (default: true) */
  history?: boolean
  /** Path to local history JSON file (default: '.vitest-doctor/history.json') */
  historyPath?: string
  /** Path to baseline snapshot JSON file (default: '.vitest-doctor/baseline.json') */
  baselinePath?: string
  /** Regression percentage threshold (e.g., 0.5 for +50% slower) to trigger warning/CI failure (default: 0.5) */
  regressionThreshold?: number
  /** CI mode: exit with non-zero code on severe regression or budget violations (default: false) */
  ci?: boolean
  /** Performance budgets configuration for CI quality gates */
  budgets?: PerformanceBudgets
  /** Whether to automatically write GitHub Actions Step Summary markdown to process.env.GITHUB_STEP_SUMMARY (default: true) */
  githubSummary?: boolean
  /** Output file path (e.g. 'doctor.json' or 'doctor.md') */
  output?: string
  /** Reporter format: 'terminal', 'json', 'markdown', or combined (default: 'terminal') */
  reporter?: OutputFormat | OutputFormat[]
  /** Glob patterns or test name substrings to ignore */
  ignore?: string[]
  /** Whether to run static AST analysis on suspicious test files (default: true) */
  staticAnalysis?: boolean
  /** Custom working directory root */
  cwd?: string
  /** Show doctor profiler overhead in summary (default: false in production) */
  showOverhead?: boolean
  /** Maximum number of history runs to keep per test (default: 20, alias: maxRunsPerTest) */
  maxHistoryEntries?: number
  maxRunsPerTest?: number
  /** Whether to capture git commit and branch metadata (default: true) */
  trackGit?: boolean
}

export interface GitContext {
  commitHash?: string
  commitShortHash?: string
  branch?: string
  author?: string
  message?: string
  timestamp?: string
}

export interface StatisticalSummary {
  count: number
  totalDuration: number
  mean: number
  median: number
  min: number
  max: number
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
  mad: number
  stdDev: number
}

export interface TestHistoryEntry {
  timestamp: string
  duration: number
  median?: number
  git?: GitContext
}

export interface TestHistoryRecord {
  id: string
  file: string
  name: string
  suitePath?: string[]
  runs: TestHistoryEntry[]
  medianDuration: number
  baselineDuration?: number
  git?: GitContext
}

export interface HistoryData {
  version: string
  updatedAt: string
  git?: GitContext
  tests: Record<string, TestHistoryRecord>
}

export interface TestRegression {
  testId: string
  name: string
  file: string
  previousDuration: number
  currentDuration: number
  percentageChange: number
  isNewSlowTest: boolean
  previousGit?: GitContext
  currentGit?: GitContext
}

export interface DoctorReportSummary {
  totalTests: number
  totalDuration: number
  suspiciousCount: number
  categoryCounts: Record<SlowCause, number>
  estimatedAvoidableMs: number
  doctorOverheadPercent?: number
  doctorDurationMs?: number
}

export interface ConfigAdvice {
  id: string
  title: string
  impact: 'high' | 'medium' | 'low'
  estimatedSpeedup: string
  reason: string
  prescription: string
  configSnippet: string
}

export interface DoctorReport {
  version: string
  timestamp: string
  git?: GitContext
  stats: StatisticalSummary
  tests: TestProfile[]
  suspiciousTests: TestProfile[]
  files: Record<string, FileDiagnostics>
  regressions?: TestRegression[]
  budgetEvaluation?: BudgetEvaluationResult
  advices?: ConfigAdvice[]
  summary: DoctorReportSummary
}

