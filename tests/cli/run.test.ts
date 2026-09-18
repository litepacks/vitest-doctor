import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import { findVitestBinary } from '../../src/cli/commands/run.js'

describe('CLI Run Command & Binary Resolution', () => {
  it('finds local vitest binary in project root', () => {
    const rootDir = process.cwd()
    const bin = findVitestBinary(rootDir)
    expect(bin).not.toBeNull()
    expect(fs.existsSync(bin!)).toBe(true)
    expect(bin).toContain('vitest')
  })

  it('walks up parent directories in monorepo structures', () => {
    const subDir = path.join(process.cwd(), 'examples/demo')
    const bin = findVitestBinary(subDir)
    expect(bin).not.toBeNull()
    expect(fs.existsSync(bin!)).toBe(true)
  })

  it('returns null gracefully when no vitest binary exists in hierarchy', () => {
    const tmpDir = path.parse(process.cwd()).root
    const bin = findVitestBinary(tmpDir)
    expect(bin).toBeNull()
  })
})
