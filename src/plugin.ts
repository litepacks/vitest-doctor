import type { DoctorConfig } from './types/index.js'
import { VitestDoctorReporter } from './reporter/index.js'

export interface VitestDoctorPluginOptions extends Partial<DoctorConfig> {}

/**
 * Vitest Doctor Vite/Vitest Plugin
 *
 * Automatically injects worker-level setup profiling hooks and the Vitest Doctor reporter.
 *
 * Usage in vitest.config.ts:
 * ```ts
 * import { defineConfig } from 'vitest/config'
 * import { vitestDoctorPlugin } from 'vitest-doctor/plugin'
 *
 * export default defineConfig({
 *   plugins: [
 *     vitestDoctorPlugin({
 *       slow: 300,
 *       profile: 'auto',
 *       output: 'doctor.html'
 *     })
 *   ]
 * })
 * ```
 */
export function vitestDoctorPlugin(options: VitestDoctorPluginOptions = {}) {
  return {
    name: 'vitest-doctor',
    config(config: any) {
      config.test = config.test || {}

      // 1. Set environment config for workers and reporter
      if (options) {
        process.env.VITEST_DOCTOR_CONFIG = JSON.stringify(options)
      }

      // 2. Inject reporter
      const reporterInstance = new VitestDoctorReporter(options)
      const currentReporters = config.test.reporters
      if (!currentReporters) {
        config.test.reporters = ['default', reporterInstance]
      } else if (Array.isArray(currentReporters)) {
        config.test.reporters = [...currentReporters, reporterInstance]
      } else {
        config.test.reporters = [currentReporters, reporterInstance]
      }

      // 3. Inject setup file for worker deep profiling if not disabled
      if (options.profile !== 'off') {
        const setupPath = 'vitest-doctor/setup'
        const currentSetup = config.test.setupFiles
        if (!currentSetup) {
          config.test.setupFiles = [setupPath]
        } else if (Array.isArray(currentSetup)) {
          if (!currentSetup.includes(setupPath)) {
            config.test.setupFiles = [...currentSetup, setupPath]
          }
        } else if (currentSetup !== setupPath) {
          config.test.setupFiles = [currentSetup, setupPath]
        }
      }

      return config
    }
  }
}

export default vitestDoctorPlugin
