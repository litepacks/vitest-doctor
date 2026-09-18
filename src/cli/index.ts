#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pc from 'picocolors'
import { parseCliArgs } from './options.js'
import { runCommand } from './commands/run.js'
import { analyzeCommand } from './commands/analyze.js'
import { baselineCommand } from './commands/baseline.js'
import { pruneCommand } from './commands/prune.js'

function getVersion(): string {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const pkgPath = path.resolve(dir, '../../package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return pkg.version || '0.4.3'
    }
  } catch {}
  return '0.4.3'
}

function printHelp(): void {
  console.log(`
${pc.bold(pc.cyan('vitest-doctor'))} - Low-overhead performance diagnostics for Vitest

${pc.bold('USAGE:')}
  $ ${pc.green('vitest-doctor')} [command] [options] [-- vitest-options]

${pc.bold('COMMANDS:')}
  ${pc.yellow('run')}       Run Vitest with doctor diagnostics reporter (default)
  ${pc.yellow('analyze')}   Analyze test file static structures and historical records
  ${pc.yellow('baseline')}  Capture current test run as performance baseline snapshot
  ${pc.yellow('prune')}     Prune orphaned test history and stale records
  ${pc.yellow('help')}      Show this help message
  ${pc.yellow('version')}   Show version number

${pc.bold('OPTIONS:')}
  ${pc.dim('-c, --config <file>')}       Custom path to vitest-doctor configuration
  ${pc.dim('--slow <ms>')}               Absolute threshold for slow test detection (default: 500)
  ${pc.dim('--verySlow <ms>')}           Absolute threshold for very slow test detection (default: 1500)
  ${pc.dim('--relative <bool>')}         Enable/disable relative anomaly detection (default: true)
  ${pc.dim('--top <number>')}            Limit number of top suspicious tests shown (default: 20)
  ${pc.dim('--profile <mode>')}          Profiling mode: auto | always | off (default: auto)
  ${pc.dim('--ci')}                      Exit with code 1 on severe regressions or new very slow tests
  ${pc.dim('--clean-baseline')}          Remove baseline snapshot during prune
  ${pc.dim('--max-history <n>')}         Maximum number of historical runs per test (default: 20)
  ${pc.dim('--no-git')}                  Disable automatic Git commit/branch context extraction
  ${pc.dim('-o, --output <file>')}       Write report to JSON/Markdown file (e.g. doctor.json)
  ${pc.dim('-r, --reporter <format>')}   Output format: terminal | json | markdown (default: terminal)
  ${pc.dim('--ignore <pattern>')}        Ignore test files/names (comma-separated globs)
  ${pc.dim('--show-overhead')}           Display doctor profiler overhead in summary
  ${pc.dim('-h, --help')}                Show help
  ${pc.dim('-v, --version')}             Show version

${pc.bold('EXAMPLES:')}
  $ ${pc.cyan('npx vitest-doctor')}
  $ ${pc.cyan('npx vitest-doctor run --slow 300 --output doctor.json')}
  $ ${pc.cyan('npx vitest-doctor baseline')}
  $ ${pc.cyan('npx vitest-doctor prune --clean-baseline')}
  $ ${pc.cyan('npx vitest-doctor run --ci')}
`)
}

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2))

  if (parsed.command === 'help') {
    printHelp()
    process.exit(0)
  }

  if (parsed.command === 'version') {
    console.log(`vitest-doctor v${getVersion()}`)
    process.exit(0)
  }

  try {
    let exitCode = 0
    switch (parsed.command) {
      case 'run':
        exitCode = await runCommand(parsed.config, parsed.customConfigPath, parsed.vitestArgs)
        break
      case 'analyze':
        exitCode = await analyzeCommand(parsed.config, parsed.customConfigPath)
        break
      case 'baseline':
        exitCode = await baselineCommand(parsed.config, parsed.customConfigPath, parsed.vitestArgs)
        break
      case 'prune':
        exitCode = await pruneCommand(parsed.config, parsed.customConfigPath, { cleanBaseline: parsed.cleanBaseline })
        break
    }
    process.exit(exitCode)
  } catch (err) {
    console.error(pc.red(`\n[vitest-doctor] Error: ${(err as Error).message}\n`))
    process.exit(1)
  }
}

main()
