import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type tsType from 'typescript'
import type { StaticFinding } from '../types/index.js'

let cachedTs: typeof tsType | null | undefined = undefined

/**
 * Safely resolves TypeScript compiler if available in user project or current runtime,
 * without making it a hard required dependency.
 */
export function getTypeScript(cwd?: string): typeof tsType | null {
  if (cachedTs !== undefined) {
    return cachedTs
  }

  // 1. Try resolving from target project cwd (node_modules/typescript)
  const targetCwd = cwd || process.cwd()
  try {
    const cwdReq = createRequire(path.join(targetCwd, 'package.json'))
    const loaded = cwdReq('typescript') as typeof tsType
    cachedTs = loaded
    return loaded
  } catch {}

  // 2. Try resolving from current file context
  try {
    const localReq = createRequire(import.meta.url)
    const loaded = localReq('typescript') as typeof tsType
    cachedTs = loaded
    return loaded
  } catch {}

  cachedTs = null
  return null
}

export function resetTypeScriptCache(): void {
  cachedTs = undefined
}

export class StaticAnalyzer {
  private cache = new Map<string, StaticFinding[]>()

  /**
   * Performs AST analysis on a test source file
   */
  public analyzeFile(filePath: string): StaticFinding[] {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!
    }

    if (!fs.existsSync(filePath)) {
      return []
    }

