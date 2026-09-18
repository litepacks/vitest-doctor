import type { FileDiagnostics, HookDurations, RuntimeSignals, TestProfile } from '../types/index.js'

export class FastProfiler {
  /**
   * Builds normalized TestProfile from Vitest task metadata
   */
  public extractTestProfile(
    rawTask: {
      id?: string
      name?: string
      file?: { filepath?: string; name?: string; diagnostic?: Record<string, unknown> }
      suite?: { name?: string; suite?: unknown }
      meta?: Record<string, any>
      custom?: Record<string, any>
      signals?: RuntimeSignals
      result?: {
        duration?: number
        state?: string
        retryCount?: number
        hooks?: Record<string, number>
        meta?: Record<string, any>
      }
    },
    suiteHierarchy: string[] = [],
    fileDiagnostics?: FileDiagnostics
  ): TestProfile {
    const filePath = rawTask.file?.filepath || rawTask.file?.name || 'unknown'
    const name = rawTask.name || 'unnamed-test'
    const duration = rawTask.result?.duration ?? 0
    const retryCount = rawTask.result?.retryCount ?? 0

    let state: TestProfile['state'] = 'passed'
    if (rawTask.result?.state === 'fail') state = 'failed'
    else if (rawTask.result?.state === 'skip') state = 'skipped'
    else if (rawTask.result?.state === 'todo') state = 'todo'

    const hooks: HookDurations = {}
    if (rawTask.result?.hooks) {
      if (typeof rawTask.result.hooks.beforeAll === 'number') hooks.beforeAll = rawTask.result.hooks.beforeAll
      if (typeof rawTask.result.hooks.beforeEach === 'number') hooks.beforeEach = rawTask.result.hooks.beforeEach
      if (typeof rawTask.result.hooks.afterEach === 'number') hooks.afterEach = rawTask.result.hooks.afterEach
      if (typeof rawTask.result.hooks.afterAll === 'number') hooks.afterAll = rawTask.result.hooks.afterAll
    }

    const id = `${filePath}::${suiteHierarchy.join(' > ')}::${name}`

    // Extract deep profiling signals collected in worker
    const signals: RuntimeSignals | undefined =
      rawTask.signals ||
      rawTask.meta?.doctorSignals ||
      rawTask.custom?.doctorSignals ||
      rawTask.result?.meta?.doctorSignals

    const memory = signals?.memory

    return {
      id,
      name,
      file: filePath,
      suitePath: suiteHierarchy.length > 0 ? suiteHierarchy : undefined,
      duration,
      state,
      retryCount,
      hooks,
      signals,
      memory,
      fileDiagnostics
    }
  }

  /**
   * Extracts FileDiagnostics from Vitest File diagnostic record
   */
  public extractFileDiagnostics(diagnosticRecord?: Record<string, unknown>): FileDiagnostics {
    if (!diagnosticRecord) return {}

    const collect = typeof diagnosticRecord.collectDuration === 'number'
      ? diagnosticRecord.collectDuration
      : (typeof diagnosticRecord.collect === 'number' ? diagnosticRecord.collect : undefined)

    const setup = typeof diagnosticRecord.setupDuration === 'number'
      ? diagnosticRecord.setupDuration
      : (typeof diagnosticRecord.setup === 'number' ? diagnosticRecord.setup : undefined)

    const environment = typeof diagnosticRecord.environmentSetupDuration === 'number'
      ? diagnosticRecord.environmentSetupDuration
      : (typeof diagnosticRecord.environment === 'number' ? diagnosticRecord.environment : undefined)

    const prepare = typeof diagnosticRecord.prepareDuration === 'number'
      ? diagnosticRecord.prepareDuration
      : (typeof diagnosticRecord.prepare === 'number' ? diagnosticRecord.prepare : undefined)

    const imports = typeof diagnosticRecord.importDuration === 'number'
      ? diagnosticRecord.importDuration
      : (typeof diagnosticRecord.imports === 'number' ? diagnosticRecord.imports : undefined)

    const total = (collect || 0) + (setup || 0) + (environment || 0) + (prepare || 0) + (imports || 0)

    return {
      collect,
      setup,
      environment,
      prepare,
      imports,
      total: total > 0 ? total : undefined
    }
  }
}
