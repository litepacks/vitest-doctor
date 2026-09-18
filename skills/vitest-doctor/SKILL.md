---
name: vitest-doctor
description: >-
  Performance diagnostics, memory leak detector, and root-cause analyzer for Vitest test suites.
  Use whenever Vitest tests are slow, timing out, hitting memory leaks/OOM, suffering from worker
  overhead, or when optimizing test execution time and establishing CI performance baselines.
---

# Vitest Doctor Skill

`vitest-doctor` is a low-overhead diagnostics tool, Vitest plugin, and reporter that identifies not just *which* tests are slow, but **why they are slow**, pinpoints subsystem bottlenecks, detects memory leaks, suggests automated `vitest.config.ts` configuration prescriptions, and provides actionable remediation steps.

---

## 🚀 When to Use This Skill

Activate this skill when:
- Vitest test suites take too long to run locally or in CI.
- Tests suffer from memory leaks, heap growth, or "JavaScript heap out of memory" (OOM) errors.
- Test suites have high worker startup times, slow imports, or expensive `beforeEach`/`beforeAll` hooks.
- Establishing a performance baseline and enforcing CI performance budgets in pull requests.
- Investigating unmocked timers, barrel import churn, unawaited promises, serial async tests, or worker resource contention.
- Generating offline HTML test execution waterfall reports.

---

## 🛠️ CLI Quick Commands

Run Vitest Doctor in the root of any Vitest project:

### 1. Run Diagnostic Test Suite
```bash
npx vitest-doctor
# or
vitest-doctor run
```

### 2. Custom Thresholds, Profiling & Output Formats
```bash
# Flag tests slower than 300ms, enable deep profiling
npx vitest-doctor run --slow 300 --very-slow 1000 --profile always

# Export JSON report for programmatic analysis
npx vitest-doctor run --output doctor.json --reporter json

# Export 100% offline interactive HTML dashboard report with Waterfall timeline
npx vitest-doctor run --output doctor.html
```

### 3. Establish CI Baseline, Quality Gates & Pruning
```bash
# 1. Establish performance baseline snapshot
npx vitest-doctor baseline

# 2. Run in CI mode (enforces performance budgets and exits with code 1 on violations)
npx vitest-doctor run --ci

# 3. Clean orphaned tests from history (deleted or renamed test files)
npx vitest-doctor prune

# 4. Clean history and reset baseline snapshot
npx vitest-doctor prune --clean-baseline
```

### 4. Static AST Analysis (Without Running Tests)
```bash
# Scans test files AST without executing tests
npx vitest-doctor analyze
```

---

## ⚙️ Vitest Config Integration

### Option A: Vitest Plugin (Recommended)
Add `vitestDoctorPlugin` to `plugins` in `vitest.config.ts` (automatically instruments worker processes with zero manual setup):

```ts
import { defineConfig } from 'vitest/config'
import { vitestDoctorPlugin } from 'vitest-doctor/plugin'

export default defineConfig({
  plugins: [
    vitestDoctorPlugin({
      slow: 400,            // Flag tests >= 400ms
      verySlow: 1200,       // Flag tests >= 1200ms
      relative: true,       // Detect relative statistical outliers
      medianMultiplier: 5,  // Flag tests taking >5x median suite duration
      top: 20,              // Display top 20 suspicious tests
      profile: 'auto',      // 'auto' | 'always' | 'off'
      history: true,        // Track rolling performance history
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
Integrate directly into `reporters` in `vitest.config.ts` (add `setupFiles: ['vitest-doctor/setup']` for worker deep profiling):

```ts
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

---

## 🔬 35+ Root-Cause Diagnostic Categories & Fix Strategies

Vitest Doctor automatically classifies bottlenecks into 35+ distinct categories. When a test is diagnosed, apply the corresponding remedy:

