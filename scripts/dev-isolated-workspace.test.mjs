import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEV_PROJECT_FILE_ENV,
  createIsolatedWorkspace,
  disposeIsolatedWorkspace,
  reuseIsolatedWorkspace
} from './dev-isolated-workspace.mjs'

/**
 * The guarantee this milestone leans on hardest: a development session can write
 * as much as it likes and the real knowledge base does not change.
 *
 * This test writes to the *copy* on purpose — that is the behaviour being
 * proved — and asserts the real file's hash before and after. It never opens the
 * real file for writing.
 */

const REAL = resolve(process.cwd(), 'data/music-brain.json')

const hashOf = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

let created = []

afterEach(() => {
  for (const workspace of created) disposeIsolatedWorkspace(workspace)
  created = []
})

function make() {
  const workspace = createIsolatedWorkspace()
  if (!workspace) throw new Error('expected a workspace')
  created.push(workspace)
  return workspace
}

describe('createIsolatedWorkspace', () => {
  it('produces a byte-identical copy of the real knowledge base', () => {
    const workspace = make()

    expect(existsSync(workspace.projectPath)).toBe(true)
    expect(hashOf(workspace.projectPath)).toBe(hashOf(REAL))
  })

  it('places the copy outside the repository, in the system temp directory', () => {
    const workspace = make()

    expect(workspace.directory.startsWith(tmpdir())).toBe(true)
    expect(workspace.projectPath.startsWith(process.cwd())).toBe(false)
  })

  it('leaves the real file untouched when the copy is rewritten', () => {
    const before = hashOf(REAL)
    const workspace = make()

    // Exactly what a save does: replace the file's contents wholesale.
    const edited = readFileSync(workspace.projectPath, 'utf8').replace('Music Brain', 'Edited')
    writeFileSync(workspace.projectPath, edited, 'utf8')

    expect(hashOf(workspace.projectPath)).not.toBe(before)
    expect(hashOf(REAL)).toBe(before)
  })

  it('gives each launch its own directory', () => {
    expect(make().directory).not.toBe(make().directory)
  })

  it('disposes the copy, and tolerates being called twice', () => {
    const workspace = createIsolatedWorkspace()
    if (!workspace) throw new Error('expected a workspace')

    disposeIsolatedWorkspace(workspace)
    expect(existsSync(workspace.projectPath)).toBe(false)

    disposeIsolatedWorkspace(workspace)
    disposeIsolatedWorkspace(null)
  })

  it('returns null rather than throwing when the source is missing', () => {
    expect(createIsolatedWorkspace(resolve(process.cwd(), 'data/does-not-exist.json'))).toBeNull()
  })

  it('names the variable the main process reads', () => {
    // Kept in step with `DEV_PROJECT_FILE_ENV` in src/shared/constants.ts, which
    // this file cannot import.
    expect(DEV_PROJECT_FILE_ENV).toBe('MUSIC_BRAIN_DEV_PROJECT_FILE')

    const constants = readFileSync('src/shared/constants.ts', 'utf8')
    expect(constants).toContain(`export const DEV_PROJECT_FILE_ENV = '${DEV_PROJECT_FILE_ENV}'`)
  })
})

describe('reuseIsolatedWorkspace', () => {
  /**
   * The flag exists to make a two-process persistence test possible. Its whole
   * value depends on it being unable to reach the one file it must never touch,
   * so each refusal is pinned here.
   */
  it('reuses a disposable file that already exists', () => {
    const workspace = make()
    const reused = reuseIsolatedWorkspace(workspace.projectPath)

    expect(reused).not.toBeNull()
    expect(reused.projectPath).toBe(workspace.projectPath)
    expect(reused.reused).toBe(true)
  })

  it('refuses the real Music Brain file', () => {
    expect(reuseIsolatedWorkspace(REAL)).toBeNull()
    // However it is spelled: relative, and with a redundant traversal.
    expect(reuseIsolatedWorkspace('data/music-brain.json')).toBeNull()
    expect(reuseIsolatedWorkspace('./data/../data/music-brain.json')).toBeNull()
  })

  it('refuses anything inside the repository data directory', () => {
    const beside = resolve(process.cwd(), 'data/some-copy.json')
    writeFileSync(beside, '{}', 'utf8')
    try {
      expect(reuseIsolatedWorkspace(beside)).toBeNull()
      expect(reuseIsolatedWorkspace('data/some-copy.json')).toBeNull()
    } finally {
      rmSync(beside, { force: true })
    }
  })

  it('refuses a file that does not exist rather than creating one', () => {
    const missing = join(tmpdir(), 'mbs-not-there-98765.json')
    expect(reuseIsolatedWorkspace(missing)).toBeNull()
    expect(existsSync(missing)).toBe(false)
  })

  it('refuses a directory', () => {
    expect(reuseIsolatedWorkspace(tmpdir())).toBeNull()
  })

  it('does not delete a reused file when disposed', () => {
    const workspace = make()
    const reused = reuseIsolatedWorkspace(workspace.projectPath)

    // The file belongs to whoever prepared it; the launcher only removes the
    // directories it made itself.
    disposeIsolatedWorkspace(reused)
    expect(existsSync(workspace.projectPath)).toBe(true)
  })
})
