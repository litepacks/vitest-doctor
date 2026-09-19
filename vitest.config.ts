import { defineConfig } from 'vitest/config'
import { vitestDoctor } from './src/index.js'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'fixtures', 'examples', 'benchmarks'],
    reporters: [
      'default',
      vitestDoctor({
        output: 'doctor.html',
        slow: 300,
        verySlow: 1000,
        top: 10
      })
    ],
    poolOptions: {
      threads: { isolate: false },
      forks: { isolate: false }
    },
  },
})
