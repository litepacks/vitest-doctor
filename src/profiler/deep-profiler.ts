import v8 from 'node:v8'
import { monitorEventLoopDelay, PerformanceObserver, performance } from 'node:perf_hooks'
import type { EventLoopUtilization } from 'node:perf_hooks'
import type { RuntimeSignals } from '../types/index.js'
import { AsyncTracker } from './async-tracker.js'

type EventLoopMonitorType = ReturnType<typeof monitorEventLoopDelay>

export class DeepProfiler {
  private asyncTracker = new AsyncTracker()
  private startCpu: NodeJS.CpuUsage | null = null
  private startMemory: NodeJS.MemoryUsage | null = null
  private startELU: EventLoopUtilization | null = null
  private eventLoopMonitor: EventLoopMonitorType | null = null
  private gcObserver: PerformanceObserver | null = null
  private gcDurationMs = 0
  private gcCount = 0
  private startGlobalKeys = new Set<string>()
  private startProcessListeners = 0
  private startTime = 0
  private isProfiling = false

  public start(): void {
    if (this.isProfiling) return
    this.isProfiling = true

    this.startTime = performance.now()
    this.startCpu = process.cpuUsage()
    this.startMemory = process.memoryUsage()
    this.gcDurationMs = 0
    this.gcCount = 0

    // Capture global keys
    try {
      this.startGlobalKeys = new Set(Object.keys(globalThis))
    } catch {
      this.startGlobalKeys = new Set()
    }

    // Process listeners count
    try {
      this.startProcessListeners = process.eventNames().reduce((acc, name) => acc + process.listenerCount(name), 0)
    } catch {
      this.startProcessListeners = 0
    }

    try {
      this.startELU = performance.eventLoopUtilization()
    } catch {
      this.startELU = null
    }

    try {
      this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 10 })
      this.eventLoopMonitor.enable()
    } catch {
      this.eventLoopMonitor = null
    }

    // GC Observer
    try {
      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        for (const entry of entries) {
          this.gcDurationMs += entry.duration
          this.gcCount += 1
        }
      })
      this.gcObserver.observe({ entryTypes: ['gc'] })
    } catch {
      this.gcObserver = null
    }

    this.asyncTracker.start()
  }

  public stop(): RuntimeSignals {
    const durationMs = Math.max(1, performance.now() - this.startTime)
    const asyncStats = this.asyncTracker.stop()

    if (this.gcObserver) {
      try {
        this.gcObserver.disconnect()
      } catch {
        // Disconnect safely
      }
      this.gcObserver = null
    }

    let cpuUserMs = 0
    let cpuSystemMs = 0
    let cpuPercent = 0
    if (this.startCpu) {
      const cpuDiff = process.cpuUsage(this.startCpu)
      cpuUserMs = cpuDiff.user / 1000
      cpuSystemMs = cpuDiff.system / 1000
      const totalCpuMs = cpuUserMs + cpuSystemMs
      cpuPercent = (totalCpuMs / durationMs) * 100
    }

    let elu = 0
    if (this.startELU) {
      try {
        const eluDiff = performance.eventLoopUtilization(this.startELU)
        elu = eluDiff.utilization
      } catch {
        elu = 0
      }
    }

    let eventLoopDelayP99Ms = 0
    let eventLoopDelayMeanMs = 0
    if (this.eventLoopMonitor) {
      try {
        this.eventLoopMonitor.disable()
        eventLoopDelayP99Ms = this.eventLoopMonitor.percentile(99) / 1_000_000
        eventLoopDelayMeanMs = this.eventLoopMonitor.mean / 1_000_000
      } catch {
        // Fallback if monitor throws
      }
      this.eventLoopMonitor = null
    }

    let memoryDelta = 0
    let heapPeak = 0
    const beforeHeap = this.startMemory ? this.startMemory.heapUsed / (1024 * 1024) : 0
    if (this.startMemory) {
      const endMemory = process.memoryUsage()
      memoryDelta = (endMemory.heapUsed - this.startMemory.heapUsed) / (1024 * 1024) // in MB
      heapPeak = endMemory.heapUsed / (1024 * 1024)
    }

    // Global keys delta
    const globalKeysDelta: string[] = []
    try {
      const currentKeys = Object.keys(globalThis)
      for (const k of currentKeys) {
        if (!this.startGlobalKeys.has(k)) {
          globalKeysDelta.push(k)
        }
      }
    } catch {
      // Ignored
    }

    // Process listeners delta
    let listenersDelta = 0
    try {
      const currentListeners = process.eventNames().reduce((acc, name) => acc + process.listenerCount(name), 0)
      listenersDelta = Math.max(0, currentListeners - this.startProcessListeners)
    } catch {
      listenersDelta = 0
    }

    // V8 Heap stats
    let heapLimitMb = 0
    let heapUsedMb = heapPeak
    let heapUsageRatio = 0
    try {
      const heapStats = v8.getHeapStatistics()
      heapLimitMb = heapStats.heap_size_limit / (1024 * 1024)
      heapUsedMb = heapStats.used_heap_size / (1024 * 1024)
      if (heapLimitMb > 0) {
        heapUsageRatio = heapUsedMb / heapLimitMb
      }
    } catch {
      // Fallback
    }

    this.isProfiling = false
    this.startCpu = null
    this.startMemory = null
    this.startELU = null
    this.startGlobalKeys.clear()

    return {
      cpuUserMs,
      cpuSystemMs,
      cpuPercent,
      eventLoopUtilization: elu,
      eventLoopDelayP99Ms,
      eventLoopDelayMeanMs,
      asyncResources: asyncStats,
      gcDurationMs: this.gcDurationMs,
      gcCount: this.gcCount,
      globalKeysDelta,
      listenersDelta,
      heapUsageRatio,
      memory: {
        before: beforeHeap,
        after: heapPeak,
        delta: memoryDelta,
        peak: heapPeak,
        heapLimitMb,
        heapUsedMb,
        gcDurationMs: this.gcDurationMs,
        gcCount: this.gcCount,
        globalKeysDelta,
        listenersDelta
      }
    }
  }

  public async profileAsync<T>(fn: () => Promise<T>): Promise<{ result: T; signals: RuntimeSignals }> {
    this.start()
    try {
      const result = await fn()
      const signals = this.stop()
      return { result, signals }
    } catch (err) {
      this.stop()
      throw err
    }
  }
}
