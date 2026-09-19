import { describe, it, expect } from 'vitest'
import { StaticAnalyzer } from '../../src/analyzers/static-analyzer.js'

describe('Static AST Analyzer', () => {
  const analyzer = new StaticAnalyzer()

  it('detects hooks and timer calls with line numbers in source code', () => {
    const code = `
import { describe, it, beforeEach } from 'vitest'

describe('suite', () => {
  beforeEach(() => {
    // setup
  })

  it('test', async () => {
    await new Promise(r => setTimeout(r, 500))
  })
})
    `

    const findings = analyzer.analyzeSourceCode('test.ts', code)

    const hookFindings = findings.filter(f => f.type === 'hook')
    expect(hookFindings.length).toBe(1)
    expect(hookFindings[0].name).toBe('beforeEach')
    expect(hookFindings[0].line).toBe(5)

    const timerFindings = findings.filter(f => f.type === 'timer')
    expect(timerFindings.length).toBe(1)
    expect(timerFindings[0].name).toBe('setTimeout')
    expect(timerFindings[0].line).toBe(10)
  })

  it('detects network, fake-timer, and child-process calls', () => {
    const code = `
import { it, vi } from 'vitest'
import axios from 'axios'
import { execSync } from 'child_process'

it('complex test', async () => {
  vi.useFakeTimers()
  await axios.get('https://api.example.com')
  execSync('ls')
})
    `

    const findings = analyzer.analyzeSourceCode('complex.test.ts', code)

    expect(findings.some(f => f.type === 'fake-timer' && f.name.includes('vi.useFakeTimers'))).toBe(true)
    expect(findings.some(f => f.type === 'network' && f.name.includes('axios'))).toBe(true)
    expect(findings.some(f => f.type === 'child-process' && f.name.includes('execSync'))).toBe(true)
  })

  it('detects vi.resetModules, snapshots, concurrent suites, and DOM test calls', () => {
    const code = `
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe.concurrent('concurrent suite', () => {
  it('handles dom and snapshot', async () => {
    vi.resetModules()
    render('<div>test</div>')
    expect({ foo: 'bar' }).toMatchSnapshot()
  })
})
    `

    const findings = analyzer.analyzeSourceCode('advanced.test.tsx', code)

    expect(findings.some(f => f.type === 'module-reset')).toBe(true)
    expect(findings.some(f => f.type === 'snapshot' && f.name === 'toMatchSnapshot')).toBe(true)
    expect(findings.some(f => f.type === 'concurrent')).toBe(true)
    expect(findings.some(f => f.type === 'dom-test')).toBe(true)
    expect(findings.some(f => f.type === 'async-test')).toBe(true)
  })

  it('detects spy mocks, event listeners, and global assignments', () => {
    const code = `
import { it, vi } from 'vitest'

it('handles memory sensitive operations', () => {
  vi.spyOn(console, 'log')
  process.on('uncaughtException', () => {})
  globalThis.__APP_STATE__ = { active: true }
})
    `

    const findings = analyzer.analyzeSourceCode('memory.test.ts', code)

    expect(findings.some(f => f.type === 'spy-mock')).toBe(true)
    expect(findings.some(f => f.type === 'event-listener')).toBe(true)
    expect(findings.some(f => f.type === 'global-assignment' && f.name === 'globalThis.__APP_STATE__')).toBe(true)
  })

  it('correctly extracts findings using fallbackRegexAnalysis when typescript is absent', () => {
    const code = `
import { describe, it, beforeEach } from 'vitest'
import axios from 'axios'

describe('regex fallback suite', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('async test', async () => {
    setTimeout(() => {}, 100)
    await axios.get('/test')
    expect(true).toMatchSnapshot()
  })
})
`
    const findings = analyzer.fallbackRegexAnalysis('regex.test.ts', code)

    expect(findings.some(f => f.type === 'hook' && f.name === 'beforeEach')).toBe(true)
    expect(findings.some(f => f.type === 'timer' && f.name === 'setTimeout')).toBe(true)
    expect(findings.some(f => f.type === 'fake-timer' && f.name.includes('useFakeTimers'))).toBe(true)
    expect(findings.some(f => f.type === 'network' && f.name.includes('axios'))).toBe(true)
    expect(findings.some(f => f.type === 'snapshot' && f.name === 'toMatchSnapshot')).toBe(true)
    expect(findings.some(f => f.type === 'async-test')).toBe(true)
    expect(findings.some(f => f.type === 'unrestored-fake-timers')).toBe(true)
  })
})

