---
title: Configuration
description: Vitest Doctor configuration schema, options, and performance budgets
---

# ⚙️ Configuration Guide

Vitest Doctor automatically discovers configuration files from the following locations:
1. `vitest-doctor.config.js` / `vitest-doctor.config.mjs` / `vitest-doctor.config.ts`
2. `.vitest-doctor.json`
3. Custom path via `--config <path>` or `--doctor-config <path>`

---

## Configuration Example

```typescript
// vitest-doctor.config.ts
import { defineConfig } from 'vitest-doctor'

export default defineConfig({
  slow: 300,
  verySlow: 1000,
  relative: true,
  top: 20,
  profile: 'auto',
  trackGit: true,
  output: 'doctor.html',
  reporter: 'terminal',
  githubSummary: true,
  budgets: {
    maxTotalDurationMs: 8000,
    maxSlowTests: 5,
    maxSuspiciousTests: 3,
    failOnRegressionPercent: 30,
    failOnP95Ms: 400
  }
})
```

---

## Options Reference

### Thresholds & Anomaly Detection

| Option | Type | Default | Description |
|---|---|---|---|
| `slow` | `number` | `500` | Absolute duration (ms) for slow test classification |
| `verySlow` | `number` | `1500` | Absolute duration (ms) for very slow test classification |
| `relative` | `boolean` | `true` | Enables MAD statistical outlier analysis |
| `relativeMultiplier` | `number` | `3.0` | Factor above median duration to trigger anomaly alert |
| `top` | `number` | `20` | Max number of suspicious tests in summary outputs |
| `profile` | `'auto' \| 'always' \| 'off'` | `'auto'` | Non-invasive worker deep profiling mode |

---

### CI/CD Performance Budgets

| Budget Option | Type | Description |
|---|---|---|
| `maxTotalDurationMs` | `number` | Maximum allowed total test suite execution duration (ms) |
| `maxSlowTests` | `number` | Maximum allowed number of slow tests exceeding threshold |
| `maxSuspiciousTests` | `number` | Maximum allowed number of suspicious tests with identified causes |
| `failOnRegressionPercent` | `number` | Fails CI if any test slows down by more than this percentage vs baseline |
| `failOnP95Ms` | `number` | Fails CI if 95th percentile test duration exceeds this threshold (ms) |

---

### History & Baselines

| Option | Type | Default | Description |
|---|---|---|---|
| `historyPath` | `string` | `.vitest-doctor/history.json` | Path to persistent test duration history store |
| `baselinePath` | `string` | `.vitest-doctor/baseline.json` | Path to performance baseline snapshot file |
| `maxHistoryEntries` | `number` | `20` | Max runs tracked per test ID before automatic pruning |
| `trackGit` | `boolean` | `true` | Attaches Git commit hash, branch, and author to test runs |
| `githubSummary` | `boolean` | `true` | Automatically writes GHA Step Summary table when running in CI |
