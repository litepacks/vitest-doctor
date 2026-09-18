---
title: Vite & Vitest Plugin
description: Worker-level deep profiling and IPC telemetry integration
---

# 🔌 Vite & Vitest Plugin

While `vitest-doctor run` operates externally via the reporter interface, adding `vitestDoctorPlugin()` directly to your `vitest.config.ts` unlocks non-invasive **worker-level deep profiling**.

---

## Installation

Add the plugin to your Vite or Vitest configuration file:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { vitestDoctorPlugin } from 'vitest-doctor/plugin'

export default defineConfig({
  plugins: [
    vitestDoctorPlugin({
      slow: 300,
      verySlow: 1000,
      profile: 'auto'
    })
  ],
  test: {
    // Other Vitest configuration
  }
})
```

---

## What Does the Plugin Do?

1. **Automatic Setup File Injection**: Injects lightweight diagnostic hooks (`src/setup.ts`) into Vitest worker processes without manual `setupFiles` configuration.
2. **Worker IPC Telemetry Bridge**: Gathers CPU user/system time, Node.js Event Loop Utilization (ELU), active handles, and `AsyncLocalStorage` telemetry per test.
3. **Task Meta Signals**: Encodes telemetry directly into `task.meta.doctorSignals` which is transmitted back to the reporter across Vitest worker boundaries with negligible overhead (<1%).
