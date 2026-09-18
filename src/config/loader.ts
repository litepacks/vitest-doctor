import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { DoctorConfig } from '../types/index.js'
import { normalizeConfig } from './schema.js'

const CONFIG_CANDIDATES = [
  'vitest-doctor.config.ts',
  'vitest-doctor.config.js',
  'vitest-doctor.config.mjs',
  'vitest-doctor.config.cjs',
  'vitest-doctor.config.json',
  '.vitest-doctor.json'
]

export async function loadConfigFile(customPath?: string, cwd: string = process.cwd()): Promise<Partial<DoctorConfig>> {
  if (customPath) {
    const fullPath = path.isAbsolute(customPath) ? customPath : path.resolve(cwd, customPath)
    if (fs.existsSync(fullPath)) {
      return await importConfigFile(fullPath)
    }
    throw new Error(`Config file not found at: ${customPath}`)
  }

  for (const candidate of CONFIG_CANDIDATES) {
    const fullPath = path.resolve(cwd, candidate)
    if (fs.existsSync(fullPath)) {
      return await importConfigFile(fullPath)
    }
  }

  return {}
}

async function importConfigFile(filePath: string): Promise<Partial<DoctorConfig>> {
  if (filePath.endsWith('.json')) {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }

  try {
    const fileUrl = pathToFileURL(filePath).href
    // Add cache busting timestamp for dynamic reloads if needed
    const mod = await import(fileUrl)
    return (mod.default || mod) as Partial<DoctorConfig>
  } catch (err) {
    // If TS file cannot be imported natively in runtime, fallback to simple parsing or throw descriptive error
    console.warn(`[vitest-doctor] Warning: Failed to import config file at ${filePath}:`, err)
    return {}
  }
}

export async function resolveDoctorConfig(
  userOptions: Partial<DoctorConfig> = {},
  customConfigPath?: string,
  cwd: string = process.cwd()
): Promise<DoctorConfig & ReturnType<typeof normalizeConfig>> {
  const loaded = await loadConfigFile(customConfigPath, cwd)
  const merged = { ...loaded, ...userOptions, cwd }
  return normalizeConfig(merged)
}
