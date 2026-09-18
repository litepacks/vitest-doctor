import pc from 'picocolors'
import type { DoctorConfig } from '../../types/index.js'
import { resolveDoctorConfig } from '../../config/loader.js'
import { HistoryStore } from '../../history/store.js'

export interface PruneCommandOptions {
  cleanBaseline?: boolean
}

export async function pruneCommand(
  userConfig: Partial<DoctorConfig>,
  customConfigPath?: string,
  options: PruneCommandOptions = {},
  cwd = process.cwd()
): Promise<number> {
  const config = await resolveDoctorConfig(userConfig, customConfigPath, cwd)
  const store = new HistoryStore(config.historyPath, config.baselinePath, cwd, config.maxHistoryEntries)

  console.log(pc.cyan('🧹 Pruning stale test history and orphaned records...'))

  const result = store.prune({ pruneMissingFiles: true })

  if (result.prunedCount > 0) {
    console.log(pc.green(`✓ Successfully pruned ${pc.bold(result.prunedCount.toString())} stale test record(s).`))
    console.log(pc.dim(`  Remaining active test records: ${result.remainingCount}`))
  } else {
    console.log(pc.dim(`✓ No stale test records found in history (total: ${result.remainingCount} active records).`))
  }

  if (options.cleanBaseline) {
    const cleaned = store.cleanBaseline()
    if (cleaned) {
      console.log(pc.green(`✓ Baseline snapshot removed (${config.baselinePath || '.vitest-doctor/baseline.json'}).`))
    } else {
      console.log(pc.dim('• No baseline snapshot found to clean.'))
    }
  }

  return 0
}