### 1. Hook & Setup Overhead
- **`slow-before-each`**: `beforeEach` hook consumes $>50\%$ of test time or $>350\text{ms}$.
  * *Fix*: Move immutable setup or database seeding into `beforeAll()`, or use lazy, in-memory fixtures.
- **`slow-before-all`**: `beforeAll` initialization $>500\text{ms}$.
  * *Fix*: Reuse database containers across worker pools or move shared initialization to global setup workers.
- **`slow-after-each`**: Teardown/cleanup consumes $>50\%$ of test time.
  * *Fix*: Use lightweight state resets instead of full database truncation/purges between tests.
- **`slow-setup`**: Global `setupFiles` take $>300\text{ms}$ before executing files.
  * *Fix*: Prune unused global setup files and move project-specific setup to directory configs.
- **`unused-global-setup`**: Heavy global setup ($>250\text{ms}$) running on standalone unit tests.
  * *Fix*: Use Vitest Workspaces (`vitest.workspace.ts`) to isolate lightweight unit tests from heavy integration setup.

### 2. Module & Environment Overhead
- **`slow-import`**: Dependency imports consume $>50\%$ of file startup.
  * *Fix*: Use dynamic `import()`, avoid large barrel file imports, or mock heavy external dependencies.
- **`barrel-import-churn`**: Re-export barrel files (`index.ts`) pulling entire component/library trees into memory.
  * *Fix*: Import directly from subpath files (e.g., `import { Button } from '@components/Button'`).
- **`slow-environment`**: Environment startup (`jsdom` / `happy-dom`) exceeds $>350\text{ms}$.
  * *Fix*: Set `environment: 'node'` for pure logic/algorithm/utility test files that do not need DOM APIs.
- **`worker-initialization-overhead`**: Worker context creation / VM isolate takes $>3\times$ longer than the test body.
  * *Fix*: In `vitest.config.ts`, configure `poolOptions.threads.isolate: false` or use `singleThread: true` for pure unit suites.
- **`module-reset-churn`**: `vi.resetModules()` used repeatedly in `beforeEach`/`afterEach`.
  * *Fix*: Replace with `vi.clearAllMocks()` or `vi.restoreAllMocks()`. Limit full module cache reset only to specific tests.
- **`large-fixture-retention`**: Large JSON fixtures ($>15\text{MB}$) imported at top-level module scope.
  * *Fix*: Read large fixtures dynamically inside test bodies or use streams instead of top-level static imports.

### 3. Concurrency & Worker Scheduling
- **`serial-async-execution`**: 3+ independent async tests in a file running sequentially.
  * *Fix*: Use `describe.concurrent` or `it.concurrent` so independent async operations run in parallel.
- **`worker-tail-latency`**: Long tests running at the tail of the suite, keeping workers idle.
  * *Fix*: Reorder test execution using Longest Processing Time (LPT) scheduling so heavy files start first.
- **`resource-contention`**: Parallel workers contending for SQLite locks, file descriptors, or port bindings.
  * *Fix*: Give each test worker a unique temporary directory (`tmpdir`), dynamic port (`port: 0`), or worker-specific database schema.

### 4. Memory Leaks & GC Bottlenecks
- **`monotonic-heap-leak`**: Heap memory grows steadily ($>20\text{MB}$) without being released across tests.
  * *Fix*: Clear cached object graphs, global instances, and singleton state in `afterEach()`.
- **`retained-mock-calls`**: `vi.spyOn` or `vi.fn` accumulating large argument arrays in `mock.calls`.
  * *Fix*: Call `vi.clearAllMocks()` or `vi.restoreAllMocks()` in `afterEach()`.
- **`unbounded-event-listeners`**: Event listeners attached to `process` or singleton emitters without cleanup.
  * *Fix*: Call `emitter.off()` or `removeListener()` in `afterEach()`, or pass an `AbortSignal`.
- **`global-state-pollution`**: Properties added or modified on `globalThis` / `window` during tests.
  * *Fix*: Revert all global modifications in `afterEach()` or avoid mutating global scope.
