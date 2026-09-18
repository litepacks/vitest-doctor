import type { DoctorConfig } from '../types/index.js'

export const DEFAULT_CONFIG: Required<Omit<DoctorConfig, 'output' | 'ignore' | 'budgets' | 'maxRunsPerTest'>> & {
  output: string | undefined
  ignore: string[]
  budgets: DoctorConfig['budgets']
  maxRunsPerTest: number
} = {
  slow: 500,
  verySlow: 1500,
  relative: true,
  medianMultiplier: 5,
  madMultiplier: 3.5,
  top: 20,
  profile: 'auto',
  history: true,
  historyPath: '.vitest-doctor/history.json',
  baselinePath: '.vitest-doctor/baseline.json',
  regressionThreshold: 0.5,
  ci: false,
  budgets: undefined,
  githubSummary: true,
  output: undefined,
  reporter: 'terminal',
  ignore: [],
  staticAnalysis: true,
  cwd: process.cwd(),
  showOverhead: false,
  maxHistoryEntries: 20,
  maxRunsPerTest: 20,
  trackGit: true
}

