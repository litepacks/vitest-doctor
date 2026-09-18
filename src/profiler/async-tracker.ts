import async_hooks from 'node:async_hooks'
import type { AsyncResourceStats } from '../types/index.js'

export class AsyncTracker {
  private hook: async_hooks.AsyncHook | null = null
  private createdCounts: Record<string, number> = {}
  private activeCounts: Record<string, number> = {}
  private destroyedCounts: Record<string, number> = {}
  private startTimes: Map<number, number> = new Map()
  private maxDurations: Record<string, number> = {}
  private resourceTypes: Map<number, string> = new Map()
  private isTracking = false

  public start(): void {
    if (this.isTracking) return
    this.reset()
    this.isTracking = true

    this.hook = async_hooks.createHook({
      init: (asyncId, type) => {
        if (!this.isTracking) return
        this.createdCounts[type] = (this.createdCounts[type] || 0) + 1
        this.activeCounts[type] = (this.activeCounts[type] || 0) + 1
        this.startTimes.set(asyncId, performance.now())
        this.resourceTypes.set(asyncId, type)
      },
      destroy: (asyncId) => {
        if (!this.isTracking) return
        const type = this.resourceTypes.get(asyncId)
        if (type) {
          this.activeCounts[type] = Math.max(0, (this.activeCounts[type] || 0) - 1)
          this.destroyedCounts[type] = (this.destroyedCounts[type] || 0) + 1

          const startTime = this.startTimes.get(asyncId)
          if (startTime) {
            const duration = performance.now() - startTime
            this.maxDurations[type] = Math.max(this.maxDurations[type] || 0, duration)
            this.startTimes.delete(asyncId)
          }
          this.resourceTypes.delete(asyncId)
        }
      }
    })

    this.hook.enable()
  }

  public stop(): AsyncResourceStats {
    if (this.hook) {
      this.hook.disable()
      this.hook = null
    }
    this.isTracking = false

    const stats: AsyncResourceStats = {
      createdCounts: { ...this.createdCounts },
      activeCounts: { ...this.activeCounts },
      destroyedCounts: { ...this.destroyedCounts },
      maxDurations: { ...this.maxDurations }
    }

    this.reset()
    return stats
  }

  public reset(): void {
    this.createdCounts = {}
    this.activeCounts = {}
    this.destroyedCounts = {}
    this.startTimes.clear()
    this.maxDurations = {}
    this.resourceTypes.clear()
  }
}
