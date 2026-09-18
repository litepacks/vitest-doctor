import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'reporter/index': 'src/reporter/index.ts',
    plugin: 'src/plugin.ts',
    setup: 'src/setup.ts',
    'cli/index': 'src/cli/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['typescript', 'vitest'],
  target: 'node20'
})
