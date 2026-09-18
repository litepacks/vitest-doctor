import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import pc from 'picocolors'

interface BenchmarkResult {
  suite: string
  vanillaMs: number
  doctorMs: number
  overheadPercent: number
}

const SUITES = [
  'benchmarks/suites/fast-suite.test.ts',
  'benchmarks/suites/timer-heavy.test.ts',
  'benchmarks/suites/cpu-heavy.test.ts',
  'benchmarks/suites/hook-heavy.test.ts',
  'benchmarks/suites/import-heavy.test.ts'
]

function runVitest(args: string[]): number {
  const start = performance.now()
  execSync(`npx vitest run ${args.join(' ')}`, { stdio: 'ignore' })
  return performance.now() - start
}

async function runBenchmark(): Promise<void> {
  console.log(pc.bold(pc.cyan('\n🔬 Vitest Doctor Overhead Benchmark\n')))
  console.log(pc.dim('Measuring execution times with vitest-doctor reporter vs vanilla Vitest...\n'))

  const results: BenchmarkResult[] = []

  for (const suite of SUITES) {
    process.stdout.write(`Testing ${pc.yellow(suite)}... `)

    // Warm up run
    runVitest([suite])

    // Vanilla run
    const vanillaMs = runVitest([suite])

    // Doctor run
    const doctorMs = runVitest([suite, '--reporter=./dist/reporter/index.js'])

    const diff = doctorMs - vanillaMs
    const overheadPercent = Number(((diff / vanillaMs) * 100).toFixed(1))

    results.push({
      suite,
      vanillaMs: Math.round(vanillaMs),
      doctorMs: Math.round(doctorMs),
      overheadPercent
    })

    console.log(pc.green('Done!'))
  }

  console.log('\n' + pc.bold('Benchmark Results:'))
  console.log('─'.repeat(70))
  console.log(
    `${'Suite'.padEnd(40)} ${'Vanilla'.padEnd(10)} ${'Doctor'.padEnd(10)} ${'Overhead'}`
  )
  console.log('─'.repeat(70))

  for (const res of results) {
    const overheadStr = res.overheadPercent > 0 ? `+${res.overheadPercent}%` : `${res.overheadPercent}%`
    const overheadColor = res.overheadPercent <= 5 ? pc.green : (res.overheadPercent <= 15 ? pc.yellow : pc.red)

    console.log(
      `${res.suite.padEnd(40)} ${(res.vanillaMs + 'ms').padEnd(10)} ${(res.doctorMs + 'ms').padEnd(10)} ${overheadColor(overheadStr)}`
    )
  }
  console.log('─'.repeat(70) + '\n')
}

runBenchmark().catch(console.error)
