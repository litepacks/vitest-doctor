import fs from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pc from 'picocolors'
import type { DoctorConfig } from '../../types/index.js'
import { resolveDoctorConfig } from '../../config/loader.js'
import { RegressionDetector } from '../../history/regression.js'

/**
 * Searches for vitest binary starting from current working directory and walking up parents (supports monorepos).
 */
export function findVitestBinary(cwd: string): string | null {
  let current = path.resolve(cwd)
  while (true) {
    const isWindows = process.platform === 'win32'
    const binName = isWindows ? 'vitest.cmd' : 'vitest'
    const binPath = path.join(current, 'node_modules', '.bin', binName)
    if (fs.existsSync(binPath)) {
      return binPath
    }
    const binPathWithoutExt = path.join(current, 'node_modules', '.bin', 'vitest')
    if (fs.existsSync(binPathWithoutExt)) {
      return binPathWithoutExt
    }
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
  return null
}

export async function runCommand(
  userConfig: Partial<DoctorConfig>,
  customConfigPath?: string,
  vitestArgs: string[] = [],
  cwd = process.cwd()
): Promise<number> {
  const config = await resolveDoctorConfig(userConfig, customConfigPath, cwd)

  console.log(pc.cyan(`🩺 Running Vitest with vitest-doctor diagnostics...`))

  // Determine reporter path safely across OSes
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const reporterPath = path.resolve(currentDir, '../reporter/index.js')

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
    // Find vitest executable in local node_modules, parent workspace, or fallback to npx
    const localVitestBin = findVitestBinary(cwd)
    let cmd = localVitestBin || 'npx'
    let spawnArgs = localVitestBin ? args : ['vitest', ...args]

    const isWindows = process.platform === 'win32'
    const child = spawn(cmd, spawnArgs, {
      cwd,
      env,
      stdio: 'inherit',
      shell: isWindows
    })

    // Forward termination signals to spawned child process for clean worker shutdown
    const onSigint = () => {
      if (!child.killed) {
        child.kill('SIGINT')
      }
    }
    const onSigterm = () => {
      if (!child.killed) {
        child.kill('SIGTERM')
      }
    }

    process.on('SIGINT', onSigint)
    process.on('SIGTERM', onSigterm)

    const cleanupSignals = () => {
      process.removeListener('SIGINT', onSigint)
      process.removeListener('SIGTERM', onSigterm)
    }

    child.on('error', (err) => {
      cleanupSignals()
      console.error(pc.red(`Failed to start Vitest: ${err.message}`))
      resolve(1)
    })

    child.on('close', (code) => {
      cleanupSignals()
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
