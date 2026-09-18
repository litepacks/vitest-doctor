---
title: Diagnostic Rules
description: Complete catalog of 35+ root cause detectors and prescriptions
---

# 🩺 Diagnostic Rules Catalog

Vitest Doctor classifies test slowness, bottlenecks, and anomalies across 35+ specialized diagnostic rules using AST analysis and runtime telemetry.

---

## 1. Worker & Environment Overhead

### `worker-initialization-overhead`
- **Symptom:** File startup and VM worker initialization (`isolate: true`) dominates total test file execution time.
- **Evidence:** File startup took >300ms while actual test body execution took <100ms.
- **Prescription:** For pure unit tests without mutable global state, set `poolOptions: { threads: { isolate: false } }`.

### `slow-environment`
- **Symptom:** Heavy simulated DOM environments (`jsdom` or `happy-dom`) run on backend or non-UI unit tests.
- **Prescription:** Change default environment to `'node'` in `vitest.config.ts`, and use `// @vitest-environment jsdom` docblock only on UI component files.

### `unused-global-setup`
- **Symptom:** Global `setupFiles` initialize heavy database pools or mocking harnesses for tests that contain only lightweight unit logic.
- **Prescription:** Move heavy setup fixtures to directory-scoped setup files or local helper functions.

### `worker-tail-latency`
- **Symptom:** One long-running test worker holds the entire test runner process while all other worker threads remain idle.
- **Prescription:** Split the heavy test file into smaller parallel suites or balance test distribution.

---

## 2. Timing & Lifecycle Issues

### `slow-before-each` / `slow-before-all` / `slow-after-each`
- **Symptom:** Lifecycle hooks consume over 40% of total test duration.
- **Prescription:** Move immutable setup logic to `beforeAll()`, or adopt lazy fixtures that only instantiate resources when accessed.

### `timer-wait`
- **Symptom:** Real wall-clock time is spent awaiting `setTimeout`, `setInterval`, or sleep delays with low CPU utilization.
- **Prescription:** Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` to advance simulated clocks instantaneously.

### `unrestored-fake-timers`
- **Symptom:** `vi.useFakeTimers()` is invoked without a corresponding `vi.useRealTimers()` in `afterEach()`.
- **Prescription:** Always invoke `vi.useRealTimers()` or configure `clearMocks: true` / `restoreMocks: true`.

### `unawaited-promise`
- **Symptom:** Promises (such as `expect(promise).resolves` or async operations) are created without an `await` statement.
- **Prescription:** Add `await` before asynchronous matcher expressions to avoid floating promises.

---

## 3. Memory & Resource Leaks

### `monotonic-heap-leak`
- **Symptom:** Node.js V8 heap memory grows steadily and monotonically across repeated test iterations.
- **Prescription:** Clean up global array buffers, caches, and singleton registries in `afterEach()`.

### `retained-mock-calls`
- **Symptom:** `vi.fn()` or `vi.spyOn()` accumulate thousands of recorded invocation arguments across suites.
- **Prescription:** Call `vi.clearAllMocks()` in `afterEach()` to release retained call arguments.

### `unbounded-event-listeners`
- **Symptom:** Node.js `EventEmitter` or DOM `addEventListener` listeners increase continuously without cleanup.
- **Prescription:** Remove event listeners in `afterEach()` or use `AbortSignal` with `{ signal }`.

### `global-state-pollution`
- **Symptom:** Properties attached to `globalThis`, `window`, or `process.env` persist across test files.
- **Prescription:** Isolate global mutations or restore original property descriptors in `afterEach()`.

### `large-fixture-retention`
- **Symptom:** Large JSON datasets or mock payloads are imported at module scope and pinned in memory.
- **Prescription:** Import fixtures dynamically inside test bodies or construct lightweight factory objects.

---

## 4. Concurrency & Performance

### `serial-async-execution`
- **Symptom:** Multiple independent, stateless asynchronous tests run in serial sequence.
- **Safety Filter:** Automatically suppressed on integration tests, database suites (`knex`, `sqlite`, `prisma`), file mutations, or server endpoints.
- **Prescription:** Use `describe.concurrent` or `it.concurrent` on verified stateless unit test suites.

### `barrel-import-churn`
- **Symptom:** Test files import from large root `index.ts` barrel files, triggering recursive parsing of hundreds of unused modules.
- **Prescription:** Import directly from specific sub-paths (e.g., `import { user } from './models/user'`).

### `module-reset-churn`
- **Symptom:** Repeated calls to `vi.resetModules()` force Vitest to re-evaluate module graphs from scratch.
- **Prescription:** Prefer `vi.clearAllMocks()` or `vi.restoreAllMocks()` over full module cache resets.
