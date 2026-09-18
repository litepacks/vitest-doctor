---
title: Introduction
description: Overview and quick start guide for Vitest Doctor
---

# 🩺 Vitest Doctor

**Vitest Doctor** is a low-overhead performance diagnostics, memory leak detector, and root-cause analyzer for Vitest test suites.

As projects grow, test suites inevitably slow down. Traditional test runners only tell you *that* a test took 2.5 seconds—they cannot tell you *why*. Vitest Doctor combines static AST code analysis with runtime event-loop metrics and worker IPC signals to pinpoint exact bottlenecks and prescribe concrete fixes.

---

## ⚡ Key Capabilities

- **35+ Diagnostic Root Causes**: Pinpoints worker isolation overhead (`isolate: true`), unmocked timers, memory leaks, oversized snapshots, barrel imports, and slow lifecycle hooks.
- **Worker-Level Deep Profiling**: Non-invasive microsecond async resource tracking (`AsyncLocalStorage`, Event Loop Delay, active handles) via `vitestDoctorPlugin()`.
- **100% Offline Waterfall Timeline**: Self-contained interactive HTML diagnostic reports with zero external CDN dependencies.
- **CI/CD Quality Gates & GitHub Step Summary**: Performance budget enforcement and markdown summary tables in CI workflows.
- **Automated Performance Baselines & Regressions**: Statistical Median Absolute Deviation (MAD) tracking to catch performance regressions before merging.
- **Vitest Config Optimization Advisor**: Safe, context-aware config prescriptions tailored to your project's specific execution patterns.

---

## 🚀 Quick Start

Run Vitest Doctor directly in any Vitest project without prior installation:

```bash
npx vitest-doctor run --output doctor.html
```

Or install as a development dependency:

```bash
npm install -D vitest-doctor
```

Add a doctor script to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:doctor": "vitest-doctor run --output doctor.html"
  }
}
```

---

## 🧭 Next Steps

- [CLI Reference](/cli-reference): Explore commands (`run`, `analyze`, `baseline`, `prune`) and flags.
- [Diagnostic Rules](/diagnostic-rules): Browse the 35+ root cause detectors.
- [Configuration Guide](/configuration): Configure performance thresholds and budgets.
- [Vite/Vitest Plugin](/plugin): Enable worker-level deep profiling.
- [CI/CD Quality Gates](/ci-quality-gates): Integrate into GitHub Actions.
