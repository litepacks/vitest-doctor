import type { DoctorConfig } from '../types/index.js'
import { DEFAULT_CONFIG } from './defaults.js'

export function normalizeConfig(userConfig: Partial<DoctorConfig> = {}): DoctorConfig & typeof DEFAULT_CONFIG {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    slow: typeof userConfig.slow === 'number' && userConfig.slow > 0 ? userConfig.slow : DEFAULT_CONFIG.slow,
    verySlow: typeof userConfig.verySlow === 'number' && userConfig.verySlow > 0 ? userConfig.verySlow : DEFAULT_CONFIG.verySlow,
    relative: userConfig.relative ?? DEFAULT_CONFIG.relative,
    medianMultiplier: typeof userConfig.medianMultiplier === 'number' && userConfig.medianMultiplier > 0 ? userConfig.medianMultiplier : DEFAULT_CONFIG.medianMultiplier,
    madMultiplier: typeof userConfig.madMultiplier === 'number' && userConfig.madMultiplier > 0 ? userConfig.madMultiplier : DEFAULT_CONFIG.madMultiplier,
    top: typeof userConfig.top === 'number' && userConfig.top > 0 ? userConfig.top : DEFAULT_CONFIG.top,
    profile: userConfig.profile ?? DEFAULT_CONFIG.profile,
    history: userConfig.history ?? DEFAULT_CONFIG.history,
    historyPath: userConfig.historyPath || DEFAULT_CONFIG.historyPath,
    baselinePath: userConfig.baselinePath || DEFAULT_CONFIG.baselinePath,
    regressionThreshold: typeof userConfig.regressionThreshold === 'number' ? userConfig.regressionThreshold : DEFAULT_CONFIG.regressionThreshold,
    ci: userConfig.ci ?? DEFAULT_CONFIG.ci,
    budgets: userConfig.budgets ? { ...userConfig.budgets } : DEFAULT_CONFIG.budgets,
    githubSummary: userConfig.githubSummary ?? DEFAULT_CONFIG.githubSummary,
    output: userConfig.output ?? DEFAULT_CONFIG.output,
    reporter: userConfig.reporter ?? DEFAULT_CONFIG.reporter,
    ignore: Array.isArray(userConfig.ignore) ? userConfig.ignore : DEFAULT_CONFIG.ignore,
    staticAnalysis: userConfig.staticAnalysis ?? DEFAULT_CONFIG.staticAnalysis,
    cwd: userConfig.cwd || DEFAULT_CONFIG.cwd,
    showOverhead: userConfig.showOverhead ?? DEFAULT_CONFIG.showOverhead,
    maxHistoryEntries: typeof userConfig.maxHistoryEntries === 'number'
      ? userConfig.maxHistoryEntries
      : (typeof userConfig.maxRunsPerTest === 'number' ? userConfig.maxRunsPerTest : DEFAULT_CONFIG.maxHistoryEntries),
    trackGit: userConfig.trackGit ?? DEFAULT_CONFIG.trackGit
  }
}
