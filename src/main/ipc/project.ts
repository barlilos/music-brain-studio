import { randomUUID } from 'node:crypto'
import { basename, join } from 'node:path'
import { app, dialog, ipcMain } from 'electron'
import {
  DEFAULT_PROJECT_PATH,
  DEV_PROJECT_FILE_ENV,
  IPC_LOAD_DEFAULT_PROJECT,
  IPC_OPEN_PROJECT,
  IPC_RELOAD_PROJECT,
  IPC_SAVE_PROJECT
} from '@shared/constants'
import type {
  LoadProjectResult,
  OpenProjectResult,
  SaveProjectRequest,
  SaveProjectResult
} from '@shared/types'
import { readProjectFile, saveProjectFile, type FileFormat } from '@main/persistence/projectFile'

/**
 * Project-related IPC.
 *
 * The renderer cannot open a native dialog or touch the filesystem, so both
 * happen here. **No channel takes a path**, in either direction: reading reaches
 * only the file the user picked in a dialog or the fixed default, and writing
 * reaches only a file this process already opened and issued a token for. There
 * is nowhere for a renderer-supplied path to enter.
 *
 * The session map below is what makes that work. It is the only place a path and
 * a token are associated, it lives in this process, and it is never sent
 * anywhere.
 */

/** What the main process remembers about an open file. */
interface ProjectSession {
  /** Absolute path. Never leaves this process. */
  path: string
  /** SHA-256 of the bytes last read or written. */
  revision: string
  /** The file's own layout, replayed on every save. */
  format: FileFormat
  /**
   * Serializes saves for this file.
   *
   * Two Ctrl+S presses in quick succession would otherwise interleave their
   * read-compare-write sequences, and the second could check the hash before the
   * first had written — passing the conflict test against bytes that were about
   * to be replaced. Chaining onto one promise per token makes each save see the
   * result of the one before it.
   */
  queue: Promise<unknown>
}

const sessions = new Map<string, ProjectSession>()

/**
 * Absolute location of the default project.
 *
 * The two builds keep their files in different places, and neither is knowable
 * from the renderer:
 *
 * - **Development** — `app.getAppPath()` is the repository root, so the path
 *   resolves to the working copy and edits to the file show up on restart.
 * - **Packaged** — the app is inside an asar archive that `data/` is not part
 *   of, so it ships alongside via electron-builder's `extraResources` and is
 *   found under `process.resourcesPath`.
 *
 * In development one override is honoured: `DEV_PROJECT_FILE_ENV`, set by
 * `pnpm dev:isolated` to a disposable copy. It is deliberately gated on
 * `!app.isPackaged`, so no environment variable can redirect a shipped
 * application, and it comes from the launcher rather than from anything the
 * renderer can reach.
 */
function defaultProjectPath(): string {
  if (!app.isPackaged) {
    const override = process.env[DEV_PROJECT_FILE_ENV]
    if (override !== undefined && override.length > 0) {
      // Logged so a development session always says which file it is about to
      // edit. The path stays in this process; the renderer is never told it.
      console.log(`[project] Default project: ISOLATED COPY — ${override}`)
      return override
    }
  }

  const root = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const real = join(root, DEFAULT_PROJECT_PATH)
  if (!app.isPackaged) console.log(`[project] Default project: REAL — ${real}`)
  return real
}

/**
 * Reads one file and registers a session for it.
 *
 * Shared by every channel that opens something, so a project loads identically
 * however it was chosen and failure is described the same way.
 *
 * @param token Reuses an existing token when reloading, so a conflict recovery
 *   does not invalidate a handle the renderer is still holding.
 */
async function openSession(
  filePath: string,
  token: string = randomUUID()
): Promise<LoadProjectResult> {
  const fileName = basename(filePath)
  const result = await readProjectFile(filePath)

  switch (result.status) {
    case 'failed':
      return { status: 'failed', message: `Could not read ${fileName}: ${result.message}` }
    case 'invalid':
      return { status: 'invalid', fileName, message: result.message }
    case 'read': {
      const { document, revision, newline, hasTrailingNewline } = result.content

      sessions.set(token, {
        path: filePath,
        revision,
        format: { newline, hasTrailingNewline },
        queue: Promise.resolve()
      })

      return { status: 'opened', project: { token, fileName, document, diskRevision: revision } }
    }
  }
}

function loadDefaultProject(): Promise<LoadProjectResult> {
  return openSession(defaultProjectPath())
}

async function openProject(): Promise<OpenProjectResult> {
  const selection = await dialog.showOpenDialog({
    title: 'Open Project',
    properties: ['openFile'],
    filters: [
      { name: 'Project files', extensions: ['json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })

  const filePath = selection.filePaths[0]

  // `canceled` and an empty selection mean the same thing, but both are checked:
  // the first is the documented signal, the second is what actually narrows
  // `filePath` from `string | undefined` for the code below.
  if (selection.canceled || filePath === undefined) {
    return { status: 'canceled' }
  }

  return openSession(filePath)
}

/** Re-reads an open project, keeping its token. Used to recover from a conflict. */
async function reloadProject(_event: unknown, projectToken: string): Promise<LoadProjectResult> {
  const session = sessions.get(projectToken)
  if (session === undefined) {
    return { status: 'failed', message: 'That project is no longer open.' }
  }
  return openSession(session.path, projectToken)
}

/**
 * One save for one session.
 *
 * The decision itself — compare, then write — lives in `saveProjectFile` so it
 * can be tested without an Electron process. What belongs here is everything
 * about *this* open project: which path the token means, which layout to write
 * back, and updating the recorded revision only when a write actually landed.
 */
async function performSave(
  session: ProjectSession,
  request: SaveProjectRequest
): Promise<SaveProjectResult> {
  const outcome = await saveProjectFile(
    session.path,
    session.format,
    request.expectedRevision,
    request.document
  )

  switch (outcome.status) {
    case 'conflict':
      return { status: 'conflict' }
    case 'failed':
      // The session's revision is deliberately left alone. The renderer keeps
      // its unsaved work and stays dirty, which is the only safe outcome.
      return { status: 'failed', message: outcome.message }
    case 'written':
      session.revision = outcome.revision
      return {
        status: 'saved',
        diskRevision: outcome.revision,
        modelRevision: request.modelRevision
      }
  }
}

function saveProject(_event: unknown, request: SaveProjectRequest): Promise<SaveProjectResult> {
  const session = sessions.get(request.projectToken)
  if (session === undefined) return Promise.resolve({ status: 'unknownProject' })

  // Chain onto whatever this file is already doing, whether it succeeded or not,
  // so saves for one token never overlap.
  const run = session.queue.then(
    () => performSave(session, request),
    () => performSave(session, request)
  )

  // The queue must not reject, or every later save would inherit the rejection.
  session.queue = run.catch(() => undefined)

  return run
}

/** Registers the project handlers. Call once, before the first window opens. */
export function registerProjectIpc(): void {
  ipcMain.handle(IPC_LOAD_DEFAULT_PROJECT, loadDefaultProject)
  ipcMain.handle(IPC_OPEN_PROJECT, openProject)
  ipcMain.handle(IPC_SAVE_PROJECT, saveProject)
  ipcMain.handle(IPC_RELOAD_PROJECT, reloadProject)
}
