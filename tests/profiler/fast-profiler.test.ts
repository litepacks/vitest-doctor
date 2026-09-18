import { describe, it, expect } from 'vitest'
import { FastProfiler } from '../../src/profiler/fast-profiler.js'

describe('Fast Profiler', () => {
  const profiler = new FastProfiler()

  it('extracts test profile and hooks from raw task data', () => {
    const rawTask = {
      id: 'task-1',
      name: 'authenticates user',
      file: {
        filepath: '/path/to/tests/auth.test.ts'
      },
      result: {
        duration: 450,
        state: 'pass' as const,
        retryCount: 1,
        hooks: {
          beforeEach: 200,
          afterEach: 50
        }
      }
    }

    const profile = profiler.extractTestProfile(rawTask, ['AuthSuite', 'Login'])

    expect(profile.name).toBe('authenticates user')
    expect(profile.duration).toBe(450)
    expect(profile.state).toBe('passed')
    expect(profile.retryCount).toBe(1)
    expect(profile.hooks?.beforeEach).toBe(200)
    expect(profile.hooks?.afterEach).toBe(50)
    expect(profile.suitePath).toEqual(['AuthSuite', 'Login'])
  })

  it('extracts file diagnostics durations', () => {
    const diagnostics = profiler.extractFileDiagnostics({
      collectDuration: 100,
      setupDuration: 50,
      environmentSetupDuration: 200,
      importDuration: 300
    })

    expect(diagnostics.collect).toBe(100)
    expect(diagnostics.setup).toBe(50)
    expect(diagnostics.environment).toBe(200)
    expect(diagnostics.imports).toBe(300)
    expect(diagnostics.total).toBe(650)
  })
})
