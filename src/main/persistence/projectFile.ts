/**
 * Reading and writing a project file, safely.
 *
 * Everything here is main-process only — it is the one place in the application
 * that touches a filesystem path — and it exists to make two promises:
 *
 * **A save never destroys what it did not write.** The document is serialized in
 * full, written to a temporary sibling, flushed, and only then moved over the
 * target. At no instant is the target half-written: a failure leaves either the
 * original file or the completely replaced one.
 *
 * **A save reproduces the file's own conventions.** The reference knowledge base
 * is CRLF with no trailing newline. Serializing it with LF would rewrite all
 * 8,737 lines on the first save, which turns a one-word rename into a diff
 * nobody can read. So the conventions are measured when the file is read and
 * replayed when it is written.
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import writeFileAtomic from 'write-file-atomic'
import type { ProjectDocument } from '@shared/types'

/** The line ending a file uses. Measured, never assumed. */
export type Newline = '\n' | '\r\n'

/** How a file was laid out, so a save can put it back the same way. */
export interface FileFormat {
  newline: Newline
  hasTrailingNewline: boolean
}

export interface ProjectFileContent extends FileFormat {
  document: ProjectDocument
  /** SHA-256 of the exact bytes on disk. See `revisionOf`. */
  revision: string
}

export type ReadProjectFileResult =
  | { status: 'read'; content: ProjectFileContent }
  /** The bytes were read but are not JSON. */
  | { status: 'invalid'; message: string }
  /** The file could not be read at all — missing, locked, no permission. */
  | { status: 'failed'; message: string }

export type WriteProjectFileResult =
  { status: 'written'; revision: string } | { status: 'failed'; message: string }

/** Turns an unknown thrown value into something displayable. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined
}

/**
 * The identity of a file's contents.
 *
 * SHA-256 of the raw bytes rather than mtime or size. Modification time has
 * one-second resolution on some Windows configurations and is preserved outright
 * by tools that rewrite a file in place; size misses any edit that happens to
 * keep the length. A content hash misses nothing, needs no parsing, and is
 * comparable across processes.
 */
export function revisionOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** How this text is laid out. CRLF wins if the file uses it anywhere. */
function formatOf(text: string): FileFormat {
  return { newline: text.includes('\r\n') ? '\r\n' : '\n', hasTrailingNewline: text.endsWith('\n') }
}

/**
 * Serializes a document the way the file it came from was written.
 *
 * Two spaces because that is what the reference file uses; the round-trip test
 * asserts the result is byte-identical to the original when nothing has changed.
 *
 * Replacing every `\n` is safe: `JSON.stringify` escapes newlines *inside*
 * strings as `\\n`, so the only literal newlines in its output are the ones it
 * added between tokens.
 */
export function serializeProject(document: ProjectDocument, format: FileFormat): string {
  const json = JSON.stringify(document, null, 2)
  const text = format.newline === '\r\n' ? json.replace(/\n/g, '\r\n') : json
  return format.hasTrailingNewline ? text + format.newline : text
}

export async function readProjectFile(path: string): Promise<ReadProjectFileResult> {
  let bytes: Buffer
  try {
    bytes = await readFile(path)
  } catch (error) {
    return { status: 'failed', message: describeError(error) }
  }

  const text = bytes.toString('utf8')

  let document: ProjectDocument
  try {
    document = JSON.parse(text) as ProjectDocument
  } catch (error) {
    return { status: 'invalid', message: describeError(error) }
  }

  return { status: 'read', content: { document, revision: revisionOf(bytes), ...formatOf(text) } }
}

/**
 * Errors that mean "something else is holding this file for a moment".
 *
 * On Windows this is the normal case rather than an edge case: indexers,
 * antivirus scanners, backup agents and editors all take brief handles, and the
 * replace step fails for a few hundred milliseconds and then succeeds. Treating
 * that as a hard failure would make saving feel unreliable on exactly the
 * platform this application is developed on.
 */
const TRANSIENT_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'ETXTBSY', 'EMFILE'])

/** Bounded: five attempts over roughly half a second, then give up honestly. */
const RETRY_BACKOFF_MS = [20, 50, 120, 250]

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Writes text over a file, atomically, retrying only what is worth retrying.
 *
 * `write-file-atomic` does the temp-sibling-then-rename dance, including the
 * fsync; hand-rolling `MoveFileEx` semantics is exactly the kind of thing that
 * looks right on one machine and corrupts a file on another. What it does not do
 * is decide that a Windows sharing violation is worth a second attempt, which is
 * what the loop below adds.
 *
 * A revision conflict is never retried and never reaches here — it is decided
 * before this is called, because retrying it is precisely the silent overwrite
 * the milestone exists to prevent.
 */
export async function writeProjectFile(
  path: string,
  text: string
): Promise<WriteProjectFileResult> {
  const bytes = Buffer.from(text, 'utf8')

  for (let attempt = 0; ; attempt++) {
    try {
      // `fsync` is the default and is stated here because durability is the
      // reason this package is used at all.
      await writeFileAtomic(path, bytes, { fsync: true })
      return { status: 'written', revision: revisionOf(bytes) }
    } catch (error) {
      const code = errorCode(error)
      const backoff = RETRY_BACKOFF_MS[attempt]

      if (code === undefined || !TRANSIENT_CODES.has(code) || backoff === undefined) {
        return {
          status: 'failed',
          message: code === undefined ? describeError(error) : `${code}: ${describeError(error)}`
        }
      }

      await sleep(backoff)
    }
  }
}

/**
 * The outcome of one save attempt.
 *
 * `conflict` is separate from `failed` because they mean opposite things to the
 * user: one says "someone else changed this, look before you overwrite", the
 * other says "the write did not go through, try again".
 */
export type SaveOutcome =
  | { status: 'written'; revision: string }
  | { status: 'conflict' }
  | { status: 'failed'; message: string }

/**
 * Checks, then writes.
 *
 * The check is a fresh read of the target rather than a cached value. Between
 * loading a project and saving it, anything could have edited the file — another
 * editor, a sync client, a second window — and the only honest way to know is to
 * look.
 *
 * A hash mismatch returns `conflict` and writes nothing, and is **never
 * retried**: unlike a locked file it will not resolve itself, and retrying it
 * would be exactly the silent overwrite this milestone exists to prevent. A file
 * that has become unparseable also fails the hash comparison, and is reported the
 * same way for the same reason.
 *
 * Lives here rather than in the IPC layer so that it can be tested against real
 * files without an Electron process.
 */
export async function saveProjectFile(
  path: string,
  format: FileFormat,
  expectedRevision: string,
  document: ProjectDocument
): Promise<SaveOutcome> {
  const current = await readProjectFile(path)

  if (current.status === 'failed') {
    return {
      status: 'failed',
      message: `Could not read the file before saving: ${current.message}`
    }
  }

  const revision = current.status === 'read' ? current.content.revision : null
  if (revision !== expectedRevision) return { status: 'conflict' }

  const written = await writeProjectFile(path, serializeProject(document, format))
  if (written.status === 'failed') return { status: 'failed', message: written.message }

  return { status: 'written', revision: written.revision }
}
