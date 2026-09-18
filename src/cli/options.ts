import type { DoctorConfig, OutputFormat, ProfileMode } from '../types/index.js'

export interface ParsedCliArgs {
  command: 'run' | 'analyze' | 'baseline' | 'prune' | 'help' | 'version'
  config: Partial<DoctorConfig>
  customConfigPath?: string
  vitestArgs: string[]
  cleanBaseline?: boolean
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  const config: Partial<DoctorConfig> = {}
  const vitestArgs: string[] = []
  let command: ParsedCliArgs['command'] = 'run'
  let customConfigPath: string | undefined
  let cleanBaseline = false

  let i = 0
  // First arg could be a subcommand
  if (args.length > 0 && !args[0].startsWith('-')) {
    const maybeCmd = args[0].toLowerCase()
    if (['run', 'analyze', 'baseline', 'prune', 'help', 'version'].includes(maybeCmd)) {
      command = maybeCmd as ParsedCliArgs['command']
      i = 1
    }
  }

  for (; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      command = 'help'
    } else if (arg === '--version' || arg === '-v') {
      command = 'version'
    } else if (arg === '--clean-baseline' || arg === '--clean') {
      cleanBaseline = true
    } else if (arg === '--max-history') {
      config.maxHistoryEntries = Number(args[++i])
    } else if (arg === '--no-git') {
      config.trackGit = false
    } else if (arg === '--doctor-config') {
      customConfigPath = args[++i]
    } else if (arg === '--config' || arg === '-c') {
      const nextVal = args[++i]
      if (nextVal && (nextVal.includes('vitest-doctor') || nextVal.endsWith('.json'))) {
        customConfigPath = nextVal
      } else {
        // Forward vitest.config.* to vitest
        vitestArgs.push('--config', nextVal)
      }
    } else if (arg === '--slow') {
      config.slow = Number(args[++i])
    } else if (arg === '--verySlow' || arg === '--very-slow') {
      config.verySlow = Number(args[++i])
    } else if (arg === '--relative') {
      config.relative = args[i + 1] === 'false' ? false : true
      if (args[i + 1] === 'false' || args[i + 1] === 'true') i++
    } else if (arg === '--no-relative') {
      config.relative = false
    } else if (arg === '--top') {
      config.top = Number(args[++i])
    } else if (arg === '--profile') {
      config.profile = args[++i] as ProfileMode
    } else if (arg === '--ci') {
      config.ci = true
    } else if (arg === '--max-total-duration' || arg === '--budget') {
      config.budgets = config.budgets || {}
      config.budgets.maxTotalDurationMs = Number(args[++i])
    } else if (arg === '--max-slow-tests') {
      config.budgets = config.budgets || {}
      config.budgets.maxSlowTests = Number(args[++i])
    } else if (arg === '--max-suspicious-tests') {
      config.budgets = config.budgets || {}
      config.budgets.maxSuspiciousTests = Number(args[++i])
    } else if (arg === '--fail-on-regression') {
      config.budgets = config.budgets || {}
      config.budgets.failOnRegressionPercent = Number(args[++i])
    } else if (arg === '--fail-on-p95') {
      config.budgets = config.budgets || {}
      config.budgets.failOnP95Ms = Number(args[++i])
    } else if (arg === '--no-github-summary') {
      config.githubSummary = false
    } else if (arg === '--output' || arg === '-o') {
      config.output = args[++i]
    } else if (arg === '--reporter' || arg === '-r') {
      config.reporter = args[++i] as OutputFormat
    } else if (arg === '--ignore') {
      const val = args[++i]
      config.ignore = (config.ignore || []).concat(val.split(',').map(s => s.trim()))
    } else if (arg === '--show-overhead') {
      config.showOverhead = true
    } else {
      // Pass-through to vitest
      vitestArgs.push(arg)
    }
  }

  return {
    command,
    config,
    customConfigPath,
    vitestArgs,
    cleanBaseline
  }
}
