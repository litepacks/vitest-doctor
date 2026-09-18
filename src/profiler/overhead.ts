import { performance } from 'node:perf_hooks'

export class OverheadTracker {
  private totalDoctorMs = 0
  private activeStartTime: number | null = null

  public startMeasure(): void {
    this.activeStartTime = performance.now()
  }

  public endMeasure(): void {
    if (this.activeStartTime !== null) {
      this.totalDoctorMs += performance.now() - this.activeStartTime
      this.activeStartTime = null
    }
  }

  public track<T>(fn: () => T): T {
    const start = performance.now()
    try {
      return fn()
    } finally {
      this.totalDoctorMs += performance.now() - start
    }
  }

  public async trackAsync<T>(fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      return await fn()
    } finally {
      this.totalDoctorMs += performance.now() - start
    }
  }

  public getTotalOverheadMs(): number {
    return this.totalDoctorMs
  }

  public calculateOverheadPercentage(totalSuiteDurationMs: number): number {
    if (totalSuiteDurationMs <= 0) return 0
    return (this.totalDoctorMs / totalSuiteDurationMs) * 100
  }

  public reset(): void {
    this.totalDoctorMs = 0
    this.activeStartTime = null
  }
}
