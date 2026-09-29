import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  /**
   * Stated as its own property rather than left as a consequence of the one
   * above, because `data/` is the directory that actually matters: it holds the
   * user's real knowledge base, and a disposable file landing beside it is the
   * failure this whole module exists to prevent.
   *
   * `relative` rather than `startsWith`, so a sibling directory whose name
   * merely begins with "data" cannot pass by accident.
   */
  it('never places the copy inside the repository data directory', () => {
    const dataDir = resolve(process.cwd(), 'data')

    for (const workspace of [make(), make()]) {
      const fromData = relative(dataDir, workspace.projectPath)
      expect(fromData.startsWith('..')).toBe(true)
      expect(relative(dataDir, workspace.directory).startsWith('..')).toBe(true)
    }
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

  /**
   * The directory rule is checked *before* the existence check, so proving it
   * needs no file on disk — and must not create one. An earlier version of this
   * test wrote `data/some-copy.json` beside the real knowledge base to show that
   * even a file that genuinely exists there is refused. That put a disposable
   * test artifact in the one directory this project declares off-limits, and a
   * killed test run would have left it there.
   *
   * The reason string recovers everything that was worth having: it names which
   * refusal fired, so a pass here cannot be the "no such file" rule answering in
   * the directory rule's place.
   */
  it('refuses anything inside the repository data directory, naming that rule', () => {
    const reasons = []
    const spy = vi.spyOn(console, 'error').mockImplementation((message) => reasons.push(message))

    try {
      expect(reuseIsolatedWorkspace(resolve(process.cwd(), 'data/some-copy.json'))).toBeNull()
      expect(reuseIsolatedWorkspace('data/some-copy.json')).toBeNull()
      expect(reuseIsolatedWorkspace('data/nested/deeper/copy.json')).toBeNull()
    } finally {
      spy.mockRestore()
    }

    expect(reasons).toHaveLength(3)
    for (const reason of reasons) {
      expect(reason).toContain('which holds real data')
      expect(reason).not.toContain('no such file')
    }

    // The point of the rewrite: nothing was created beside the real file.
    expect(existsSync(resolve(process.cwd(), 'data/some-copy.json'))).toBe(false)
  })

  it('refuses a file that does not exist rather than creating one', () => {
    // Unique per run, so two test processes cannot answer each other's question.
    const missing = join(tmpdir(), `mbs-not-there-${process.pid}-${randomUUID()}.json`)
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
