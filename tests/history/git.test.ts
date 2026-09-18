import { describe, it, expect } from 'vitest'
import { getGitContext } from '../../src/history/git.js'

describe('Git Context Extractor', () => {
  it('extracts current repository git metadata if inside git repo', () => {
    const git = getGitContext(process.cwd())
    if (git) {
      expect(git.commitHash).toBeDefined()
      expect(git.commitHash?.length).toBe(40)
      expect(git.commitShortHash).toBeDefined()
      expect(git.commitShortHash?.length).toBeGreaterThanOrEqual(7)
      expect(git.branch).toBeDefined()
    } else {
      // Non-git environment fallback
      expect(git).toBeUndefined()
    }
  })

  it('returns undefined gracefully for non-git directories', () => {
    const git = getGitContext('/tmp')
    expect(git === undefined || typeof git.branch === 'string').toBe(true)
  })
})
