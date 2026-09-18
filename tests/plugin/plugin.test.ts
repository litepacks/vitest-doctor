import { describe, it, expect } from 'vitest'
import { vitestDoctorPlugin } from '../../src/plugin.js'

describe('vitestDoctorPlugin', () => {
  it('creates plugin with name and config hook', () => {
    const plugin = vitestDoctorPlugin({ slow: 350, profile: 'auto' })
    expect(plugin.name).toBe('vitest-doctor')
    expect(typeof plugin.config).toBe('function')
  })

  it('injects reporter and setupFiles when config hook is called', () => {
    const plugin = vitestDoctorPlugin({ slow: 400, profile: 'always', output: 'report.html' })
    const userConfig: any = {
      test: {
        globals: true,
        reporters: ['default']
      }
    }

    const modified = plugin.config(userConfig)
    expect(modified.test.reporters.length).toBe(2)
    expect(modified.test.setupFiles).toContain('vitest-doctor/setup')
  })

  it('does not inject setupFiles when profile is off', () => {
    const plugin = vitestDoctorPlugin({ slow: 400, profile: 'off' })
    const userConfig: any = {
      test: {
        reporters: ['default']
      }
    }

    const modified = plugin.config(userConfig)
    expect(modified.test.reporters.length).toBe(2)
    expect(modified.test.setupFiles).toBeUndefined()
  })

  it('preserves existing setupFiles array and appends doctor setup', () => {
    const plugin = vitestDoctorPlugin({ profile: 'always' })
    const userConfig: any = {
      test: {
        setupFiles: ['./tests/setup.ts']
      }
    }

    const modified = plugin.config(userConfig)
    expect(modified.test.setupFiles).toEqual(['./tests/setup.ts', 'vitest-doctor/setup'])
  })
})
