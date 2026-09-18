---
title: CI/CD Quality Gates
description: Performance regression prevention and GitHub Actions integration
---

# 🛡️ CI/CD Quality Gates

Vitest Doctor prevents test suite degradation and regressions in CI pipelines before code merges into production.

---

## GitHub Actions Example

```yaml
name: Test Suite & Performance Gates

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci

      # Restore cached performance baseline
      - name: Restore Performance Baseline
        uses: actions/cache@v4
        with:
          path: .vitest-doctor/baseline.json
          key: vitest-baseline-${{ runner.os }}-${{ github.base_ref || 'main' }}
          restore-keys: |
            vitest-baseline-${{ runner.os }}-

      # Execute Vitest with Doctor quality gates
      - name: Run Tests with Vitest Doctor
        run: npx vitest-doctor run --ci --output doctor.html

      # Upload diagnostic HTML report artifact
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: vitest-doctor-report
          path: doctor.html

      # Capture new baseline on main branch commits
      - name: Update Performance Baseline Snapshot
        if: github.ref == 'refs/heads/main'
        run: npx vitest-doctor baseline
```

---

## GitHub Actions Step Summary

When executed inside a GitHub Actions runner (where `$GITHUB_STEP_SUMMARY` is populated), Vitest Doctor automatically renders a markdown diagnostics summary table directly onto the Actions run overview page:

- **Executive Metrics:** Total tests, total duration, p50/p95 percentiles, and detected regressions.
- **Top Bottlenecks Table:** File name, test name, duration, and root cause diagnosis.
- **Config Advisor Notice:** Prescriptions for worker and configuration optimizations.