- **`dom-leak-accumulation`**: UI/DOM components retained with rising memory delta.
  * *Fix*: Call `cleanup()` or `unmount()` in `afterEach()`.
- **`dangling-async-closure`**: Unresolved promises or active timers remaining at test completion.
  * *Fix*: Ensure all async promises resolve/reject and clear active intervals before test finishes.
- **`gc-thrashing`**: V8 Stop-the-world GC pauses consume $>20\%$ of test duration.
  * *Fix*: Reduce temporary object allocations in hot loops, reuse buffers, and avoid large string concatenations.
- **`heap-space-exhaustion`**: Worker heap usage exceeds $>80\%$ of V8 limit (**OOM risk**).
  * *Fix*: Increase Node.js `NODE_OPTIONS="--max-old-space-size=4096"` or split suites across multiple worker pools.

### 5. Async Delays & IO Waits
- **`timer-wait`**: Unmocked real clock waiting (`setTimeout`, `delay`, `sleep`).
  * *Fix*: Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` for instant time advancement.
- **`unrestored-fake-timers`**: Fake timers left active across test boundaries.
  * *Fix*: Call `vi.useRealTimers()` in `afterEach()` to restore standard event loop timers.
- **`unawaited-promise`**: Floating asynchronous operations executing without `await`.
  * *Fix*: Add `await` before asynchronous calls and assertions to avoid unhandled async leaks.
- **`polling`**: Asynchronous `waitFor` or polling loop spinning with low CPU.
  * *Fix*: Replace polling with event-driven notification promises or reduce poll intervals.
- **`network-io`**: Real HTTP/TCP socket requests made during tests.
  * *Fix*: Mock network endpoints using `msw`, `vi.fn()`, or `nock`.
- **`filesystem-io`**: Synchronous or heavy disk reads/writes during unit tests.
  * *Fix*: Use in-memory filesystems (`memfs`) or lightweight temporary directories.
- **`child-process`**: Spawning real operating system child processes (`execSync`, `spawn`).
  * *Fix*: Mock command outputs instead of executing real child processes.
- **`cpu-bound`**: Heavy mathematical or serialization loops ($>75\%$ CPU and ELU).
  * *Fix*: Optimize algorithmic loops, use smaller mock data, or offload to worker threads.
- **`event-loop-blocked`**: Synchronous code blocking the Node.js event loop ($p99 > 50\text{ms}$).
  * *Fix*: Break long sync computations into asynchronous chunks using `setImmediate()`.
- **`retry`**: Test required 1+ retries to pass.
  * *Fix*: Eliminate race conditions, unhandled timing issues, or shared mutable state causing test flakiness.
- **`oversized-snapshot`**: Large snapshot diffing and disk serialization adding wall-clock latency.
  * *Fix*: Assert specific properties with `expect().toMatchObject()` instead of entire object snapshots.

---

## 📋 Recommended Performance Optimization Workflow

When tasked with speeding up a test suite:
1. **Run Doctor**: Execute `npx vitest-doctor` to generate the initial diagnostic breakdown and check the **Vitest Config Advisor** recommendations.
2. **Apply Config Advisor Prescriptions**: If worker startup dominates test runtime, configure `poolOptions: { threads: { isolate: false } }` as recommended.
3. **Review Potential Issues**: Inspect the summary section for dominant bottlenecks (e.g. `12 expensive beforeEach hooks`, `4 barrel imports`, `3 unmocked timer waits`).
4. **Target High Confidence First**: Address issues labeled with `HIGH` confidence badges in descending order of `Estimated avoidable time`.
5. **Benchmark Impact**: Re-run `npx vitest-doctor` to verify wall-clock duration reduction.
6. **Lock Baseline & Prune**: Save the optimized state with `npx vitest-doctor baseline` and clean historical noise with `npx vitest-doctor prune`.
