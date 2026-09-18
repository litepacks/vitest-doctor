import { defineConfig } from 'vitest/config'
import { vitestDoctor } from '../../dist/index.js'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: [
      'default',
      vitestDoctor({
        slow: 250,
        verySlow: 800,
        relative: true,
        medianMultiplier: 3.5,
        top: 10,
        showOverhead: true
      })
    ]
  }
})
