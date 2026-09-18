import type { DoctorReport } from '../types/index.js'

export class JsonFormatter {
  public format(report: DoctorReport, pretty = true): string {
    return JSON.stringify(report, null, pretty ? 2 : undefined)
  }
}
