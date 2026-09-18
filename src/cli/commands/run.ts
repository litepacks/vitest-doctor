import fs from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import pc from 'picocolors'
import type { DoctorConfig } from '../../types/index.js'
import { resolveDoctorConfig } from '../../config/loader.js'
import { RegressionDetector } from '../../history/regression.js'

export async function runCommand(
  userConfig: Partial<DoctorConfig>,
  customConfigPath?: string,
  vitestArgs: string[] = [],
  cwd = process.cwd()
): Promise<number> {
  const config = await resolveDoctorConfig(userConfig, customConfigPath, cwd)

  console.log(pc.cyan(`🩺 Running Vitest with vitest-doctor diagnostics...`))

  // Determine reporter path
  const reporterPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../reporter/index.js'
  )

  const args = ['run', ...vitestArgs]

  // Add doctor reporter if not already in args
  if (!args.some(a => a.includes('--reporter') || a.includes('-r'))) {
    // In Vitest CLI, reporter can be a file path
    args.push('--reporter=default')
    args.push(`--reporter=${reporterPath}`)
  }

  // Pass configuration via environment variable for the reporter instance
  const env = {
    ...process.env,
    VITEST_DOCTOR_CONFIG: JSON.stringify(config)
  }

  return new Promise<number>((resolve) => {
    // Find vitest executable in local node_modules or npx
    const localVitestBin = path.resolve(cwd, 'node_modules/.bin/vitest')
    let cmd = localVitestBin
    let spawnArgs = args

    if (!fs.existsSync(localVitestBin)) {
      cmd = 'npx'
      spawnArgs = ['vitest', ...args]
    }

    const isWindows = process.platform === 'win32'
    const child = spawn(cmd, spawnArgs, {
      cwd,
      env,
      stdio: 'inherit',
      shell: isWindows
    })

    child.on('error', (err) => {
      console.error(pc.red(`Failed to start Vitest: ${err.message}`))
      resolve(1)
    })

    child.on('close', (code) => {
      let exitCode = code ?? 0

      // If CI mode is enabled, verify regressions and baseline health
      if (config.ci && exitCode === 0) {
        const regressionDetector = new RegressionDetector(config, cwd)
        const baseline = regressionDetector.getStore().loadBaseline()
        if (baseline) {
          console.log(pc.cyan('🔍 Vitest Doctor CI Check completed.'))
        }
      }

      resolve(exitCode)
    })
  })
}