    try {
      const code = fs.readFileSync(filePath, 'utf-8')
      const findings = this.analyzeSourceCode(filePath, code)
      this.cache.set(filePath, findings)
      return findings
    } catch (err) {
      console.warn(`[vitest-doctor] AST analysis failed for ${filePath}:`, err)
      return []
    }
  }

  /**
   * Analyzes source code string using TypeScript AST parser (or regex fallback)
   */
  public analyzeSourceCode(filePath: string, code: string): StaticFinding[] {
    const ts = getTypeScript()
    if (!ts || typeof ts.createSourceFile !== 'function') {
      return this.fallbackRegexAnalysis(filePath, code)
    }

    const sourceFile = ts.createSourceFile(
      filePath,
      code,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )

    const findings: StaticFinding[] = []

    const visit = (node: tsType.Node) => {
      // 1. Call Expressions
      if (ts.isCallExpression(node)) {
        const expressionText = node.expression.getText(sourceFile)
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const line = pos.line + 1
        const column = pos.character + 1
        const snippet = node.getText(sourceFile).slice(0, 100)

        // Hooks
        if (['beforeEach', 'beforeAll', 'afterEach', 'afterAll'].includes(expressionText)) {
          findings.push({
            type: 'hook',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Timers & Delays
        else if (['setTimeout', 'setInterval', 'setImmediate', 'waitFor', 'sleep', 'delay'].includes(expressionText)) {
          findings.push({
            type: 'timer',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Fake Timers
        else if (
          expressionText.startsWith('vi.useFakeTimers') ||
          expressionText.startsWith('vi.useRealTimers') ||
          expressionText.startsWith('vi.advanceTimersByTime') ||
          expressionText.startsWith('vi.runAllTimers') ||
          expressionText.startsWith('jest.useFakeTimers')
        ) {
          findings.push({
            type: 'fake-timer',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Network
        else if (
          expressionText === 'fetch' ||
          expressionText === 'request' ||
          expressionText.startsWith('axios') ||
          expressionText.startsWith('http.get') ||
          expressionText.startsWith('http.request') ||
          expressionText.startsWith('https.get') ||
          expressionText.startsWith('https.request') ||
          expressionText.startsWith('supertest') ||
          expressionText.startsWith('undici')
        ) {
          findings.push({
            type: 'network',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // File I/O
        else if (
          expressionText.startsWith('fs.read') ||
          expressionText.startsWith('fs.write') ||
          expressionText.startsWith('fs.promises') ||
          expressionText.startsWith('fse.') ||
          expressionText.includes('readFileSync') ||
          expressionText.includes('writeFileSync')
        ) {
          findings.push({
            type: 'io',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Child process
        else if (
          expressionText === 'exec' ||
          expressionText === 'spawn' ||
          expressionText === 'execSync' ||
          expressionText === 'execFile' ||
          expressionText === 'fork' ||
          expressionText.startsWith('exec(') ||
          expressionText.startsWith('spawn(') ||
          expressionText.startsWith('execSync(') ||
          expressionText.startsWith('child_process')
        ) {
          findings.push({
            type: 'child-process',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Module Reset Churn
        else if (
          expressionText.includes('vi.resetModules') ||
          expressionText.includes('jest.resetModules') ||
          expressionText.includes('vi.doMock')
        ) {
          const resetMethod = expressionText.includes('vi.resetModules')
            ? 'vi.resetModules'
            : expressionText.includes('jest.resetModules')
              ? 'jest.resetModules'
              : 'vi.doMock'
          findings.push({
            type: 'module-reset',
            name: resetMethod,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Snapshot Matchers
        else if (
          expressionText.includes('toMatchSnapshot') ||
          expressionText.includes('toMatchInlineSnapshot') ||
          expressionText.includes('toThrowErrorMatchingSnapshot')
        ) {
          const snapshotMethod = expressionText.includes('toMatchInlineSnapshot')
            ? 'toMatchInlineSnapshot'
            : expressionText.includes('toThrowErrorMatchingSnapshot')
              ? 'toThrowErrorMatchingSnapshot'
              : 'toMatchSnapshot'
          findings.push({
            type: 'snapshot',
            name: snapshotMethod,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Database & ORM Operations
        else if (
          expressionText.startsWith('db.') ||
          expressionText.startsWith('db(') ||
          expressionText.startsWith('knex(') ||
          expressionText.startsWith('knex.') ||
          expressionText.startsWith('prisma.') ||
          expressionText.startsWith('sqlite.') ||
          expressionText.startsWith('sqlite3.') ||
          expressionText.startsWith('mongoose.') ||
          expressionText.startsWith('orm.') ||
          expressionText.includes('.transaction') ||
          expressionText.includes('.insert(') ||
          expressionText.includes('.update(') ||
          expressionText.includes('.delete(') ||
          expressionText.includes('.truncate(') ||
          expressionText.includes('.migrate.') ||
          expressionText.includes('.seed.')
        ) {
          findings.push({
            type: 'database-call',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Stateful Server / Supertest / HTTP integration
        else if (
          expressionText.startsWith('supertest(') ||
          expressionText.startsWith('request(app)') ||
          expressionText.startsWith('request(') ||
          expressionText.startsWith('agent(')
        ) {
          findings.push({
            type: 'stateful-op',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Concurrency
        else if (
          expressionText.includes('describe.concurrent') ||
          expressionText.includes('test.concurrent') ||
          expressionText.includes('it.concurrent') ||
          expressionText.includes('suite.concurrent')
        ) {
          findings.push({
            type: 'concurrent',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // DOM / Component Testing
        else if (
          expressionText === 'render' ||
          expressionText.startsWith('render(') ||
          expressionText.startsWith('screen.') ||
          expressionText.startsWith('cleanup') ||
          expressionText.startsWith('fireEvent.') ||
          expressionText.startsWith('userEvent.')
        ) {
          findings.push({
            type: 'dom-test',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Spy & Mock Creation
        else if (
          expressionText.includes('vi.spyOn') ||
          expressionText.includes('vi.fn') ||
          expressionText.includes('jest.spyOn') ||
          expressionText.includes('jest.fn')
        ) {
          findings.push({
            type: 'spy-mock',
            name: expressionText.includes('spyOn') ? 'spyOn' : 'fn',
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Event Listeners
        else if (
          expressionText.includes('.on') ||
          expressionText.includes('.addListener') ||
          expressionText.includes('.addEventListener') ||
          expressionText.includes('process.on')
        ) {
          findings.push({
            type: 'event-listener',
            name: expressionText,
            file: filePath,
            line,
            column,
            snippet
          })
        }

        // Async Test Function Declarations
        if (
          (expressionText === 'it' || expressionText === 'test' || expressionText.startsWith('it.') || expressionText.startsWith('test.')) &&
          node.arguments.length >= 2
        ) {
          const fnArg = node.arguments[1]
          if (
            (ts.isArrowFunction(fnArg) || ts.isFunctionExpression(fnArg)) &&
            fnArg.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)
          ) {
            findings.push({
              type: 'async-test',
              name: expressionText,
              file: filePath,
              line,
              column,
              snippet
            })
          }
        }
      }

      // 2. Global Scope Assignments
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const leftText = node.left.getText(sourceFile)
        if (leftText.startsWith('globalThis.') || leftText.startsWith('window.') || leftText.startsWith('global.')) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          findings.push({
            type: 'global-assignment',
            name: leftText,
            file: filePath,
            line: pos.line + 1,
            column: pos.character + 1,
            snippet: node.getText(sourceFile).slice(0, 100)
          })
        }
      }

      // 3. Import Declarations & Barrel Import Detection
      if (ts.isImportDeclaration(node)) {
        const specifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '')
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const line = pos.line + 1
        const column = pos.character + 1
        const snippet = node.getText(sourceFile).slice(0, 100)

        findings.push({
          type: 'import',
          name: specifier,
          file: filePath,
          line,
          column,
          snippet
        })

        // Check if import is a barrel file
        const isBarrel =
          specifier.endsWith('/index') ||
          specifier.endsWith('/index.js') ||
          specifier.endsWith('/index.ts') ||
          specifier === '.' ||
          specifier === '..' ||
          specifier.endsWith('/components') ||
          specifier.endsWith('/utils') ||
          specifier.endsWith('/services') ||
          specifier.endsWith('/models') ||
          specifier.endsWith('/hooks') ||
          (node.importClause?.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings) &&
            node.importClause.namedBindings.elements.length >= 3 &&
            !specifier.startsWith('node:') &&
            !specifier.startsWith('vitest'))

        if (isBarrel) {
          findings.push({
            type: 'barrel-import',
            name: specifier,
            file: filePath,
            line,
            column,
            snippet
          })
        }
      }

      // 4. Unawaited expect.resolves / expect.rejects
      if (ts.isPropertyAccessExpression(node)) {
        const propName = node.name.text
        if (propName === 'resolves' || propName === 'rejects') {
          const exprText = node.expression.getText(sourceFile)
          if (exprText.startsWith('expect(')) {
            let currentParent: tsType.Node | undefined = node.parent
            let isAwaited = false
            let statementSnippet = ''
            while (currentParent) {
              if (ts.isAwaitExpression(currentParent)) {
                isAwaited = true
                break
              }
              if (ts.isStatement(currentParent)) {
                statementSnippet = currentParent.getText(sourceFile)
                break
              }
              currentParent = currentParent.parent
            }
            if (!isAwaited) {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
              findings.push({
                type: 'unawaited-promise',
                name: `expect(...).${propName} missing await`,
                file: filePath,
                line: pos.line + 1,
                column: pos.character + 1,
                snippet: statementSnippet.slice(0, 100) || node.getText(sourceFile).slice(0, 100)
              })
            }
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    // Check for unrestored fake timers
    const hasFakeTimers = findings.some(f => f.type === 'fake-timer' && f.name.includes('useFakeTimers'))
    const hasRealTimers = findings.some(f => f.type === 'fake-timer' && (f.name.includes('useRealTimers') || f.name.includes('restoreAllMocks') || f.name.includes('clearAllMocks')))
    if (hasFakeTimers && !hasRealTimers) {
      const fakeFinding = findings.find(f => f.type === 'fake-timer' && f.name.includes('useFakeTimers'))
      if (fakeFinding) {
        findings.push({
          type: 'unrestored-fake-timers',
          name: 'vi.useFakeTimers without cleanup',
          file: filePath,
          line: fakeFinding.line,
          column: fakeFinding.column,
          snippet: fakeFinding.snippet
        })
      }
    }

    return findings
  }

  /**
   * Fallback regex-based source code analyzer when TypeScript is not installed in the target project.
   */
  public fallbackRegexAnalysis(filePath: string, code: string): StaticFinding[] {
    const findings: StaticFinding[] = []
    const lines = code.split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]
      const lineNum = i + 1
      const trimmed = lineText.trim()

      if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
        continue
      }

      // Hooks
      const hookMatch = trimmed.match(/\b(beforeEach|beforeAll|afterEach|afterAll)\s*\(/)
      if (hookMatch) {
        findings.push({
          type: 'hook',
          name: hookMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(hookMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Timers
      const timerMatch = trimmed.match(/\b(setTimeout|setInterval|setImmediate|waitFor|sleep|delay)\s*\(/)
      if (timerMatch) {
        findings.push({
          type: 'timer',
          name: timerMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(timerMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Fake Timers
      const fakeTimerMatch = trimmed.match(/\b(vi\.(useFakeTimers|useRealTimers|advanceTimersByTime|runAllTimers)|jest\.(useFakeTimers|useRealTimers|advanceTimersByTime|runAllTimers))\s*\(/)
      if (fakeTimerMatch) {
        findings.push({
          type: 'fake-timer',
          name: fakeTimerMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(fakeTimerMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Network
      const networkMatch = trimmed.match(/\b(fetch|axios(\.[a-z]+)?|http\.(get|request)|https\.(get|request)|supertest|undici)\s*\(/)
      if (networkMatch) {
        findings.push({
          type: 'network',
          name: networkMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(networkMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // File I/O
      const ioMatch = trimmed.match(/\b(fs\.(read|write|promises)|fse\.|readFileSync|writeFileSync)\b/)
      if (ioMatch) {
        findings.push({
          type: 'io',
          name: ioMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(ioMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Child Process
      const cpMatch = trimmed.match(/\b(exec|spawn|execSync|execFile|fork)\s*\(/)
      if (cpMatch) {
        findings.push({
          type: 'child-process',
          name: cpMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(cpMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Module Reset
      if (trimmed.includes('vi.resetModules') || trimmed.includes('jest.resetModules') || trimmed.includes('vi.doMock')) {
        const resetMethod = trimmed.includes('vi.resetModules')
          ? 'vi.resetModules'
          : trimmed.includes('jest.resetModules')
            ? 'jest.resetModules'
            : 'vi.doMock'
        findings.push({
          type: 'module-reset',
          name: resetMethod,
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(resetMethod) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Snapshot Matchers
      const snapMatch = trimmed.match(/\b(toMatchSnapshot|toMatchInlineSnapshot|toThrowErrorMatchingSnapshot)\s*\(/)
      if (snapMatch) {
        findings.push({
          type: 'snapshot',
          name: snapMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(snapMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Database
      const dbMatch = trimmed.match(/\b(db\.|knex\.|prisma\.|sqlite\.|mongoose\.|orm\.|\.transaction\(|\.insert\(|\.update\(|\.delete\(|\.truncate\(|\.migrate\.|\.seed\.)/)
      if (dbMatch) {
        findings.push({
          type: 'database-call',
          name: dbMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(dbMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Concurrent
      const concMatch = trimmed.match(/\b(describe\.concurrent|test\.concurrent|it\.concurrent|suite\.concurrent)\b/)
      if (concMatch) {
        findings.push({
          type: 'concurrent',
          name: concMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(concMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // DOM Test
      const domMatch = trimmed.match(/\b(render\(|screen\.|cleanup\(|fireEvent\.|userEvent\.)/)
      if (domMatch) {
        findings.push({
          type: 'dom-test',
          name: domMatch[1].replace('(', ''),
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(domMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Spy / Mock
      const mockMatch = trimmed.match(/\b(vi\.spyOn|vi\.fn|jest\.spyOn|jest\.fn)\b/)
      if (mockMatch) {
        findings.push({
          type: 'spy-mock',
          name: mockMatch[1].includes('spyOn') ? 'spyOn' : 'fn',
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(mockMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Event Listener
      const evMatch = trimmed.match(/(\.on\(|\.addListener\(|\.addEventListener\(|process\.on\()/)
      if (evMatch) {
        findings.push({
          type: 'event-listener',
          name: evMatch[1].replace('(', ''),
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(evMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Async Test
      const asyncTestMatch = trimmed.match(/\b(it|test)(\.[a-z]+)?\s*\([^,]+,\s*async\b/)
      if (asyncTestMatch) {
        findings.push({
          type: 'async-test',
          name: asyncTestMatch[1],
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(asyncTestMatch[1]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Global Assignment
      const globalMatch = trimmed.match(/\b(globalThis|window|global)\.[a-zA-Z0-9_$]+\s*=/)
      if (globalMatch) {
        findings.push({
          type: 'global-assignment',
          name: globalMatch[0].replace(/\s*=/, ''),
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(globalMatch[0]) + 1,
          snippet: trimmed.slice(0, 100)
        })
      }

      // Barrel Import
      const importMatch = trimmed.match(/from\s+['"]([^'"]+)['"]/)
      if (importMatch) {
        const specifier = importMatch[1]
        findings.push({
          type: 'import',
          name: specifier,
          file: filePath,
          line: lineNum,
          column: lineText.indexOf(specifier) + 1,
          snippet: trimmed.slice(0, 100)
        })

        const isBarrel =
          specifier.endsWith('/index') ||
          specifier.endsWith('/index.js') ||
          specifier.endsWith('/index.ts') ||
          specifier === '.' ||
          specifier === '..' ||
          specifier.endsWith('/components') ||
          specifier.endsWith('/utils') ||
          specifier.endsWith('/services') ||
          specifier.endsWith('/models') ||
          specifier.endsWith('/hooks')

        if (isBarrel) {
          findings.push({
            type: 'barrel-import',
            name: specifier,
            file: filePath,
            line: lineNum,
            column: lineText.indexOf(specifier) + 1,
            snippet: trimmed.slice(0, 100)
          })
        }
      }

      // Unawaited Promise
      if (trimmed.includes('expect(') && (trimmed.includes('.resolves') || trimmed.includes('.rejects'))) {
        if (!trimmed.includes('await expect(') && !trimmed.includes('return expect(')) {
          findings.push({
            type: 'unawaited-promise',
            name: 'expect(...).resolves/rejects missing await',
            file: filePath,
            line: lineNum,
            column: 1,
            snippet: trimmed.slice(0, 100)
          })
        }
      }
    }

    // Check for unrestored fake timers
    const hasFakeTimers = findings.some(f => f.type === 'fake-timer' && f.name.includes('useFakeTimers'))
    const hasRealTimers = findings.some(f => f.type === 'fake-timer' && (f.name.includes('useRealTimers') || f.name.includes('restoreAllMocks') || f.name.includes('clearAllMocks')))
    if (hasFakeTimers && !hasRealTimers) {
      const fakeFinding = findings.find(f => f.type === 'fake-timer' && f.name.includes('useFakeTimers'))
      if (fakeFinding) {
        findings.push({
          type: 'unrestored-fake-timers',
          name: 'vi.useFakeTimers without cleanup',
          file: filePath,
          line: fakeFinding.line,
          column: fakeFinding.column,
          snippet: fakeFinding.snippet
        })
      }
    }

    return findings
  }

  public clearCache(): void {
    this.cache.clear()
  }
}
