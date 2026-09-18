import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import type { DoctorConfig, TestProfile } from '../../types/index.js'
import { resolveDoctorConfig } from '../../config/loader.js'
import { StaticAnalyzer } from '../../analyzers/static-analyzer.js'
import { CauseEngine } from '../../analyzers/cause-engine.js'
import { TerminalFormatter } from '../../output/terminal-formatter.js'
import { computeStatistics } from '../../scoring/statistics.js'
import { HistoryStore } from '../../history/store.js'

export async function analyzeCommand(
  userConfig: Partial<DoctorConfig>,
  customConfigPath?: string,
  cwd = process.cwd()
): Promise<number> {
  const config = await resolveDoctorConfig(userConfig, customConfigPath, cwd)
  console.log(pc.cyan('🔬 Analyzing test suite static structures & historical metrics...'))

  const staticAnalyzer = new StaticAnalyzer()
  const causeEngine = new CauseEngine()
  const historyStore = new HistoryStore(config.historyPath, config.baselinePath, cwd)
  const history = historyStore.loadHistory()

  const testProfiles: TestProfile[] = []

  // Check historical tests or scan files
  const historyTestList = Object.values(history.tests)

  if (historyTestList.length > 0) {
    for (const rec of historyTestList) {
      const findings = staticAnalyzer.analyzeFile(rec.file)
      const profile: TestProfile = {
        id: rec.id,
        name: rec.name,
        file: rec.file,
        suitePath: rec.suitePath,
        duration: rec.medianDuration,
        signals: {
          staticFindings: findings
        }
      }
      profile.diagnoses = causeEngine.diagnose(profile, config)
      testProfiles.push(profile)
    }
  } else {
    // Scan test files in cwd
    console.log(pc.yellow('No history found. Scanning directory for test files...'))
    const testFiles = findTestFiles(cwd)
    for (const file of testFiles) {
      const findings = staticAnalyzer.analyzeFile(file)
      const profile: TestProfile = {
        id: `${file}::static-scan`,
        name: path.basename(file),
        file,
        duration: 0,
        signals: {
          staticFindings: findings
        }
      }
      profile.diagnoses = causeEngine.diagnose(profile, config)
      if (profile.diagnoses.length > 0) {
        testProfiles.push(profile)
      }
    }
  }

  const durations = testProfiles.map(t => t.duration)
  const stats = computeStatistics(durations)
  const suspiciousTests = testProfiles.filter(t => (t.diagnoses && t.diagnoses.length > 0) || t.duration >= (config.slow ?? 500))

  const formatter = new TerminalFormatter(config)
  const output = formatter.format({
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    stats,
    tests: testProfiles,
    suspiciousTests,
    files: {},
    summary: {
      totalTests: testProfiles.length,
      totalDuration: stats.totalDuration,
      suspiciousCount: suspiciousTests.length,
      categoryCounts: {
        'slow-before-each': 0,
        'slow-before-all': 0,
        'slow-after-each': 0,
        'slow-import': 0,
        'slow-environment': 0,
        'slow-setup': 0,
        'cpu-bound': 0,
        'event-loop-blocked': 0,
        'timer-wait': 0,
        'network-io': 0,
        'filesystem-io': 0,
        'child-process': 0,
        'memory-pressure': 0,
        'gc-pressure': 0,
        'polling': 0,
        'retry': 0,
        'serial-async-execution': 0,
        'worker-initialization-overhead': 0,
        'module-reset-churn': 0,
        'unused-global-setup': 0,
        'worker-tail-latency': 0,
        'dom-leak-accumulation': 0,
        'oversized-snapshot': 0,
        'resource-contention': 0,
        'monotonic-heap-leak': 0,
        'retained-mock-calls': 0,
        'unbounded-event-listeners': 0,
        'global-state-pollution': 0,
        'large-fixture-retention': 0,
        'dangling-async-closure': 0,
        'gc-thrashing': 0,
        'heap-space-exhaustion': 0,
        'barrel-import-churn': 0,
        'unawaited-promise': 0,
        'unrestored-fake-timers': 0,
        'unknown': 0
      },
      estimatedAvoidableMs: 0
    }
  })

  console.log(output)
  return 0
}

function findTestFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findTestFiles(fullPath, fileList)
    } else if (/\.(test|spec)\.(ts|js|mjs|tsx|jsx)$/.test(entry.name)) {
      fileList.push(fullPath)
    }
  }
  return fileList
}
