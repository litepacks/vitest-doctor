import { describe, it, expect } from 'vitest'
import { vitestDoctor, VitestDoctorReporter } from '../../src/reporter/index.js'
import type { RawVitestFile } from '../../src/reporter/adapter.js'

describe('VitestDoctorReporter', () => {
  it('creates instance via factory function', () => {
    const reporter = vitestDoctor({ slow: 400 })
    expect(reporter).toBeInstanceOf(VitestDoctorReporter)
  })

  it('aggregates finished tests and produces diagnostic report', async () => {
    const reporter = new VitestDoctorReporter({
      slow: 300,
      reporter: 'json',
      history: false
    })

    const mockFiles: RawVitestFile[] = [
      {
        id: 'file-1',
        filepath: '/path/to/tests/sample.test.ts',
        diagnostic: {
          collectDuration: 40,
          setupDuration: 20,
          importDuration: 350
        },
        tasks: [
          {
            id: 'task-1',
            name: 'fast unit test',
            result: {
              state: 'pass',
              duration: 15
            }
          },
          {
            id: 'task-2',
            name: 'slow fixture test',
            result: {
              state: 'pass',
              duration: 550,
              hooks: {
                beforeEach: 400
              }
            }
          }
        ]
      }
    ]

    await reporter.onFinished(mockFiles)
    const report = reporter.getLastReport()!

    expect(report.summary.totalTests).toBe(2)
    expect(report.suspiciousTests.length).toBe(1)
    expect(report.suspiciousTests[0].name).toBe('slow fixture test')
    expect(report.suspiciousTests[0].diagnoses?.[0].cause).toBe('slow-before-each')
  })
})
