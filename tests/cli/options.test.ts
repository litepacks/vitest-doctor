import { describe, it, expect } from 'vitest'
import { parseCliArgs } from '../../src/cli/options.js'

describe('CLI Option Parser', () => {
  it('parses default run command and flags', () => {
    const args = ['--slow', '400', '--verySlow', '1200', '--output', 'report.json', '--ci']
    const parsed = parseCliArgs(args)

    expect(parsed.command).toBe('run')
    expect(parsed.config.slow).toBe(400)
    expect(parsed.config.verySlow).toBe(1200)
    expect(parsed.config.output).toBe('report.json')
    expect(parsed.config.ci).toBe(true)
  })

  it('parses explicit subcommands', () => {
    expect(parseCliArgs(['baseline']).command).toBe('baseline')
    expect(parseCliArgs(['analyze', '--slow', '200']).command).toBe('analyze')
    expect(parseCliArgs(['prune', '--clean-baseline']).command).toBe('prune')
    expect(parseCliArgs(['prune', '--clean-baseline']).cleanBaseline).toBe(true)
    expect(parseCliArgs(['help']).command).toBe('help')
    expect(parseCliArgs(['-v']).command).toBe('version')
  })

  it('parses max-history and git tracking flags', () => {
    const parsed = parseCliArgs(['run', '--max-history', '50', '--no-git'])
    expect(parsed.config.maxHistoryEntries).toBe(50)
    expect(parsed.config.trackGit).toBe(false)
  })

  it('collects pass-through vitest arguments', () => {
    const args = ['run', '--slow', '300', '--', '-t', 'auth']
    const parsed = parseCliArgs(args)

    expect(parsed.vitestArgs).toContain('-t')
    expect(parsed.vitestArgs).toContain('auth')
  })
})
