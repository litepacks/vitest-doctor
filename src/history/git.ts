import { execSync } from 'node:child_process'
import type { ExecSyncOptionsWithStringEncoding } from 'node:child_process'
import type { GitContext } from '../types/index.js'

/**
 * Extracts Git repository context (commit hash, branch, author, message)
 */
export function getGitContext(cwd = process.cwd()): GitContext | undefined {
  try {
    const execOptions: ExecSyncOptionsWithStringEncoding = {
      cwd,
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8'
    }

    // 1. Commit Hash
    const commitHash = execSync('git rev-parse HEAD', execOptions).trim()
    if (!commitHash) return undefined

    const commitShortHash = execSync('git rev-parse --short HEAD', execOptions).trim()

    // 2. Branch Name (Check git first, fallback to CI environment variables)
    let branch = ''
    try {
      branch = execSync('git branch --show-current', execOptions).trim()
      if (!branch || branch === 'HEAD') {
        branch = execSync('git rev-parse --abbrev-ref HEAD', execOptions).trim()
      }
    } catch {
      // ignore
    }

    if (!branch || branch === 'HEAD') {
      branch =
        process.env.GITHUB_HEAD_REF ||
        process.env.GITHUB_REF_NAME ||
        process.env.CI_COMMIT_REF_NAME ||
        process.env.GIT_BRANCH ||
        process.env.BRANCH_NAME ||
        'HEAD'
    }

    // 3. Last Commit Metadata: Author, Message, Timestamp
    let author: string | undefined
    let message: string | undefined
    let timestamp: string | undefined

    try {
      const logOutput = execSync('git log -1 --pretty=format:"%an\t%s\t%cI"', execOptions).trim()
      if (logOutput) {
        const [a, m, t] = logOutput.split('\t')
        author = a || undefined
        message = m || undefined
        timestamp = t || undefined
      }
    } catch {
      // ignore
    }

    return {
      commitHash,
      commitShortHash,
      branch,
      author,
      message,
      timestamp
    }
  } catch {
    return undefined
  }
}
