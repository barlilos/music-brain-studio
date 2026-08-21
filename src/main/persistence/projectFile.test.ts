import { chmodSync, copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readProjectFile,
  revisionOf,
  saveProjectFile,
  serializeProject,
  writeProjectFile,
  type FileFormat
} from '@main/persistence/projectFile'

/**
 * Persistence is the part of this milestone that can lose a user's work, so
 * these tests are deliberately about failure: a stale save, a locked file, a
 * file that changed underneath.
 *
 * Everything runs against copies in a temporary directory. The real knowledge
 * base is read once, to copy it, and never written.
 */

const REAL = 'data/music-brain.json'
const CRLF: FileFormat = { newline: '\r\n', hasTrailingNewline: false }
const LF: FileFormat = { newline: '\n', hasTrailingNewline: true }

let directories: string[] = []

afterEach(() => {
  for (const directory of directories) {
    try {
      // Undo any read-only attribute a test set, or the removal fails on Windows.
      chmodSync(join(directory, 'project.json'), 0o666)
    } catch {
      // The file may not exist, which is fine.
    }
    rmSync(directory, { recursive: true, force: true })
  }
  directories = []
})

/** A disposable copy of a file, and the path to it. */
function scratch(sourcePath = REAL): string {
  const directory = mkdtempSync(join(tmpdir(), 'mbs-persistence-'))
  directories.push(directory)
  const path = join(directory, 'project.json')
  copyFileSync(sourcePath, path)
  return path
}

function scratchWith(text: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'mbs-persistence-'))
  directories.push(directory)
  const path = join(directory, 'project.json')
  writeFileSync(path, text, 'utf8')
  return path
}

const hashOf = (path: string): string => revisionOf(readFileSync(path))

describe('serializeProject', () => {
  it('writes CRLF without a trailing newline when that is what the file used', () => {
    const text = serializeProject({ a: 1, b: [2] }, CRLF)

    expect(text.includes('\r\n')).toBe(true)
    expect(/(?<!\r)\n/.test(text)).toBe(false)
    expect(text.endsWith('\n')).toBe(false)
  })

  it('writes LF with a trailing newline when that is what the file used', () => {
    const text = serializeProject({ a: 1 }, LF)

    expect(text.includes('\r')).toBe(false)
    expect(text.endsWith('\n')).toBe(true)
  })

  it('does not disturb newlines inside string values', () => {
    // `JSON.stringify` escapes these, so the CRLF rewrite must not reach them.
    const text = serializeProject({ notes: 'one\ntwo' }, CRLF)

    expect(text).toContain('one\\ntwo')
  })
})

describe('readProjectFile', () => {
  it('reads the real file and measures its layout', async () => {
    const path = scratch()
    const result = await readProjectFile(path)

    expect(result.status).toBe('read')
    if (result.status !== 'read') return

    expect(result.content.newline).toBe('\r\n')
    expect(result.content.hasTrailingNewline).toBe(false)
    expect(result.content.revision).toBe(hashOf(path))
  })

  it('reports unparseable content without throwing', async () => {
    const result = await readProjectFile(scratchWith('{ not json'))

    expect(result.status).toBe('invalid')
  })

  it('reports a missing file without throwing', async () => {
    const result = await readProjectFile(join(tmpdir(), 'mbs-does-not-exist-12345.json'))

    expect(result.status).toBe('failed')
  })
})

describe('writeProjectFile', () => {
  it('round-trips the real file to identical bytes', async () => {
    const path = scratch()
    const before = hashOf(path)

    const read = await readProjectFile(path)
    if (read.status !== 'read') throw new Error('expected a read')

    const written = await writeProjectFile(
      path,
      serializeProject(read.content.document, {
        newline: read.content.newline,
        hasTrailingNewline: read.content.hasTrailingNewline
      })
    )

    expect(written.status).toBe('written')
    // Saving a file nobody edited must not change one byte of it.
    expect(hashOf(path)).toBe(before)
  })

  it('returns the hash of what it actually wrote', async () => {
    const path = scratchWith('{}')
    const written = await writeProjectFile(path, '{"a":1}')

    expect(written.status).toBe('written')
    if (written.status !== 'written') return
    expect(written.revision).toBe(hashOf(path))
  })
})

