import path from 'node:path'

/**
 * Creates canonical test identifier combining relative file path, suite hierarchy, and test name
 */
export function getTestIdentity(
  filePath: string,
  suitePath: string[] = [],
  testName: string,
  cwd: string = process.cwd()
): string {
  const relativeFile = path.isAbsolute(filePath)
    ? path.relative(cwd, filePath)
    : filePath

  const cleanFile = relativeFile.replace(/\\/g, '/')
  const cleanSuite = suitePath.filter(Boolean).join(' > ')
  return cleanSuite
    ? `${cleanFile}::${cleanSuite}::${testName}`
    : `${cleanFile}::${testName}`
}
