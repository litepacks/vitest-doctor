import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('Disk Cache Manager (File I/O Demo)', () => {
  it('writes and reads synchronous cache files repeatedly', () => {
    const tmpFile = path.join(os.tmpdir(), `vitest-doctor-demo-${Date.now()}.tmp`)
    const data = Buffer.alloc(1024 * 512, 'a') // 512KB

    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(tmpFile, data)
      const readBack = fs.readFileSync(tmpFile)
      expect(readBack.length).toBe(data.length)
    }

    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  })
})
