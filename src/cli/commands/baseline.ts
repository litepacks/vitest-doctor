import pc from 'picocolors'
import type { DoctorConfig } from '../../types/index.js'
import { resolveDoctorConfig } from '../../config/loader.js'
import { HistoryStore } from '../../history/store.js'
import { runCommand } from './run.js'

export async function baselineCommand(
  userConfig: Partial<DoctorConfig>,
  customConfigPath?: string,
  vitestArgs: string[] = [],
  cwd = process.cwd()
): Promise<number> {
  const config = await resolveDoctorConfig(userConfig, customConfigPath, cwd)
  console.log(pc.cyan('📌 Capturing current test suite performance as baseline...'))

  const exitCode = await runCommand(userConfig, customConfigPath, vitestArgs, cwd)
  if (exitCode === 0) {
    const store = new HistoryStore(config.historyPath, config.baselinePath, cwd)
    const history = store.loadHistory()
    const tests = Object.values(history.tests).map(t => ({
      id: t.id,
      name: t.name,
      file: t.file,
      suitePath: t.suitePath,
      duration: t.medianDuration
    }))

    store.saveBaseline(tests)
    console.log(pc.green(`✓ Baseline successfully saved to ${config.baselinePath || '.vitest-doctor/baseline.json'}`))
  } else {
    console.error(pc.red(`✗ Failed to record baseline because tests failed with exit code ${exitCode}`))
  }

  return exitCode
}
