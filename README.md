# 🩺 Vitest Doctor

> Low-overhead performance diagnostics, memory leak detector, and root-cause analyzer for Vitest test suites.

[![npm version](https://img.shields.io/npm/v/vitest-doctor.svg?style=flat-square)](https://www.npmjs.com/package/vitest-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Vitest Doctor** doesn't just show *which* tests are slow — it investigates and explains **why they are slow**, pinpoints the subsystem bottleneck, detects memory leaks, provides automated `vitest.config.ts` performance prescriptions, and enforces CI/CD performance quality gates.

---

## 🧐 What is Vitest Doctor?

**Vitest Doctor** is a performance diagnostic engine and developer experience tool for Vitest test suites that bridges the gap between basic test runners and deep system profiling. While standard test reporters only output raw execution milliseconds, Vitest Doctor instruments worker processes, inspects Node.js runtime subsystems (`async_hooks`, `eventLoopUtilization`, memory allocations, V8 GC pauses), analyzes test source code ASTs, and performs root-cause classification on test slowdowns.

It delivers:
1. **Root-Cause Attribution:** Classifies test bottlenecks into 35+ concrete diagnostics (e.g., unmocked timers, heavy barrel imports, worker isolate overhead).
2. **Automated Config Prescriptions:** The Config Advisor analyzes test suite dynamics and prescribes optimal `vitest.config.ts` configurations (e.g., `isolate: false`, concurrency tuning).
3. **CI/CD Quality Enforcement:** Configurable performance budgets and GitHub Actions summaries to prevent test suite regressions over time.
4. **Actionable Timeline & Dashboard:** A 100% offline interactive Waterfall dashboard for deep-dive visual performance investigation.

---

## 💡 Why Vitest Doctor?

Modern TypeScript & JavaScript test suites inevitably slow down as codebases grow, turning 5-second test runs into 2-minute CI bottlenecks. Finding the root causes is notoriously difficult:

* ⏱️ **Duration alone is deceptive:** A 500ms test isn't necessarily compute-heavy — it might be spending 480ms idling on an unmocked `setTimeout()`, 350ms waiting on an un-reused `beforeEach` database seed, or 400ms stuck in VM worker startup overhead.
* 🔍 **Manual profiling is tedious:** Attaching Chrome DevTools or Node inspector flags to short-lived Vitest worker threads is painful and introduces massive measurement distortion.
* 📈 **Silent CI regressions:** New pull requests frequently introduce cascading barrel file imports or memory leaks that pass assertions but gradually inflate CI pipeline duration.
* 🛠️ **Trial-and-error configuration:** Developers often tweak `poolOptions`, `threads`, or `isolate` blindly without understanding their suite's actual architectural bottlenecks.

**Vitest Doctor automates this entire diagnostic workflow with $<3\text{--}5\%$ overhead**, pinpointing exact file line numbers, explaining why each bottleneck occurs, and providing actionable code remedies.

---

## ⚡ Highlights

* **🔬 35+ Root Cause Diagnostics:** Pinpoints expensive `beforeEach`/`beforeAll` hooks, unmocked timers, barrel import churn, unawaited promises, unrestored fake timers, CPU bottlenecks, network socket I/O, sync filesystem calls, serial async execution, worker isolate overhead, `vi.resetModules` churn, DOM memory leaks, retained mock calls, unbounded event listeners, global scope pollution, large fixture retention, dangling async closures, GC thrashing, V8 heap exhaustion, oversized snapshots, worker tail latency, etc.
* **💡 Vitest Config Advisor:** Automatically analyzes test suite characteristics and prescribes actionable `vitest.config.ts` optimizations (e.g. disabling VM isolate overhead, concurrency tuning, file parallelism).
* **⚡ Near-Zero Overhead:** Fast mode profiling operates directly through public Vitest lifecycle hooks with $<3\text{--}5\%$ overhead.
* **🔌 Vitest Plugin & Worker Profiling:** Seamless `vitestDoctorPlugin()` automatically injects micro-second async resource tracking and worker-level signals into Vitest worker processes via `task.meta.doctorSignals`.
* **🚦 CI/CD Quality Gates & Performance Budgets:** Enforces configurable budgets (`maxSuiteDuration`, `maxTestDuration`, `maxTotalAvoidableTime`, `maxRegressions`, `maxP95Duration`) with non-zero exit codes on CI failure.
* **📋 GitHub Actions Step Summary:** Emits rich Markdown performance tables and actionable diagnostic summaries directly into `GITHUB_STEP_SUMMARY`.
* **📊 100% Offline HTML Dashboard & Waterfall Timeline:** Self-contained single-file HTML report with zero external CDN dependencies, featuring an interactive Waterfall execution timeline and client-side multi-factor search & filtering.
* **📈 Git Context & History Tracking:** Automatically associates test performance with Git commits, branches, and authors. Includes sliding-window retention and `vitest-doctor prune` to clean orphaned tests.
* **🎯 Relative & Anomaly Scoring:** Uses Median, MAD (Median Absolute Deviation), and percentiles ($p50, p75, p90, p95, p99$) so isolated spikes in fast suites are accurately flagged.
* **🛡️ Zero Global Pollution & Pure ESM/CJS:** Safe AST inspection, optional peer dependencies (`typescript`, `vitest`), and complete type definitions (`.d.ts` / `.d.cts`).

---

## 📦 Installation

```bash
npm install -D vitest-doctor
# or
pnpm add -D vitest-doctor
# or
yarn add -D vitest-doctor
```

> **Requirements:** Node.js `>=20.0.0` and Vitest `>=1.0.0`.

---

## 🚀 Quick Start

### 1. Vitest Plugin Integration (Recommended)

Add `vitestDoctorPlugin()` to your `vitest.config.ts`. The plugin automatically registers worker profilers and the diagnostic reporter:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { vitestDoctorPlugin } from 'vitest-doctor/plugin'

export default defineConfig({
  plugins: [
    vitestDoctorPlugin({
      slow: 500,           // Flag tests >= 500ms
      verySlow: 1500,      // Flag tests >= 1500ms
      relative: true,      // Detect relative statistical outliers (>5x median)
      medianMultiplier: 5,
      budgets: {
        maxSuiteDuration: 30000,
        maxTestDuration: 2000,
        maxRegressions: 0
      }
    })
  ]
})
```

### Option B: Native Vitest Reporter & Manual Setup

If you prefer configuring Vitest Doctor manually without the Vite plugin, add the reporter and optionally include `vitest-doctor/setup` in `setupFiles` to enable worker-level deep profiling:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { vitestDoctor } from 'vitest-doctor'

export default defineConfig({
  test: {
    // Optional: Enables worker-level async resource and deep CPU/memory profiling
    setupFiles: ['vitest-doctor/setup'],
    reporters: [
      'default',
      vitestDoctor({
        slow: 500,
        verySlow: 1500,
        top: 20
      })
    ]
  }
})
```

Run tests normally:
```bash
npx vitest run
```

---

### 2. CLI Usage

Vitest Doctor can be executed directly from your terminal:

```bash
# Run Vitest with doctor diagnostics
npx vitest-doctor

# Run with custom thresholds and export JSON
npx vitest-doctor run --slow 300 --output doctor.json

# Generate an interactive 100% offline HTML dashboard report with Waterfall timeline
npx vitest-doctor run --output doctor.html

# Save current test run as CI performance baseline
npx vitest-doctor baseline

# Run in CI mode (enforces performance budgets and exits with code 1 on violations)
npx vitest-doctor run --ci

# Clean orphaned tests from history (deleted/renamed files)
npx vitest-doctor prune

# Clean orphaned tests and reset baseline
npx vitest-doctor prune --clean-baseline

# Run static AST analysis without executing tests
npx vitest-doctor analyze
```

---

## 📊 Terminal Output Example

```text
Vitest Doctor (main@a1b2c3d)
──────────────────────────────────────────────────
1004 tests analyzed
27.4s total

• 13 suspicious / slow tests
• 4 slow import bottleneck(s)
• 3 expensive hook(s)
• 2 CPU-heavy test(s)

users.test.ts
──────────────────────────────────────────────────
creates a user                                    842ms

  beforeEach                                      514ms
  test body                                       291ms
  afterEach                                        37ms

   HIGH   expensive beforeEach hook
  Evidence:
    • 61% of test duration is spent in beforeEach hook
    • beforeEach defined at tests/users.test.ts:14
  Suggestion:
    Consider moving immutable or reusable initialization to beforeAll(), or use lightweight lazy fixtures.

auth.test.ts
──────────────────────────────────────────────────
File startup:
  imports                   1.31s
  environment                94ms
  setup                      48ms
  tests                     1.39s

Slow imports:
  lodash-es                 620ms
  src/database.ts           410ms
  fixtures/users.json       187ms

💡 Vitest Config Optimization Advisor
──────────────────────────────────────────────────
 HIGH IMPACT  Disable Worker Context Isolation (isolate: false) (2x - 4x faster execution)
  Reason:       9 test files dominated by VM worker startup. Unit tests without global mutable state run significantly faster in shared contexts.
  Prescription: Set poolOptions isolate to false for pure unit tests.
  Suggested config:
    // vitest.config.ts
    export default defineConfig({
      test: {
        poolOptions: {
          threads: { isolate: false },
          forks: { isolate: false }
        }
      }
    })

Potential issues
──────────────────────────────────────────────────
13 slow / suspicious tests
4 slow imports
3 expensive beforeEach hooks
2 CPU-bound tests
2 timer waits
1 network dependency

Estimated avoidable time: ~6.8s
doctor profiler overhead: 2.1%
```

---

## 🚦 CI/CD Quality Gates & GitHub Step Summary

Vitest Doctor provides first-class CI quality gates with configurable performance budgets. If any budget threshold is breached or severe performance regressions are detected, Vitest Doctor returns exit code `1`.

### Performance Budgets

Configure budgets in your `vitest.config.ts` or `vitest-doctor.config.ts`:

```ts
import type { DoctorConfig } from 'vitest-doctor'

export default {
  ci: true,
  budgets: {
    maxSuiteDuration: 45000,        // Fail if whole suite exceeds 45s
    maxTestDuration: 2500,          // Fail if any single test exceeds 2.5s
    maxTotalAvoidableTime: 8000,    // Fail if total avoidable bottleneck time exceeds 8s
    maxSuspiciousTests: 10,         // Fail if more than 10 suspicious tests found
    maxRegressions: 0,              // Fail if any test regresses vs baseline
    maxP95Duration: 800             // Fail if 95th percentile exceeds 800ms
  }
} satisfies DoctorConfig
```

### GitHub Actions Workflow

In GitHub Actions, Vitest Doctor automatically detects `GITHUB_STEP_SUMMARY` and renders a clean Markdown summary table with status badges and regression comparisons:

```yaml
name: Test Suite & Performance Gates
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci
      - name: Run Vitest with Doctor Quality Gate
        run: npx vitest-doctor run --ci --output doctor.html
        env:
          GITHUB_STEP_SUMMARY: ${{ github.step_summary }}
```

---

## 📊 100% Offline HTML Dashboard & Waterfall Timeline

Export a standalone, interactive HTML dashboard with zero external CDN dependencies:

```bash
npx vitest-doctor run --output doctor.html
```

* **Waterfall Timeline:** Interactive visual timeline showing file startup, imports, hook execution, and individual test timings.
* **Client-Side Filtering:** Search tests instantly and filter by *All*, *Suspicious*, *Slow*, *Regressions*, and *High Impact*.
* **Sort Controls:** Sort tests dynamically by Duration, Avoidable Time, Overhead %, or Start Time.
* **Air-Gapped Ready:** 100% embedded CSS & vanilla JS, perfectly suited for restricted enterprise CI/CD environments.

---

## 🔬 35+ Root-Cause Diagnostic Categories

| Cause | Trigger Condition | Example Suggestion |
| :--- | :--- | :--- |
| `slow-before-each` | `beforeEach` takes $>50\%$ of test time or $>350\text{ms}$ | Move static setup to `beforeAll()`. |
| `slow-before-all` | `beforeAll` initialization $>500\text{ms}$ | Use database containers or global setup workers. |
| `slow-after-each` | Cleanup hooks $>50\%$ of test time | Use lightweight in-memory resets instead of heavy purges. |
| `slow-import` | Module import duration $>50\%$ of file startup | Use dynamic `import()` or mock heavy dependencies. |
| `barrel-import-churn` | Importing from large barrel files (`index.ts`) causing cascading modules | Import directly from sub-paths (e.g. `import { x } from 'pkg/x'`). |
| `slow-environment` | Environment init (e.g. jsdom/happy-dom) $>350\text{ms}$ | Switch to `node` environment for pure unit tests. |
| `slow-setup` | `setupFiles` execution $>300\text{ms}$ | Prune redundant global setup files. |
| `cpu-bound` | CPU $>75\%$ and ELU $>0.75$ | Optimize loops, reduce fixture sizes, or use workers. |
| `event-loop-blocked` | Event loop delay $p99 > 50\text{ms}$ | Chunk sync tasks using `setImmediate()`. |
| `timer-wait` | Active unmocked `Timeout` resources + low CPU | Use `vi.useFakeTimers()` & `vi.advanceTimersByTime()`. |
| `unrestored-fake-timers` | Fake timers active across test boundary without `vi.useRealTimers()` | Call `vi.useRealTimers()` in `afterEach()`. |
| `unawaited-promise` | Floating async calls / unhandled promises without `await` | Add `await` before asynchronous test assertions. |
| `network-io` | Active TCP/TLS sockets + low CPU | Mock HTTP endpoints using `msw`, `vi.fn()`, or `nock`. |
| `filesystem-io` | Synchronous/heavy FS calls + low CPU | Use in-memory filesystems (`memfs`) or temp dirs. |
| `child-process` | `PROCESSWRAP` or `spawn`/`execSync` calls | Mock command executions instead of real OS spawns. |
| `memory-pressure` | Heap delta $>30\text{MB}$ during single test | Clear uncollected references between runs. |
| `gc-pressure` | Heavy heap churn causing GC latency | Reduce object allocations in hot loops. |
| `polling` | Repeated short timers / `waitFor` with low CPU | Use notification promises instead of polling loops. |
| `retry` | Test retried 1+ times | Fix underlying test flakiness / race conditions. |
| `serial-async-execution` | 3+ sequential async tests in file without concurrency | Use `describe.concurrent` or `it.concurrent` to parallelize. |
| `worker-initialization-overhead` | VM isolate startup $>3\times$ longer than test body | Set `isolate: false` or `singleThread: true` in poolOptions. |
| `module-reset-churn` | `vi.resetModules()` inside recurring hooks | Replace with `vi.clearAllMocks()` or `vi.restoreAllMocks()`. |
| `unused-global-setup` | Heavy global setup ($>250\text{ms}$) with zero test usage | Move to per-project setupFiles or Vitest workspaces. |
| `worker-tail-latency` | Heavy test files running serially at tail of suite | Reorder test execution using Longest Processing Time (LPT). |
| `dom-leak-accumulation` | DOM/UI components retained with rising memory delta | Call `cleanup()` or `unmount()` in `afterEach()`. |
| `oversized-snapshot` | Large snapshot diffing & disk serialization latency | Use `toMatchObject()` or inline assertions for key properties. |
| `resource-contention` | Concurrent lock/port/file contention with low CPU | Use isolated temporary folders and per-worker database schemas. |
| `monotonic-heap-leak` | Monotonic heap growth ($>20\text{MB}$) without release | Release cached singletons, fixtures, and state in `afterEach()`. |
| `retained-mock-calls` | Accumulated `mock.calls` history in spy mocks | Call `vi.clearAllMocks()` in `afterEach()` to free call arguments. |
| `unbounded-event-listeners` | Event listeners attached without removal | Remove listeners with `emitter.off()` or use `AbortSignal`. |
| `global-state-pollution` | Unreverted `globalThis`/`window` properties | Revert global mutations in `afterEach()` or avoid globals. |
| `large-fixture-retention` | Large JSON fixture ($>15\text{MB}$) imported at module scope | Load fixtures dynamically inside tests or read via streams. |
| `dangling-async-closure` | Unresolved promises / timers active at test completion | Ensure promises resolve/reject and clear active intervals. |
| `gc-thrashing` | GC pause time $>20\%$ of test duration | Reduce object allocations in hot loops and reuse buffers. |
| `heap-space-exhaustion` | Worker heap usage $>80\%$ of V8 limit (OOM danger) | Increase `max-old-space-size` or isolate heavy suites with worker pools. |

---

## ⚙️ Configuration Reference

Create `vitest-doctor.config.ts` or pass options to `vitestDoctor({...})` / `vitestDoctorPlugin({...})`:

```ts
import type { DoctorConfig } from 'vitest-doctor'

export default {
  // Absolute threshold in ms for slow test classification (default: 500)
  slow: 500,

  // Absolute threshold in ms for very slow test classification (default: 1500)
  verySlow: 1500,

  // Enable relative anomaly detection based on distribution (default: true)
  relative: true,

  // Multiplier vs median for relative anomaly flagging (default: 5)
  medianMultiplier: 5,

  // Modified Z-score MAD multiplier (default: 3.5)
  madMultiplier: 3.5,

  // Max number of top suspicious tests shown (default: 20)
  top: 20,

  // Deep profiling mode: 'auto' | 'always' | 'off' (default: 'auto')
  profile: 'auto',

  // Enable performance history tracking (default: true)
  history: true,

  // Maximum historical runs retained per test (default: 20)
  maxRunsPerTest: 20,

  // Performance regression alert threshold, e.g. 0.5 = +50% (default: 0.5)
  regressionThreshold: 0.5,

  // CI mode: non-zero exit on budget violations or severe regressions (default: false)
  ci: false,

  // CI Performance Budgets
  budgets: {
    maxSuiteDuration: 30000,
    maxTestDuration: 2000,
    maxTotalAvoidableTime: 5000,
    maxSuspiciousTests: 5,
    maxRegressions: 0,
    maxP95Duration: 600
  },

  // Output format: 'terminal' | 'json' | 'markdown' (default: 'terminal')
  reporter: 'terminal',

  // Write report to file (.json, .html, or .md)
  output: 'doctor.html',

  // Enable TypeScript AST analysis (default: true)
  staticAnalysis: true
} satisfies DoctorConfig
```

---

## 🔒 Design Principles

1. **No False Certainty:** Diagnostics report confidence levels (`high`, `medium`, `low`) and concrete evidence instead of absolute guesses.
2. **Zero Test Pollution:** Test hooks and timers are uninstrumented in fast mode and cleanly torn down after profiling.
3. **Public API First:** Built on Vitest's public plugin/reporter interface and standard Node.js built-ins (`perf_hooks`, `async_hooks`).
4. **Lightweight:** Optional peer dependencies for `typescript` and `vitest` with zero heavy bloat.

---

## 📄 License

MIT © [litepacks](https://github.com/litepacks)
