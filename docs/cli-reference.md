---
title: CLI Reference
description: Complete command-line interface documentation and options
---

# 💻 CLI Reference

Vitest Doctor provides a rich CLI toolchain for executing diagnostics, static analysis, baseline snapshots, and history pruning.

## Usage

```bash
vitest-doctor [command] [options] [-- vitest-options]
```

---

## Commands

### `run` (Default)
Runs your Vitest test suite with the Doctor diagnostics reporter attached.

```bash
# Run tests and view terminal report
npx vitest-doctor run

# Generate self-contained HTML report
npx vitest-doctor run --output doctor.html

# Run in CI mode with quality gates
npx vitest-doctor run --ci --max-total-duration 5000
```

### `analyze`
Performs static AST structural analysis on your test files without executing tests. Identifies unawaited promises, barrel imports, unmocked timers, and lifecycle hooks.

```bash
npx vitest-doctor analyze
```

### `baseline`
Captures the current test run execution metrics as the reference performance baseline snapshot (`.vitest-doctor/baseline.json`).

```bash
npx vitest-doctor baseline
```

### `prune`
Cleans up stale test records from deleted files in the history store.

```bash
# Prune deleted test records
npx vitest-doctor prune

# Prune history and reset baseline snapshot
npx vitest-doctor prune --clean-baseline
```

---

## Options & Flags

| Flag | Type | Default | Description |
|---|---|---|---|
| `-c, --config <file>` | `string` | Auto | Custom path to `vitest-doctor.config.js` or `.json` |
| `--slow <ms>` | `number` | `500` | Threshold (ms) for flagging slow tests |
| `--verySlow <ms>` | `number` | `1500` | Threshold (ms) for flagging very slow tests |
| `--relative <bool>` | `boolean` | `true` | Enable/disable statistical MAD anomaly detection |
| `--top <n>` | `number` | `20` | Limit number of top suspicious tests displayed |
| `--profile <mode>` | `string` | `auto` | Profiling mode: `auto` \| `always` \| `off` |
| `--ci` | `boolean` | `false` | Enable CI quality gates (fails on regressions / budget violations) |
| `-o, --output <file>` | `string` | `undefined` | Write report to file (`.html`, `.json`, `.md`) |
| `-r, --reporter <fmt>` | `string` | `terminal` | Output format: `terminal` \| `json` \| `markdown` \| `html` |
| `--clean-baseline` | `boolean` | `false` | Reset baseline snapshot during `prune` |
| `--max-history <n>` | `number` | `20` | Maximum number of historical runs retained per test |
| `--no-git` | `boolean` | `false` | Disable automatic Git commit/branch context extraction |
| `--ignore <glob>` | `string` | `[]` | Comma-separated globs of files to ignore |
| `--show-overhead` | `boolean` | `false` | Display Doctor instrumentation overhead metrics |
| `-h, --help` | `boolean` | - | Display help menu |
| `-v, --version` | `boolean` | - | Display version number |

---

## Forwarding Vitest Options

Any arguments following `--` or unrecognized flags are directly forwarded to the underlying Vitest process:

```bash
# Run only unit test directory with doctor diagnostics
npx vitest-doctor run tests/unit/ --output doctor.html

# Run single test file in watch mode
npx vitest-doctor run tests/auth.test.ts --watch
```