describe('saveProjectFile', () => {
  it('writes when the file is still what the caller loaded', async () => {
    const path = scratch()
    const expected = hashOf(path)

    const outcome = await saveProjectFile(path, CRLF, expected, { changed: true })

    expect(outcome.status).toBe('written')
    expect(hashOf(path)).not.toBe(expected)
  })

  it('refuses to overwrite a file that changed on disk, and writes nothing', async () => {
    const path = scratch()
    const loaded = hashOf(path)

    // Something else edits the file after this instance loaded it.
    writeFileSync(path, '{"editedByAnotherProgram":true}', 'utf8')
    const external = hashOf(path)

    const outcome = await saveProjectFile(path, CRLF, loaded, { mine: true })

    expect(outcome.status).toBe('conflict')
    // The other program's work is exactly as it left it.
    expect(hashOf(path)).toBe(external)
    expect(readFileSync(path, 'utf8')).toBe('{"editedByAnotherProgram":true}')
  })

  it('treats a file that became unparseable as a conflict rather than writing over it', async () => {
    const path = scratch()
    const loaded = hashOf(path)

    writeFileSync(path, 'corrupted, not json', 'utf8')

    const outcome = await saveProjectFile(path, CRLF, loaded, { mine: true })

    expect(outcome.status).toBe('conflict')
    expect(readFileSync(path, 'utf8')).toBe('corrupted, not json')
  })

  it('reports a missing target as a failure rather than creating one', async () => {
    const path = join(tmpdir(), 'mbs-does-not-exist-67890.json')
    const outcome = await saveProjectFile(path, CRLF, 'whatever', { a: 1 })

    expect(outcome.status).toBe('failed')
  })

  it('leaves a valid original in place when the replacement cannot be made', async () => {
    // R4: an atomic rename can fail on Windows. Making the target read-only is
    // the reproducible version of a scanner or editor holding a handle on it.
    const path = scratch()
    const before = readFileSync(path, 'utf8')
    const expected = hashOf(path)

    chmodSync(path, 0o444)
    const outcome = await saveProjectFile(path, CRLF, expected, { replacement: true })
    chmodSync(path, 0o666)

    if (outcome.status === 'written') {
      // Some filesystems and elevated sessions permit the replace anyway. The
      // guarantee under test is the one below either way: never a partial file.
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ replacement: true })
      return
    }

    expect(outcome.status).toBe('failed')
    if (outcome.status === 'failed') expect(outcome.message.length).toBeGreaterThan(0)

    // The whole point: the original survived, intact and parseable.
    expect(readFileSync(path, 'utf8')).toBe(before)
    expect(hashOf(path)).toBe(expected)
    expect(() => JSON.parse(readFileSync(path, 'utf8'))).not.toThrow()
  })

  it('never leaves a partially written target across many saves', async () => {
    const path = scratch()
    let revision = hashOf(path)

    for (let i = 0; i < 5; i++) {
      const outcome = await saveProjectFile(path, CRLF, revision, { pass: i })
      expect(outcome.status).toBe('written')
      if (outcome.status !== 'written') return

      revision = outcome.revision
      // Parseable after every single one.
      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ pass: i })
      expect(hashOf(path)).toBe(revision)
    }
  })

  it('makes a second save with a stale revision fail even after a successful first', async () => {
    const path = scratch()
    const original = hashOf(path)

    const first = await saveProjectFile(path, CRLF, original, { pass: 1 })
    expect(first.status).toBe('written')

    // A renderer that saved, then tried again without updating its revision.
    const second = await saveProjectFile(path, CRLF, original, { pass: 2 })

    expect(second.status).toBe('conflict')
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ pass: 1 })
  })
})
