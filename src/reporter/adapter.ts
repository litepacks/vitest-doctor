import type { FileDiagnostics, HookDurations, RuntimeSignals, TestProfile } from '../types/index.js'
import { FastProfiler } from '../profiler/fast-profiler.js'

export interface RawVitestTask {
  id?: string
  name?: string
  type?: string
  mode?: string
  file?: { filepath?: string; name?: string; diagnostic?: Record<string, unknown> }
  suite?: RawVitestTask
  tasks?: RawVitestTask[]
  meta?: Record<string, any>
  custom?: Record<string, any>
  signals?: RuntimeSignals
  result?: {
    state?: string
    duration?: number
    retryCount?: number
    hooks?: Record<string, number>
    errors?: unknown[]
    meta?: Record<string, any>
  }
  diagnostic?: Record<string, unknown>
}

export interface RawVitestFile extends RawVitestTask {
  filepath?: string
  name?: string
  diagnostic?: Record<string, unknown>
  tasks?: RawVitestTask[]
}

export class VitestAdapter {
  private fastProfiler = new FastProfiler()

  /**
   * Recursively extracts all leaf test tasks from Vitest files
   */
  public extractTestsFromFiles(files: RawVitestFile[] = []): {
    tests: TestProfile[]
    fileDiagnostics: Record<string, FileDiagnostics>
  } {
    const tests: TestProfile[] = []
    const fileDiagnostics: Record<string, FileDiagnostics> = {}

    for (const file of files) {
      const filePath = file.filepath || file.name || 'unknown'
      const diagnostics = this.fastProfiler.extractFileDiagnostics(file.diagnostic)
      fileDiagnostics[filePath] = diagnostics

      if (file.tasks && Array.isArray(file.tasks)) {
        this.traverseTasks(file.tasks, filePath, [], diagnostics, tests)
      }
    }

    return { tests, fileDiagnostics }
  }

  private traverseTasks(
    tasks: RawVitestTask[],
    filePath: string,
    currentSuitePath: string[],
    fileDiagnostics: FileDiagnostics,
    collected: TestProfile[],
    inheritedHooks: HookDurations = {}
  ): void {
    for (const task of tasks) {
      // Check if task itself is a hook task (e.g., custom hook task representation)
      if (task.type === 'beforeAll' || task.type === 'afterAll' || task.type === 'beforeEach' || task.type === 'afterEach') {
        const hookDuration = task.result?.duration ?? 0
        if (hookDuration > 0) {
          if (task.type === 'beforeAll') inheritedHooks.beforeAll = (inheritedHooks.beforeAll || 0) + hookDuration
          if (task.type === 'afterAll') inheritedHooks.afterAll = (inheritedHooks.afterAll || 0) + hookDuration
          if (task.type === 'beforeEach') inheritedHooks.beforeEach = (inheritedHooks.beforeEach || 0) + hookDuration
          if (task.type === 'afterEach') inheritedHooks.afterEach = (inheritedHooks.afterEach || 0) + hookDuration
        }
        continue
      }

      // Check for hooks defined in task/suite result
      const suiteHooks = { ...inheritedHooks }
      if (task.result?.hooks) {
        if (typeof task.result.hooks.beforeAll === 'number') suiteHooks.beforeAll = task.result.hooks.beforeAll
        if (typeof task.result.hooks.beforeEach === 'number') suiteHooks.beforeEach = task.result.hooks.beforeEach
        if (typeof task.result.hooks.afterEach === 'number') suiteHooks.afterEach = task.result.hooks.afterEach
        if (typeof task.result.hooks.afterAll === 'number') suiteHooks.afterAll = task.result.hooks.afterAll
      }

      // If task contains sub-tasks, it's a describe suite
      if (task.tasks && Array.isArray(task.tasks) && task.tasks.length > 0) {
        const nextSuite = task.name ? [...currentSuitePath, task.name] : currentSuitePath
        this.traverseTasks(task.tasks, filePath, nextSuite, fileDiagnostics, collected, suiteHooks)
      } else if (task.type === 'test' || task.type === 'custom' || (!task.type && task.result) || (task.type !== 'suite' && task.result)) {
        // Leaf test task
        const profile = this.fastProfiler.extractTestProfile(
          {
            ...task,
            file: { filepath: filePath, diagnostic: fileDiagnostics as Record<string, unknown> },
            result: {
              ...task.result,
              hooks: {
                ...suiteHooks,
                ...(task.result?.hooks || {})
              }
            }
          },
          currentSuitePath,
          fileDiagnostics
        )
        collected.push(profile)
      }
    }
  }

  /**
   * Helper to normalize task results hook durations
   */
  public extractHookDurations(taskResult?: RawVitestTask['result']): HookDurations {
    const hooks: HookDurations = {}
    if (taskResult?.hooks) {
      if (typeof taskResult.hooks.beforeAll === 'number') hooks.beforeAll = taskResult.hooks.beforeAll
      if (typeof taskResult.hooks.beforeEach === 'number') hooks.beforeEach = taskResult.hooks.beforeEach
      if (typeof taskResult.hooks.afterEach === 'number') hooks.afterEach = taskResult.hooks.afterEach
      if (typeof taskResult.hooks.afterAll === 'number') hooks.afterAll = taskResult.hooks.afterAll
    }
    return hooks
  }
}
