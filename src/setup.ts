import { beforeEach, afterEach } from 'vitest'
import { DeepProfiler } from './profiler/deep-profiler.js'
import type { DoctorConfig, RuntimeSignals } from './types/index.js'

let activeConfig: DoctorConfig = {}

try {
  if (process.env.VITEST_DOCTOR_CONFIG) {
    activeConfig = JSON.parse(process.env.VITEST_DOCTOR_CONFIG)
  }
} catch {
  activeConfig = {}
}

let currentProfiler: DeepProfiler | null = null

/**
 * Automatically hook into Vitest worker lifecycle for per-test deep profiling
 */
if (activeConfig.profile !== 'off') {
  beforeEach(async () => {
    currentProfiler = new DeepProfiler()
    currentProfiler.start()
  })

  afterEach(async (context) => {
    if (!currentProfiler) return

    const signals: RuntimeSignals = currentProfiler.stop()
    currentProfiler = null

    // Vitest provides Task/TestContext
    const task = (context as any)?.task || (context as any)
    if (task) {
      task.meta = task.meta || {}
      task.meta.doctorSignals = signals
    }
  })
}

export { currentProfiler }
